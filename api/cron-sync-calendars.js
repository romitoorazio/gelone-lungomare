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

    await saveCronSyncLog(req, {
      ok: false,
      startedAt,
      finishedAt,
      syncStatusCode: 500,
      payload: null,
      message: "SYNC_SECRET non configurato.",
    });

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
      await saveCronSyncLog(req, {
        ok: false,
        startedAt,
        finishedAt,
        syncStatusCode: statusCode,
        payload,
        message: payload?.message || "Sincronizzazione automatica non completata.",
      });

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

    return json(res, 500, {
      ok: false,
      source: "cron-sync-calendars",
      startedAt,
      finishedAt: new Date().toISOString(),
      message: error?.message || "Errore tecnico durante la sync automatica.",
    });
  }
}
