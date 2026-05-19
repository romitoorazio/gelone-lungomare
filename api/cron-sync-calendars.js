import syncCalendarsHandler from "./sync-calendars.js";
import { FieldValue, getFirebaseAdminDb } from "./_firebaseAdmin.js";

function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(payload);
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()] || req.headers?.[name];
  if (Array.isArray(value)) return value[0] || "";
  return String(value || "");
}

function createMemoryResponse() {
  let statusCode = 200;
  const headers = {};

  return {
    setHeader(name, value) {
      headers[name] = value;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      return {
        statusCode,
        headers,
        payload,
      };
    },
  };
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getNotificationEmail(adminDb) {
  const fallbackEmail = "info@gelone.it";

  try {
    const unitSettings = await adminDb.collection("privateSettings").doc("lunarossa1").get();
    const unitEmail = String(unitSettings.data()?.notificationEmail || "").trim();

    if (unitEmail) return unitEmail;

    const legacySettings = await adminDb.collection("privateSettings").doc("pms").get();
    const legacyEmail = String(legacySettings.data()?.notificationEmail || "").trim();

    return legacyEmail || fallbackEmail;
  } catch (error) {
    console.warn("Email notifica sync: impossibile leggere privateSettings:", error);
    return fallbackEmail;
  }
}

async function sendSyncFailureEmail(req, entry) {
  const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
  const emailFrom = String(process.env.EMAIL_FROM || "").trim();

  if (!resendApiKey || !emailFrom) {
    console.warn("Email notifica sync non inviata: RESEND_API_KEY o EMAIL_FROM mancanti.");
    return false;
  }

  try {
    const adminDb = getFirebaseAdminDb();
    const toEmail = await getNotificationEmail(adminDb);
    const payload = entry?.payload || {};
    const totals = payload?.totals || {};
    const message =
      entry?.message ||
      payload?.message ||
      "Sincronizzazione automatica calendari non completata.";
    const startedAt = entry?.startedAt || "";
    const finishedAt = entry?.finishedAt || "";
    const statusCode = toNumber(entry?.syncStatusCode);
    const userAgent = getHeader(req, "user-agent");

    const subject = "Gelone Lungomare - Sync calendari FALLITA";

    const textBody =
      "ATTENZIONE: la sincronizzazione automatica calendari non è stata completata.\n\n" +
      "Struttura: Gelone Lungomare\n" +
      "Unità: lunarossa1\n" +
      "Stato HTTP sync: " + statusCode + "\n" +
      "Messaggio: " + message + "\n" +
      "Avviata: " + startedAt + "\n" +
      "Terminata: " + finishedAt + "\n" +
      "User-Agent: " + userAgent + "\n\n" +
      "Totali:\n" +
      "Importate: " + toNumber(totals.imported || payload?.importedBookings) + "\n" +
      "Conflitti protetti: " + toNumber(totals.skippedConflict || payload?.skippedNights) + "\n" +
      "Ignorate: " + toNumber(totals.skippedIgnored) + "\n" +
      "Cancellate stale: " + toNumber(totals.cancelledStale) + "\n\n" +
      "Controlla Admin PMS e log Vercel.";

    const htmlBody =
      '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0a1d35">' +
      '<h2 style="color:#9b1c1c">Sync calendari FALLITA</h2>' +
      '<p>La sincronizzazione automatica calendari di <strong>Gelone Lungomare</strong> non è stata completata.</p>' +
      '<table cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #e4d8c2">' +
      '<tr><td><strong>Unità</strong></td><td>lunarossa1</td></tr>' +
      '<tr><td><strong>Stato HTTP sync</strong></td><td>' + escapeHtml(statusCode) + '</td></tr>' +
      '<tr><td><strong>Messaggio</strong></td><td>' + escapeHtml(message) + '</td></tr>' +
      '<tr><td><strong>Avviata</strong></td><td>' + escapeHtml(startedAt) + '</td></tr>' +
      '<tr><td><strong>Terminata</strong></td><td>' + escapeHtml(finishedAt) + '</td></tr>' +
      '<tr><td><strong>User-Agent</strong></td><td>' + escapeHtml(userAgent) + '</td></tr>' +
      '</table>' +
      '<h3>Totali</h3>' +
      '<ul>' +
      '<li>Importate: ' + escapeHtml(toNumber(totals.imported || payload?.importedBookings)) + '</li>' +
      '<li>Conflitti protetti: ' + escapeHtml(toNumber(totals.skippedConflict || payload?.skippedNights)) + '</li>' +
      '<li>Ignorate: ' + escapeHtml(toNumber(totals.skippedIgnored)) + '</li>' +
      '<li>Cancellate stale: ' + escapeHtml(toNumber(totals.cancelledStale)) + '</li>' +
      '</ul>' +
      '<p>Controlla Admin PMS e log Vercel.</p>' +
      '</div>';

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + resendApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [toEmail],
        subject,
        text: textBody,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      console.warn("Email notifica sync non inviata:", response.status, responseText);
      return false;
    }

    return true;
  } catch (error) {
    console.warn("Errore invio email notifica sync:", error);
    return false;
  }
}

