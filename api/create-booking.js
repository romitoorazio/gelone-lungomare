import { getFirebaseAdminDb, FieldValue } from "./_firebaseAdmin.js";

const UNIT_ID = "lunarossa1";
const UNIT_NAME = "Gelone Lungomare";
const NOTIFY_EMAIL = "info@gelone.it";

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function getNightDates(checkIn, checkOut) {
  const nights = [];

  const [startYear, startMonth, startDay] = checkIn.split("-").map(Number);
  const [endYear, endMonth, endDay] = checkOut.split("-").map(Number);

  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  const cursor = new Date(start);

  while (cursor < end) {
    nights.push(toDateInputValue(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return nights;
}

function cleanText(value) {
  return String(value || "").trim();
}

function getBody(req) {
  if (!req.body) return {};

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

async function sendNotificationEmail(booking) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom =
    process.env.EMAIL_FROM || "Gelone Lungomare <onboarding@resend.dev>";

  if (!resendApiKey) {
    return {
      sent: false,
      reason: "RESEND_API_KEY non configurata.",
    };
  }

  const subject = "Nuova richiesta prenotazione Gelone Lungomare";

  const text = `
Nuova richiesta prenotazione ricevuta dal sito.

Struttura: ${UNIT_NAME}
Nome ospite: ${booking.guestName}
Email ospite: ${booking.guestEmail || "-"}
Telefono ospite: ${booking.guestPhone || "-"}
Arrivo: ${booking.checkIn}
Partenza: ${booking.checkOut}
Ospiti: ${booking.guests}
Note: ${booking.notes || "-"}

Stato: ${booking.status}
Origine: ${booking.source}
Booking ID: ${booking.bookingId}

Controlla il PMS admin:
https://www.gelone.it/admin
`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [NOTIFY_EMAIL],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    return {
      sent: false,
      reason: "Errore invio email.",
    };
  }

  return {
    sent: true,
  };
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Metodo non consentito.",
    });
  }

  try {
    const adminDb = getFirebaseAdminDb();
    const body = getBody(req);

    const guestName = cleanText(body.guestName);
    const guestEmail = cleanText(body.guestEmail);
    const guestPhone = cleanText(body.guestPhone);
    const checkIn = cleanText(body.checkIn);
    const checkOut = cleanText(body.checkOut);
    const notes = cleanText(body.notes);
    const guests = Number(body.guests || 1);

    if (!guestName) {
      return res.status(400).json({
        ok: false,
        message: "Inserisci nome e cognome.",
      });
    }

    if (!guestPhone && !guestEmail) {
      return res.status(400).json({
        ok: false,
        message: "Inserisci almeno telefono o email.",
      });
    }

    if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
      return res.status(400).json({
        ok: false,
        message: "Inserisci date valide.",
      });
    }

    if (checkOut <= checkIn) {
      return res.status(400).json({
        ok: false,
        message: "La data di partenza deve essere successiva alla data di arrivo.",
      });
    }

    if (!Number.isFinite(guests) || guests < 1 || guests > 2) {
      return res.status(400).json({
        ok: false,
        message: "Gelone Lungomare puÃ² ospitare massimo 2 persone.",
      });
    }

    const nights = getNightDates(checkIn, checkOut);

    if (nights.length < 1) {
      return res.status(400).json({
        ok: false,
        message: "Devi selezionare almeno una notte.",
      });
    }

    if (nights.length > 60) {
      return res.status(400).json({
        ok: false,
        message: "Per soggiorni superiori a 60 notti contatta la struttura.",
      });
    }

    const bookingRef = adminDb.collection("bookings").doc();

    const bookingData = {
      unitId: UNIT_ID,
      unitName: UNIT_NAME,
      guestName,
      guestEmail,
      guestPhone,
      checkIn,
      checkOut,
      guests,
      source: "direct_site",
      status: "pending_direct",
      totalPrice: null,
      notes,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.runTransaction(async (transaction) => {
      const nightRefs = nights.map((night) =>
        adminDb.collection("nights").doc(`${UNIT_ID}_${night}`)
      );

      const nightSnapshots = [];

      for (const nightRef of nightRefs) {
        const nightSnapshot = await transaction.get(nightRef);
        nightSnapshots.push(nightSnapshot);
      }

      const occupiedNight = nightSnapshots.find((snapshot) => {
        if (!snapshot.exists) return false;
        const data = snapshot.data();
        return data?.status !== "cancelled";
      });

      if (occupiedNight) {
        throw new Error("DATES_NOT_AVAILABLE");
      }

      transaction.set(bookingRef, bookingData);

      nights.forEach((night) => {
        const nightRef = adminDb.collection("nights").doc(`${UNIT_ID}_${night}`);

        transaction.set(nightRef, {
          unitId: UNIT_ID,
          date: night,
          bookingId: bookingRef.id,
          status: "pending_direct",
          source: "direct_site",
          guestName,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    });

    const emailResult = await sendNotificationEmail({
      ...bookingData,
      bookingId: bookingRef.id,
    });

    return res.status(201).json({
      ok: true,
      bookingId: bookingRef.id,
      unitId: UNIT_ID,
      unitName: UNIT_NAME,
      checkIn,
      checkOut,
      nights,
      status: "pending_direct",
      message:
        "Richiesta ricevuta. Le date sono state bloccate nel sistema Gelone Lungomare in attesa di conferma della struttura.",
      emailNotification: emailResult,
    });
  } catch (error) {
    console.error("Errore create-booking:", error);

    if (error?.message === "DATES_NOT_AVAILABLE") {
      return res.status(409).json({
        ok: false,
        message:
          "Le date selezionate non sono piÃ¹ disponibili. Prova altre date o contattaci su WhatsApp.",
      });
    }

    return res.status(500).json({
      ok: false,
      message:
        error?.message ||
        "Errore tecnico durante la richiesta. Riprova piÃ¹ tardi o contattaci su WhatsApp.",
    });
  }
}
