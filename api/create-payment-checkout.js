import Stripe from "stripe";
import { getFirebaseAdminDb, FieldValue } from "./_firebaseAdmin.js";

function getStripe() {
  const secretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY non configurata su Vercel.");
  }

  return new Stripe(secretKey);
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

function cleanText(value) {
  return String(value || "").trim();
}

function getSiteOrigin(req) {
  const configuredUrl = String(process.env.PUBLIC_SITE_URL || "").trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";

  return `${proto}://${host}`;
}

function moneyToCents(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) return 0;

  return Math.round(number * 100);
}

function isInactiveBooking(status) {
  const value = String(status || "").toLowerCase();

  return [
    "cancelled",
    "canceled",
    "deleted",
    "available",
    "rejected",
    "declined",
  ].includes(value);
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
    const adminDb = getFirebaseAdminDb();
    const stripe = getStripe();
    const body = getBody(req);

    const bookingId = cleanText(body.bookingId);
    const paymentType = body.paymentType === "full" ? "full" : "deposit";

    if (!bookingId) {
      return res.status(400).json({
        ok: false,
        message: "Booking ID mancante.",
      });
    }

    const bookingRef = adminDb.collection("bookings").doc(bookingId);
    const bookingSnapshot = await bookingRef.get();

    if (!bookingSnapshot.exists) {
      return res.status(404).json({
        ok: false,
        message: "Prenotazione non trovata.",
      });
    }

    const booking = bookingSnapshot.data();

    if (isInactiveBooking(booking.status)) {
      return res.status(400).json({
        ok: false,
        message: "Prenotazione non pagabile perché non è attiva.",
      });
    }

    if (["deposit_paid", "paid"].includes(String(booking.paymentStatus || ""))) {
      return res.status(400).json({
        ok: false,
        message: "Questa prenotazione risulta già pagata.",
      });
    }

    const totalPrice = Number(booking.totalPrice || 0);
    const depositAmount = Number(booking.depositAmount || 0);

    const amount =
      paymentType === "full"
        ? totalPrice
        : depositAmount > 0
          ? depositAmount
          : totalPrice;

    const amountCents = moneyToCents(amount);

    if (amountCents < 50) {
      return res.status(400).json({
        ok: false,
        message: "Importo pagamento non valido.",
      });
    }

    const origin = getSiteOrigin(req);
    const unitName = cleanText(booking.unitName) || "Gelone Lungomare";
    const guestEmail = cleanText(booking.guestEmail);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "it",
      customer_email: guestEmail || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountCents,
            product_data: {
              name:
                paymentType === "full"
                  ? `Pagamento soggiorno ${unitName}`
                  : `Caparra prenotazione ${unitName}`,
              description: `${booking.checkIn || "-"} / ${booking.checkOut || "-"}`,
            },
          },
        },
      ],
      metadata: {
        bookingId,
        unitId: String(booking.unitId || ""),
        paymentType,
        source: "gelone_lungomare",
      },
      payment_intent_data: {
        metadata: {
          bookingId,
          unitId: String(booking.unitId || ""),
          paymentType,
          source: "gelone_lungomare",
        },
      },
      success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payment=cancelled&bookingId=${encodeURIComponent(bookingId)}`,
    });

    await bookingRef.update({
      paymentProvider: "stripe",
      paymentStatus: "pending",
      paymentType,
      paymentAmount: amount,
      stripeCheckoutSessionId: session.id,
      paymentCheckoutUrl: session.url,
      paymentUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      ok: true,
      bookingId,
      paymentType,
      amount,
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
      message: "Link pagamento creato correttamente.",
    });
  } catch (error) {
    console.error("Errore create-payment-checkout:", error);

    return res.status(500).json({
      ok: false,
      message:
        error?.message ||
        "Errore tecnico durante la creazione del pagamento.",
    });
  }
}