async function saveCronSyncLog(req, entry) {
  const adminDb = getFirebaseAdminDb();
  const payload = entry?.payload || {};
  const totals = payload?.totals || {};
  const userAgent = getHeader(req, "user-agent");
  const triggerSource = userAgent.includes("github-actions")
    ? "github_actions"
    : "vercel_cron";

  await adminDb.collection("maintenanceLogs").add({
    type: "calendar_sync",
    action: "automatic_calendar_sync",
    mode: "automatic",

    // Admin.jsx legge questo valore per mostrare "Ultima sincronizzazione automatica".
    source: "vercel_cron",

    triggerSource,
    requestUserAgent: userAgent.slice(0, 200),

    ok: Boolean(entry?.ok),
    unitId: payload?.unitId || "lunarossa1",
    unitName: payload?.unitName || "Gelone Lungomare",

    imported: toNumber(totals.imported || payload?.importedBookings),
    skippedConflict: toNumber(totals.skippedConflict || payload?.skippedNights),
    skippedIgnored: toNumber(totals.skippedIgnored),
    cancelledStale: toNumber(totals.cancelledStale),
    movedNightsDeleted: toNumber(totals.movedNightsDeleted),

    totals,
    message:
      entry?.message ||
      (entry?.ok
        ? "Sincronizzazione automatica completata."
        : "Sincronizzazione automatica non completata."),

    syncStatusCode: toNumber(entry?.syncStatusCode),
    startedAt: entry?.startedAt || "",
    finishedAt: entry?.finishedAt || "",

    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, {
      ok: false,
      message: "Metodo non consentito.",
    });
  }

  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  const syncSecret = String(process.env.SYNC_SECRET || "").trim();
  const authorization = getHeader(req, "authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return json(res, 401, {
      ok: false,
      message: "Cron non autorizzato.",
    });
  }

  const startedAt = new Date().toISOString();

  if (!syncSecret) {
    const finishedAt = new Date().toISOString();

    const failureEntry = {
      ok: false,
      startedAt,
      finishedAt,
      syncStatusCode: 500,
      payload: null,
      message: "SYNC_SECRET non configurato.",
    };

    await saveCronSyncLog(req, failureEntry);
    await sendSyncFailureEmail(req, failureEntry);

    return json(res, 500, {
      ok: false,
      message: "SYNC_SECRET non configurato.",
    });
  }

  try {
    const memoryRes = createMemoryResponse();

    const syncResponse = await syncCalendarsHandler(
      {
        method: "POST",
        headers: {
          "x-sync-secret": syncSecret,
          "content-type": "application/json",
        },
        body: {
          unitId: "lunarossa1",
        },
      },
      memoryRes
    );

    const finishedAt = new Date().toISOString();
    const payload = syncResponse?.payload || null;
    const statusCode = Number(syncResponse?.statusCode || 500);

    if (statusCode < 200 || statusCode >= 300 || !payload?.ok) {
      const failureEntry = {
        ok: false,
        startedAt,
        finishedAt,
        syncStatusCode: statusCode,
        payload,
        message: payload?.message || "Sincronizzazione automatica non completata.",
      };

      await saveCronSyncLog(req, failureEntry);
      await sendSyncFailureEmail(req, failureEntry);

      return json(res, 500, {
        ok: false,
        source: "cron-sync-calendars",
        startedAt,
        finishedAt,
        message: payload?.message || "Sincronizzazione automatica non completata.",
        syncStatusCode: statusCode,
        syncResult: payload,
      });
    }

    await saveCronSyncLog(req, {
      ok: true,
      startedAt,
      finishedAt,
      syncStatusCode: statusCode,
      payload,
      message: "Sincronizzazione automatica completata.",
    });

    return json(res, 200, {
      ok: true,
      source: "cron-sync-calendars",
      startedAt,
      finishedAt,
      syncResult: payload,
    });
  } catch (error) {
    console.error("Errore cron-sync-calendars:", error);

    const failureEntry = {
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      syncStatusCode: 500,
      payload: null,
      message: error?.message || "Errore tecnico durante la sync automatica.",
    };

    try {
      await saveCronSyncLog(req, failureEntry);
      await sendSyncFailureEmail(req, failureEntry);
    } catch (logError) {
      console.warn("Errore salvataggio/invio alert sync:", logError);
    }

    return json(res, 500, {
      ok: false,
      source: "cron-sync-calendars",
      startedAt,
      finishedAt: failureEntry.finishedAt,
      message: failureEntry.message,
    });
  }
}
