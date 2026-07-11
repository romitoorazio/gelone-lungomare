import syncCalendarsHandler from "./sync-calendars.js";
import { FieldValue, getFirebaseAdminDb } from "./_firebaseAdmin.js";

const BROTHER_ARRIVAL_EMAIL = "romitofrancesco1@gmail.com";
const FALLBACK_ARRIVAL_EMAIL = "romitoorazio@gmail.com";

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
      return { statusCode, headers, payload };
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

function splitEmails(...values) {
  return [
    ...new Set(
      values
        .flatMap((value) => String(value || "").split(","))
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];
}

async function getPrimaryNotificationEmail(adminDb) {
  const envEmail = String(process.env.ARRIVAL_REMINDER_EMAIL || "").trim();
  if (envEmail) return envEmail;

  for (const documentId of ["lunarossa1", "pms"]) {
    try {
      const snapshot = await adminDb.collection("privateSettings").doc(documentId).get();
      const email = String(snapshot.data()?.notificationEmail || "").trim();
      if (email) return email;
    } catch (error) {
      console.warn(`Email notifica non leggibile da privateSettings/${documentId}:`, error);
    }
  }

  return FALLBACK_ARRIVAL_EMAIL;
}

async function sendResendEmail({ to, subject, text, html }) {
  const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
  const emailFrom = String(process.env.EMAIL_FROM || "").trim();

  if (!resendApiKey || !emailFrom) {
    throw new Error("RESEND_API_KEY o EMAIL_FROM mancanti su Vercel.");
  }

  const recipients = splitEmails(to);
  if (recipients.length === 0) {
    throw new Error("Nessun destinatario email configurato.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + resendApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: recipients,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error("Resend errore " + response.status + ": " + responseText);
  }

  return recipients;
}

async function sendSyncFailureEmail(req, entry) {
  try {
    const adminDb = getFirebaseAdminDb();
    const toEmail = await getPrimaryNotificationEmail(adminDb);
    const payload = entry?.payload || {};
    const totals = payload?.totals || {};
    const message =
      entry?.message ||
      payload?.message ||
      "Sincronizzazione automatica calendari non completata.";
    const statusCode = toNumber(entry?.syncStatusCode);
    const userAgent = getHeader(req, "user-agent");

    const subject = "Gelone Lungomare - Sync calendari FALLITA";
    const text =
      "ATTENZIONE: la sincronizzazione automatica calendari non è stata completata.\n\n" +
      "Struttura: Gelone Lungomare\n" +
      "Unità: lunarossa1\n" +
      "Stato HTTP sync: " + statusCode + "\n" +
      "Messaggio: " + message + "\n" +
      "Avviata: " + (entry?.startedAt || "") + "\n" +
      "Terminata: " + (entry?.finishedAt || "") + "\n" +
      "User-Agent: " + userAgent + "\n\n" +
      "Importate: " + toNumber(totals.imported || payload?.importedBookings) + "\n" +
      "Conflitti protetti: " + toNumber(totals.skippedConflict || payload?.skippedNights) + "\n" +
      "Ignorate: " + toNumber(totals.skippedIgnored) + "\n" +
      "Cancellate stale: " + toNumber(totals.cancelledStale) + "\n";

    const html =
      '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0a1d35">' +
      '<h2 style="color:#9b1c1c">Sync calendari FALLITA</h2>' +
      '<p>La sincronizzazione automatica calendari di <strong>Gelone Lungomare</strong> non è stata completata.</p>' +
      '<p><strong>Stato:</strong> ' + escapeHtml(statusCode) + '<br>' +
      '<strong>Messaggio:</strong> ' + escapeHtml(message) + '<br>' +
      '<strong>Avviata:</strong> ' + escapeHtml(entry?.startedAt || "") + '<br>' +
      '<strong>Terminata:</strong> ' + escapeHtml(entry?.finishedAt || "") + '</p>' +
      '<p>Controlla Admin PMS e log Vercel.</p>' +
      '</div>';

    await sendResendEmail({ to: [toEmail], subject, text, html });
    return true;
  } catch (error) {
    console.warn("Email notifica sync non inviata:", error);
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
    pending_direct: "Richiesta sito in attesa",
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
  return !["cancelled", "blocked", "request", "pending", "pending_direct"].includes(status);
}

async function getArrivalUnitNames(adminDb) {
  const names = new Map();

  try {
    const snapshot = await adminDb.collection("units").get();
    snapshot.docs.forEach((document) => {
      const data = document.data() || {};
      names.set(
        document.id,
        data.name || data.publicName || data.internalName || document.id
      );
    });
  } catch (error) {
    console.warn("Nome unità non leggibile:", error);
  }

  return names;
}

async function loadArrivalBookings(adminDb, tomorrow) {
  const snapshot = await adminDb
    .collection("bookings")
    .where("checkIn", "==", tomorrow)
    .get();
  const unitNames = await getArrivalUnitNames(adminDb);

  return snapshot.docs
    .map((document) => {
      const data = document.data() || {};
      const unitId = data.unitId || "lunarossa1";
      return {
        id: document.id,
        ...data,
        unitId,
        unitName: data.unitName || unitNames.get(unitId) || unitId,
      };
    })
    .filter(canNotifyArrival)
    .sort((a, b) => {
      const unitCompare = String(a.unitName || "").localeCompare(
        String(b.unitName || "")
      );
      if (unitCompare !== 0) return unitCompare;
      return String(a.guestName || "").localeCompare(String(b.guestName || ""));
    });
}

async function sendArrivalReminderEmail(adminDb, tomorrow, arrivals) {
  const primaryEmail = await getPrimaryNotificationEmail(adminDb);
  const recipients = splitEmails(primaryEmail, BROTHER_ARRIVAL_EMAIL);

  const rowsText = arrivals
    .map((booking) =>
      [
        "Alloggio: " + booking.unitName,
        "Ospite: " + (booking.guestName || "Ospite"),
        "Telefono: " + (booking.guestPhone || "-"),
        "Arrivo: " + (booking.checkIn || "-"),
        "Partenza: " + (booking.checkOut || "-"),
        "Notti: " + (booking.nights || "-"),
        "Pagamento: " + arrivalLabel(booking.paymentStatus),
        "WelcoMate: " + arrivalLabel(booking.welcomateStatus),
        "Prezzo: " + formatArrivalEuro(booking.totalPrice || 0),
      ].join("\n")
    )
    .join("\n\n---\n\n");

  const subject =
    "Gelone - Arrivi di domani " + tomorrow + " (" + arrivals.length + ")";
  const text =
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

  await sendResendEmail({ to: recipients, subject, text, html });
  return recipients.join(", ");
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
    return json(res, 405, { ok: false, message: "Metodo non consentito." });
  }

  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  const syncSecret = String(process.env.SYNC_SECRET || "").trim();
  const authorization = getHeader(req, "authorization");
  const xSyncSecret = getHeader(req, "x-sync-secret");
  const querySecret = String(req.query?.secret || "").trim();

  const authorizedByCron =
    Boolean(cronSecret) && authorization === `Bearer ${cronSecret}`;
  const authorizedBySync =
    Boolean(syncSecret) &&
    (authorization === `Bearer ${syncSecret}` ||
      xSyncSecret === syncSecret ||
      querySecret === syncSecret);

  if (!authorizedByCron && !authorizedBySync) {
    return json(res, 401, { ok: false, message: "Cron non autorizzato." });
  }

  const mode = String(req.query?.mode || req.query?.action || "").trim();

  if (mode === "arrival-reminders" || mode === "arrivals") {
    try {
      const result = await runArrivalReminder({
        send: String(req.query?.send || "") === "1",
        source: "manual_api",
      });
      return json(res, 200, result);
    } catch (error) {
      console.error("Errore promemoria arrivi:", error);
      return json(res, 500, {
        ok: false,
        sent: false,
        message: error?.message || "Promemoria arrivi non inviato.",
      });
    }
  }

  const startedAt = new Date().toISOString();

  if (!syncSecret) {
    const failureEntry = {
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      syncStatusCode: 500,
      payload: null,
      message: "SYNC_SECRET non configurato.",
    };

    try {
      await saveCronSyncLog(req, failureEntry);
      await sendSyncFailureEmail(req, failureEntry);
    } catch (error) {
      console.warn("Errore salvataggio/invio alert sync:", error);
    }

    return json(res, 500, { ok: false, message: failureEntry.message });
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
        body: { unitId: "lunarossa1" },
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
        message: failureEntry.message,
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
