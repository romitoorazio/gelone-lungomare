import syncCalendarsHandler from "./sync-calendars.js";
import { FieldValue, getFirebaseAdminDb } from "./_firebaseAdmin.js";

const BROTHER_ARRIVAL_EMAIL = "romitofrancesco1@gmail.com";

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


function getRomeDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year + "-" + month + "-" + day;
}

function formatArrivalEuro(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function arrivalLabel(value) {
  const raw = String(value || "");

  const labels = {
    confirmed_direct: "Confermata diretta",
    confirmed: "Confermata",
    booking: "Booking",
    airbnb: "Airbnb",
    imported_ical: "iCal",
    request: "Richiesta",
    pending: "In attesa",
    cancelled: "Annullata",
    blocked: "Blocco",
    paid: "Pagato",
    unpaid: "Non pagato",
    deposit_paid: "Caparra pagata",
    to_send: "Da inviare",
    sent: "Inviato",
    completed: "Completato",
  };

  return labels[raw] || raw || "-";
}

function canNotifyArrival(booking) {
  const status = String(booking.status || "");
  return !["cancelled", "blocked", "request", "pending"].includes(status);
}

async function getArrivalUnitNames(adminDb) {
  const names = new Map();

  try {
    const snapshot = await adminDb.collection("units").get();

    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      names.set(doc.id, data.name || data.publicName || data.internalName || doc.id);
    });
  } catch (error) {
    console.warn("Nome unità non leggibile:", error);
  }

  return names;
}

async function getArrivalReminderEmail(adminDb) {
  const envEmail = String(process.env.ARRIVAL_REMINDER_EMAIL || "").trim();
  if (envEmail) return envEmail;

  try {
    const pmsSettings = await adminDb.collection("privateSettings").doc("pms").get();
    const pmsEmail = String(pmsSettings.data()?.notificationEmail || "").trim();
    if (pmsEmail) return pmsEmail;
  } catch (error) {
    console.warn("Email arrivi non leggibile da privateSettings/pms:", error);
  }

  return "romitoorazio@gmail.com";
}

function getArrivalReminderRecipients(primaryEmail) {
  return [...new Set(
    [primaryEmail, BROTHER_ARRIVAL_EMAIL]
      .flatMap((value) => String(value || "").split(","))
      .map((value) => value.trim())
      .filter(Boolean)
  )];
}

async function loadArrivalBookings(adminDb, tomorrow) {
  const snapshot = await adminDb
    .collection("bookings")
    .where("checkIn", "==", tomorrow)
    .get();

  const unitNames = await getArrivalUnitNames(adminDb);

  return snapshot.docs
    .map((doc) => {
      const data = doc.data() || {};
      const unitId = data.unitId || "lunarossa1";

      return {
        id: doc.id,
        ...data,
        unitId,
        unitName: data.unitName || unitNames.get(unitId) || unitId,
      };
    })
    .filter(canNotifyArrival)
    .sort((a, b) => {
      const unitCompare = String(a.unitName || "").localeCompare(String(b.unitName || ""));
      if (unitCompare !== 0) return unitCompare;
      return String(a.guestName || "").localeCompare(String(b.guestName || ""));
    });
}

