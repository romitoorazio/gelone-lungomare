import cronSyncCalendarsHandler from "./cron-sync-calendars.js";
import { FieldValue, getFirebaseAdminDb } from "./_firebaseAdmin.js";

const BROTHER_EMAIL = "romitofrancesco1@gmail.com";

function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(payload);
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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function formatEuro(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function label(value) {
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

async function getUnitNames(adminDb) {
  const names = new Map();

  try {
    const snapshot = await adminDb.collection("units").get();

    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      names.set(doc.id, data.name || data.publicName || data.internalName || doc.id);
    });
  } catch (error) {
    console.warn("Nome unita non leggibile per copia arrivi fratello:", error);
  }

  return names;
}

async function loadTomorrowArrivals(adminDb, tomorrow) {
  const snapshot = await adminDb
    .collection("bookings")
    .where("checkIn", "==", tomorrow)
    .get();

  const unitNames = await getUnitNames(adminDb);

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

async function sendBrotherArrivalCopy(adminDb) {
  const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
  const emailFrom = String(process.env.EMAIL_FROM || "").trim();

  if (!resendApiKey || !emailFrom) {
    return {
      ok: false,
      sent: false,
      message: "RESEND_API_KEY o EMAIL_FROM mancanti su Vercel.",
    };
  }

  const today = getRomeDate(0);
  const tomorrow = getRomeDate(1);
  const arrivals = await loadTomorrowArrivals(adminDb, tomorrow);

  if (arrivals.length === 0) {
    return {
      ok: true,
      sent: false,
      today,
      tomorrow,
      message: "Nessun arrivo domani per copia fratello.",
      arrivals: 0,
    };
  }

  const reminderId = "arrival_reminder_francesco_" + tomorrow;
  const reminderRef = adminDb.collection("maintenanceLogs").doc(reminderId);
  const existing = await reminderRef.get();

  if (existing.exists) {
    return {
      ok: true,
      sent: false,
      today,
      tomorrow,
      message: "Promemoria arrivi gia inviato a Francesco.",
      arrivals: arrivals.length,
      emailTo: BROTHER_EMAIL,
    };
  }

  const rowsText = arrivals
    .map((booking) => {
      return [
        "Alloggio: " + booking.unitName,
        "Ospite: " + (booking.guestName || "Ospite"),
        "Telefono: " + (booking.guestPhone || "-"),
        "Arrivo: " + (booking.checkIn || "-"),
        "Partenza: " + (booking.checkOut || "-"),
        "Notti: " + (booking.nights || "-"),
        "Pagamento: " + label(booking.paymentStatus),
        "WelcoMate: " + label(booking.welcomateStatus),
        "Prezzo: " + formatEuro(booking.totalPrice || 0),
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
      to: [BROTHER_EMAIL],
      subject,
      text: textBody,
      html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    return {
      ok: false,
      sent: false,
      today,
      tomorrow,
      message: "Resend errore " + response.status + ": " + responseText,
      arrivals: arrivals.length,
      emailTo: BROTHER_EMAIL,
    };
  }

  await reminderRef.set({
    type: "arrival_reminder",
    action: "arrival_reminder_email_brother_copy",
    source: "automatic_after_calendar_sync_brother_copy",
    ok: true,
    today,
    tomorrow,
    arrivalsCount: arrivals.length,
    emailTo: BROTHER_EMAIL,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    sent: true,
    today,
    tomorrow,
    arrivals: arrivals.length,
    emailTo: BROTHER_EMAIL,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, {
      ok: false,
      message: "Metodo non consentito.",
    });
  }

  const memoryRes = createMemoryResponse();
  const baseResult = await cronSyncCalendarsHandler(req, memoryRes);
  const baseStatus = Number(baseResult?.statusCode || 500);
  const basePayload = baseResult?.payload || null;

  if (baseStatus < 200 || baseStatus >= 300 || !basePayload?.ok) {
    return json(res, baseStatus, basePayload || {
      ok: false,
      message: "Cron principale non completato.",
    });
  }

  let brotherArrivalReminder = null;

  try {
    brotherArrivalReminder = await sendBrotherArrivalCopy(getFirebaseAdminDb());
  } catch (error) {
    console.warn("Copia promemoria arrivi a Francesco non inviata:", error);
    brotherArrivalReminder = {
      ok: false,
      sent: false,
      message: error?.message || "Copia promemoria arrivi a Francesco non inviata.",
      emailTo: BROTHER_EMAIL,
    };
  }

  return json(res, 200, {
    ...basePayload,
    brotherArrivalReminder,
  });
}
