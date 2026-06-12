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
  const number = Number(value || 0);

  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(number);
}

function label(value) {
  const text = String(value || "");

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

  return labels[text] || text || "-";
}

function canNotifyBooking(booking) {
  const status = String(booking.status || "");

  if (status === "cancelled") return false;
  if (status === "blocked") return false;
  if (status === "request") return false;
  if (status === "pending") return false;

  return true;
}

async function getNotificationEmail(adminDb) {
  const fallback = "romitoorazio@gmail.com";

  const envEmail = String(process.env.ARRIVAL_REMINDER_EMAIL || "").trim();
  if (envEmail) return envEmail;

  try {
    const pmsSettings = await adminDb.collection("privateSettings").doc("pms").get();
    const pmsEmail = String(pmsSettings.data()?.notificationEmail || "").trim();
    if (pmsEmail) return pmsEmail;
  } catch (error) {
    console.warn("Email notifica arrivi: privateSettings/pms non leggibile", error);
  }

  return fallback;
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
    console.warn("Nome unità non leggibile:", error);
  }

  return names;
}

async function sendArrivalEmail({ adminDb, tomorrow, arrivals }) {
  const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
  const emailFrom = String(process.env.EMAIL_FROM || "").trim();

  if (!resendApiKey || !emailFrom) {
    throw new Error("RESEND_API_KEY o EMAIL_FROM mancanti su Vercel.");
  }

  const toEmail = await getNotificationEmail(adminDb);

  const rowsHtml = arrivals
    .map((booking) => {
      return (
        "<tr>" +
        '<td style="padding:10px;border-bottom:1px solid #eee;">' + escapeHtml(booking.unitName) + "</td>" +
        '<td style="padding:10px;border-bottom:1px solid #eee;"><strong>' + escapeHtml(booking.guestName || "Ospite") + "</strong></td>" +
        '<td style="padding:10px;border-bottom:1px solid #eee;">' + escapeHtml(booking.guestPhone || "-") + "</td>" +
        '<td style="padding:10px;border-bottom:1px solid #eee;">' + escapeHtml(booking.checkIn || "-") + "</td>" +
        '<td style="padding:10px;border-bottom:1px solid #eee;">' + escapeHtml(booking.checkOut || "-") + "</td>" +
        '<td style="padding:10px;border-bottom:1px solid #eee;">' + escapeHtml(booking.nights || "-") + "</td>" +
        '<td style="padding:10px;border-bottom:1px solid #eee;">' + escapeHtml(label(booking.paymentStatus)) + "</td>" +
        '<td style="padding:10px;border-bottom:1px solid #eee;">' + escapeHtml(label(booking.welcomateStatus)) + "</td>" +
        '<td style="padding:10px;border-bottom:1px solid #eee;">' + escapeHtml(formatEuro(booking.totalPrice || 0)) + "</td>" +
        "</tr>"
      );
    })
    .join("");

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

  const html =
    '<div style="font-family:Arial,sans-serif;color:#0a1d35;line-height:1.5;">' +
    '<h2 style="margin:0 0 10px;">Promemoria arrivi di domani</h2>' +
    "<p>Domani <strong>" + escapeHtml(tomorrow) + "</strong> sono previsti <strong>" + arrivals.length + "</strong> arrivi.</p>" +
    '<table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:14px;">' +
    "<thead>" +
    '<tr style="background:#faf6ee;color:#9b6b25;text-align:left;">' +
    '<th style="padding:10px;">Alloggio</th>' +
    '<th style="padding:10px;">Ospite</th>' +
    '<th style="padding:10px;">Telefono</th>' +
    '<th style="padding:10px;">Arrivo</th>' +
    '<th style="padding:10px;">Partenza</th>' +
    '<th style="padding:10px;">Notti</th>' +
    '<th style="padding:10px;">Pagamento</th>' +
    '<th style="padding:10px;">WelcoMate</th>' +
    '<th style="padding:10px;">Prezzo</th>' +
    "</tr>" +
    "</thead>" +
    "<tbody>" + rowsHtml + "</tbody>" +
    "</table>" +
    '<p style="margin-top:18px;color:#666;font-size:13px;">Promemoria manuale/test. Il cron automatico lo aggiungiamo solo dopo conferma.</p>' +
    "</div>";

  const text =
    "Promemoria arrivi di domani\n\n" +
    "Data arrivo: " + tomorrow + "\n" +
    "Arrivi: " + arrivals.length + "\n\n" +
    rowsText;

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
      text,
      html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error("Resend errore " + response.status + ": " + responseText);
  }

  return toEmail;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return json(res, 405, {
        ok: false,
        message: "Metodo non consentito.",
      });
    }

    const secret = String(process.env.CRON_SECRET || process.env.SYNC_SECRET || "").trim();
    const authorization = getHeader(req, "authorization");
    const querySecret = String(req.query?.secret || "").trim();

    if (secret && authorization !== "Bearer " + secret && querySecret !== secret) {
      return json(res, 401, {
        ok: false,
        message: "Non autorizzato.",
      });
    }

    const adminDb = getFirebaseAdminDb();
    const today = getRomeDate(0);
    const tomorrow = getRomeDate(1);
    const send = String(req.query?.send || "") === "1";

    const snapshot = await adminDb
      .collection("bookings")
      .where("checkIn", "==", tomorrow)
      .get();

    const unitNames = await getUnitNames(adminDb);

    const arrivals = snapshot.docs
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
      .filter(canNotifyBooking)
      .sort((a, b) => {
        const unitCompare = String(a.unitName || "").localeCompare(String(b.unitName || ""));
        if (unitCompare !== 0) return unitCompare;

        return String(a.guestName || "").localeCompare(String(b.guestName || ""));
      });

    if (arrivals.length === 0) {
      return json(res, 200, {
        ok: true,
        today,
        tomorrow,
        sent: false,
        message: "Nessun arrivo domani.",
        arrivals: [],
      });
    }

    if (!send) {
      return json(res, 200, {
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
      });
    }

    const emailTo = await sendArrivalEmail({
      adminDb,
      tomorrow,
      arrivals,
    });

    await adminDb.collection("maintenanceLogs").add({
      type: "arrival_reminder",
      action: "manual_arrival_reminder",
      source: "manual_api",
      ok: true,
      today,
      tomorrow,
      arrivalsCount: arrivals.length,
      emailTo,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return json(res, 200, {
      ok: true,
      today,
      tomorrow,
      sent: true,
      emailTo,
      arrivals: arrivals.length,
    });
  } catch (error) {
    console.error("Errore arrival-reminders:", error);

    return json(res, 500, {
      ok: false,
      message: error?.message || "Errore promemoria arrivi.",
    });
  }
}