async function sendArrivalReminderEmail(adminDb, tomorrow, arrivals) {
  const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
  const emailFrom = String(process.env.EMAIL_FROM || "").trim();

  if (!resendApiKey || !emailFrom) {
    throw new Error("RESEND_API_KEY o EMAIL_FROM mancanti su Vercel.");
  }

  const primaryEmail = await getArrivalReminderEmail(adminDb);
  const toEmails = getArrivalReminderRecipients(primaryEmail);

  const rowsText = arrivals
    .map((booking) => {
      return [
        "Alloggio: " + booking.unitName,
        "Ospite: " + (booking.guestName || "Ospite"),
        "Telefono: " + (booking.guestPhone || "-"),
        "Arrivo: " + (booking.checkIn || "-"),
        "Partenza: " + (booking.checkOut || "-"),
        "Notti: " + (booking.nights || "-"),
        "Pagamento: " + arrivalLabel(booking.paymentStatus),
        "WelcoMate: " + arrivalLabel(booking.welcomateStatus),
        "Prezzo: " + formatArrivalEuro(booking.totalPrice || 0),
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const subject = "Gelone - Arrivi di domani " + tomorrow + " (" + arrivals.length + ")";

  const textBody =
    "Promemoria arrivi di domani\n\n" +
    "Data arrivo: " + tomorrow + "\n" +
    "Arrivi: " + arrivals.length + "\n\n" +
    rowsText;

  const html =
    '<div style="font-family:Arial,sans-serif;color:#0a1d35;line-height:1.5;">' +
    '<h2>Promemoria arrivi di domani</h2>' +
    '<p>Domani <strong>' + escapeHtml(tomorrow) + '</strong> sono previsti <strong>' + arrivals.length + '</strong> arrivi.</p>' +
    '<pre style="white-space:pre-wrap;background:#faf6ee;padding:14px;border-radius:12px;">' + escapeHtml(rowsText) + '</pre>' +
    '</div>';

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + resendApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: toEmails,
      subject,
      text: textBody,
      html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error("Resend errore " + response.status + ": " + responseText);
  }

  return toEmails.join(", ");
}

async function runArrivalReminder(options = {}) {
  const send = Boolean(options.send);
  const source = options.source || "manual";
  const adminDb = getFirebaseAdminDb();
  const today = getRomeDate(0);
  const tomorrow = getRomeDate(1);
  const arrivals = await loadArrivalBookings(adminDb, tomorrow);

  if (arrivals.length === 0) {
    return {
      ok: true,
      today,
      tomorrow,
      sent: false,
      message: "Nessun arrivo domani.",
      arrivals: [],
    };
  }

  if (!send) {
    return {
      ok: true,
      today,
      tomorrow,
      sent: false,
      message: "Anteprima. Aggiungi &send=1 per inviare la mail.",
      arrivals: arrivals.map((booking) => ({
        id: booking.id,
        unitId: booking.unitId,
        unitName: booking.unitName,
        guestName: booking.guestName || "",
        guestPhone: booking.guestPhone || "",
        checkIn: booking.checkIn || "",
        checkOut: booking.checkOut || "",
        nights: booking.nights || "",
        paymentStatus: booking.paymentStatus || "",
        welcomateStatus: booking.welcomateStatus || "",
        totalPrice: booking.totalPrice || 0,
      })),
    };
  }

  const reminderId = "arrival_reminder_" + tomorrow;
  const reminderRef = adminDb.collection("maintenanceLogs").doc(reminderId);
  const existingReminder = await reminderRef.get();

  if (existingReminder.exists) {
    return {
      ok: true,
      today,
      tomorrow,
      sent: false,
      message: "Promemoria arrivi già inviato.",
      arrivals: arrivals.length,
    };
  }

  const emailTo = await sendArrivalReminderEmail(adminDb, tomorrow, arrivals);

  await reminderRef.set({
    type: "arrival_reminder",
    action: "arrival_reminder_email",
    source,
    ok: true,
    today,
    tomorrow,
    arrivalsCount: arrivals.length,
    emailTo,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    today,
    tomorrow,
    sent: true,
    emailTo,
    arrivals: arrivals.length,
  };
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
  const querySecret = String(req.query?.secret || "").trim();

  const authorizedByCron = Boolean(cronSecret) && (authorization === `Bearer ${cronSecret}` || querySecret === cronSecret);
  const authorizedBySync = Boolean(syncSecret) && querySecret === syncSecret;

  if (!authorizedByCron && !authorizedBySync) {
    return json(res, 401, {
      ok: false,
      message: "Cron non autorizzato.",
    });
  }

  const mode = String(req.query?.mode || req.query?.action || "").trim();

  if (mode === "arrival-reminders" || mode === "arrivals") {
    const result = await runArrivalReminder({
      send: String(req.query?.send || "") === "1",
      source: "manual_api",
    });

    return json(res, 200, result);
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

    let arrivalReminderResult = null;

    try {
      arrivalReminderResult = await runArrivalReminder({
        send: true,
        source: "automatic_after_calendar_sync",
      });
    } catch (arrivalError) {
      console.warn("Promemoria arrivi non inviato:", arrivalError);
      arrivalReminderResult = {
        ok: false,
        sent: false,
        message: arrivalError?.message || "Promemoria arrivi non inviato.",
      };
    }

    return json(res, 200, {
      ok: true,
      source: "cron-sync-calendars",
      startedAt,
      finishedAt,
      syncResult: payload,
      arrivalReminder: arrivalReminderResult,
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
