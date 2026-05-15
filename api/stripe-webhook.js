import Stripe from "stripe";
import { getFirebaseAdminDb, FieldValue } from "./_firebaseAdmin.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

function getStripe() {
  const secretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY non configurata su Vercel.");
  }

  return new Stripe(secretKey);
}

function getWebhookSecret() {
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET non configurata su Vercel.");
  }

  return webhookSecret;
}

function cleanText(value) {
  return String(value || "").trim();
}

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function getNightDates(checkIn, checkOut) {
  const nights = [];

  if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkOut <= checkIn) {
    return nights;
  }

  const [startYear, startMonth, startDay] = checkIn.split("-").map(Number);
  const [endYear, endMonth, endDay] = checkOut.split("-").map(Number);

  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  while (cursor < end) {
    nights.push(toDateInputValue(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return nights;
}

function centsToEuro(cents) {
  const number = Number(cents || 0);

  if (!Number.isFinite(number)) return 0;

  return Math.round((number / 100) * 100) / 100;
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === "string") {
    return Buffer.from(req.body, "utf8");
  }

  if (req.body && typeof req.body === "object") {
    return Buffer.from(JSON.stringify(req.body), "utf8");
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function markBookingPaid(adminDb, session, event) {
  const bookingId = cleanText(session.metadata?.bookingId);

  if (!bookingId) {
    return {
      updated: false,
      reason: "bookingId mancante nei metadata Stripe.",
    };
  }

  const eventRef = adminDb.collection("stripeEvents").doc(event.id);
  const bookingRef = adminDb.collection("bookings").doc(bookingId);

  let result = {
    updated: false,
    bookingId,
    reason: "",
  };

  await adminDb.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef);

    if (eventSnapshot.exists) {
      result = {
        updated: false,
        bookingId,
        reason: "Evento Stripe già processato.",
      };
      return;
    }

    const bookingSnapshot = await transaction.get(bookingRef);

    if (!bookingSnapshot.exists) {
      transaction.set(eventRef, {
        eventId: event.id,
        type: event.type,
        bookingId,
        status: "booking_not_found",
        stripeSessionId: session.id,
        createdAt: FieldValue.serverTimestamp(),
      });

      result = {
        updated: false,
        bookingId,
        reason: "Prenotazione non trovata.",
      };
      return;
    }

    const booking = bookingSnapshot.data();
    const paymentType = cleanText(session.metadata?.paymentType || booking.paymentType || "deposit");
    const paidAmount = centsToEuro(session.amount_total);
    const unitId = cleanText(session.metadata?.unitId || booking.unitId || "");
    const nights = getNightDates(booking.checkIn, booking.checkOut);

    const nextPaymentStatus = paymentType === "full" ? "paid" : "deposit_paid";
    const currentStatus = cleanText(booking.status || "pending_direct");
    const nextStatus = ["pending_direct", "pending", "pending_payment"].includes(currentStatus)
      ? "confirmed_direct"
      : currentStatus || "confirmed_direct";

    transaction.update(bookingRef, {
      status: nextStatus,
      paymentProvider: "stripe",
      paymentStatus: nextPaymentStatus,
      paymentType,
      paymentAmount: paidAmount,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: cleanText(session.payment_intent),
      stripeCustomerId: cleanText(session.customer),
      paidAt: FieldValue.serverTimestamp(),
      paymentUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    nights.forEach((night) => {
      if (!unitId) return;

      const nightRef = adminDb.collection("nights").doc(`${unitId}_${night}`);

      transaction.set(
        nightRef,
        {
          unitId,
          date: night,
          bookingId,
          status: nextStatus,
          source: booking.source || "direct_site",
          guestName: booking.guestName || "",
          paymentStatus: nextPaymentStatus,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    transaction.set(eventRef, {
      eventId: event.id,
      type: event.type,
      bookingId,
      status: "processed",
      stripeSessionId: session.id,
      stripePaymentIntentId: cleanText(session.payment_intent),
      paymentType,
      paymentStatus: nextPaymentStatus,
      paidAmount,
      createdAt: FieldValue.serverTimestamp(),
    });

    result = {
      updated: true,
      bookingId,
      paymentStatus: nextPaymentStatus,
      status: nextStatus,
      paidAmount,
    };
  });

  return result;
}

async function markBookingPaymentProblem(adminDb, session, event, paymentStatus) {
  const bookingId = cleanText(session.metadata?.bookingId);

  if (!bookingId) {
    return {
      updated: false,
      reason: "bookingId mancante nei metadata Stripe.",
    };
  }

  const eventRef = adminDb.collection("stripeEvents").doc(event.id);
  const bookingRef = adminDb.collection("bookings").doc(bookingId);

  let result = {
    updated: false,
    bookingId,
    reason: "",
  };

  await adminDb.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef);

    if (eventSnapshot.exists) {
      result = {
        updated: false,
        bookingId,
        reason: "Evento Stripe già processato.",
      };
      return;
    }

    const bookingSnapshot = await transaction.get(bookingRef);

    if (bookingSnapshot.exists) {
      transaction.update(bookingRef, {
        paymentProvider: "stripe",
        paymentStatus,
        stripeCheckoutSessionId: session.id,
        paymentUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    transaction.set(eventRef, {
      eventId: event.id,
      type: event.type,
      bookingId,
      status: "processed",
      stripeSessionId: session.id,
      paymentStatus,
      createdAt: FieldValue.serverTimestamp(),
    });

    result = {
      updated: bookingSnapshot.exists,
      bookingId,
      paymentStatus,
    };
  });

  return result;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Metodo non consentito.",
    });
  }

  try {
    const stripe = getStripe();
    const webhookSecret = getWebhookSecret();
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).json({
        ok: false,
        message: "Firma Stripe mancante.",
      });
    }

    const rawBody = await readRawBody(req);

    let event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      console.error("Firma webhook Stripe non valida:", error);

      return res.status(400).json({
        ok: false,
        message: "Firma webhook Stripe non valida.",
      });
    }

    const adminDb = getFirebaseAdminDb();
    const session = event.data.object;

    let result = {
      received: true,
      ignored: true,
      type: event.type,
    };

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      result = await markBookingPaid(adminDb, session, event);
    }

    if (event.type === "checkout.session.async_payment_failed") {
      result = await markBookingPaymentProblem(adminDb, session, event, "failed");
    }

    if (event.type === "checkout.session.expired") {
      result = await markBookingPaymentProblem(adminDb, session, event, "expired");
    }

    return res.status(200).json({
      ok: true,
      type: event.type,
      result,
    });
  } catch (error) {
    console.error("Errore stripe-webhook:", error);

    return res.status(500).json({
      ok: false,
      message:
        error?.message ||
        "Errore tecnico durante la gestione webhook Stripe.",
    });
  }
}
