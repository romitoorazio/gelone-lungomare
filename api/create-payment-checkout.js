import crypto from "crypto";
import Stripe from "stripe";
import { getFirebaseAdminAuth, getFirebaseAdminDb, FieldValue } from "./_firebaseAdmin.js";
import { calculateServerBookingPricing, loadServerPricing } from "./_pricing.js";

const ADMIN_EMAILS = [
  "romitoorazio@gmail.com",
  "romitofrancesco1@gmail.com",
].map((email) => email.toLowerCase());

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

function hashPublicPaymentToken(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

function verifyPublicPaymentToken(booking, token) {
  const storedHash = cleanText(booking?.publicPaymentTokenHash);
  const providedToken = cleanText(token);

  if (!storedHash || !providedToken) {
    return false;
  }

  const providedHash = hashPublicPaymentToken(providedToken);

  try {
    const storedBuffer = Buffer.from(storedHash, "hex");
    const providedBuffer = Buffer.from(providedHash, "hex");

    return (
      storedBuffer.length === providedBuffer.length &&
      crypto.timingSafeEqual(storedBuffer, providedBuffer)
    );
  } catch {
    return false;
  }
}

function getBearerToken(req) {
  const authorization = String(req.headers.authorization || req.headers.Authorization || "").trim();

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

async function verifyAdminRequest(req) {
  const token = getBearerToken(req);

  if (!token) {
    const error = new Error("Accesso admin richiesto per creare link pagamento manuali.");
    error.statusCode = 401;
    throw error;
  }

  let decodedToken;

  try {
    decodedToken = await getFirebaseAdminAuth().verifyIdToken(token);
  } catch {
    const error = new Error("Sessione admin non valida o scaduta.");
    error.statusCode = 401;
    throw error;
  }

  const email = cleanText(decodedToken.email).toLowerCase();

  if (!ADMIN_EMAILS.includes(email)) {
    const error = new Error("Account non autorizzato a creare link pagamento.");
    error.statusCode = 403;
    throw error;
  }

  return {
    uid: decodedToken.uid,
    email,
  };
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

function shouldRecalculateBookingPrice(booking, publicDirectPayment) {
  const source = String(booking?.source || "").toLowerCase();
  return publicDirectPayment || source === "direct_site" || source === "public_site";
}

async function resolvePaymentAmounts(adminDb, booking, publicDirectPayment) {
  const unitId = String(booking.unitId || "lunarossa1");

  if (shouldRecalculateBookingPrice(booking, publicDirectPayment)) {
    const nightsCount = Number(booking.nightsCount || 0);
    const serverPricing = await calculateServerBookingPricing(adminDb, unitId, nightsCount);

    return {
      totalPrice: Number(serverPricing.totalPrice || 0),
      depositAmount: Number(serverPricing.depositAmount || 0),
      pricingUpdate: {
        totalPrice: serverPricing.totalPrice,
        nightlyRate: serverPricing.nightlyRate,
        cleaningFee: serverPricing.cleaningFee,
        nightsCount: serverPricing.nightsCount,
        depositAmount: serverPricing.depositAmount,
        pricingCalculatedBy: serverPricing.pricingCalculatedBy,
        pricingSource: serverPricing.source,
        pricingSettingsDocId: serverPricing.settingsDocId,
        pricingRecalculatedAt: FieldValue.serverTimestamp(),
      },
    };
  }

  return {
    totalPrice: Number(booking.totalPrice || 0),
    depositAmount: Number(booking.depositAmount || 0),
    pricingUpdate: {},
  };
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
    const publicDirectPayment = body.publicDirectPayment === true;
    const adminUser = publicDirectPayment ? null : await verifyAdminRequest(req);

    const bookingId = cleanText(body.bookingId);
    const requestedPaymentType = cleanText(body.paymentType || "deposit");
    let paymentType = ["deposit", "full", "balance"].includes(requestedPaymentType)
      ? requestedPaymentType
      : "deposit";

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

    if (publicDirectPayment) {
      if (!verifyPublicPaymentToken(booking, body.publicPaymentToken)) {
        return res.status(403).json({
          ok: false,
          message: "Link pagamento non valido. Contatta la struttura per ricevere un nuovo link.",
        });
      }

      const unitIdForPayment = String(booking.unitId || "lunarossa1");
      const serverPricing = await loadServerPricing(adminDb, unitIdForPayment);

      if (!serverPricing.directPaymentEnabled) {
        return res.status(403).json({
          ok: false,
          message: "Pagamento online disattivato dalla struttura.",
        });
      }
    }

    if (isInactiveBooking(booking.status)) {
      return res.status(400).json({
        ok: false,
        message: "Prenotazione non pagabile perché non è attiva.",
      });
    }

    const currentPaymentStatus = String(booking.paymentStatus || "").toLowerCase();

    if (currentPaymentStatus === "paid") {
      return res.status(400).json({
        ok: false,
        message: "Questa prenotazione risulta già saldata.",
      });
    }

    if (currentPaymentStatus === "deposit_paid" && paymentType === "deposit") {
      return res.status(400).json({
        ok: false,
        message: "La caparra risulta già pagata. Crea il link per il saldo residuo.",
      });
    }

    if (currentPaymentStatus === "deposit_paid" && paymentType === "full") {
      paymentType = "balance";
    }

    const { totalPrice, depositAmount, pricingUpdate } = await resolvePaymentAmounts(
      adminDb,
      booking,
      publicDirectPayment
    );

    const amount =
      paymentType === "balance"
        ? Math.max(totalPrice - depositAmount, 0)
        : paymentType === "full"
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
                paymentType === "balance"
                  ? `Saldo soggiorno ${unitName}`
                  : paymentType === "full"
                    ? `Pagamento soggiorno ${unitName}`
                    : `Caparra confirmatoria prenotazione ${unitName}`,
              description:
                paymentType === "deposit"
                  ? `Soggiorno: ${booking.checkIn || "-"} / ${booking.checkOut || "-"}. Condizioni: rimborso totale fino a 14 giorni prima del check-in; da 13 a 7 giorni caparra trattenuta; ultimi 6 giorni, no-show o partenza anticipata non rimborsabili salvo accordo scritto.`
                  : `Soggiorno: ${booking.checkIn || "-"} / ${booking.checkOut || "-"}. Pagamento collegato alla prenotazione Gelone Lungomare.`,
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
      cancel_url: `${origin}/?payment=cancelled&bookingId=${encodeURIComponent(bookingId)}&paymentType=${encodeURIComponent(paymentType)}`,
    });

    await bookingRef.update({
      ...pricingUpdate,
      paymentProvider: "stripe",
      paymentStatus: "pending",
      paymentType,
      paymentAmount: amount,
      stripeCheckoutSessionId: session.id,
      paymentCheckoutUrl: session.url,
      paymentCreatedBy: adminUser?.email || "public_site",
      ...(publicDirectPayment ? { publicPaymentTokenLastUsedAt: FieldValue.serverTimestamp() } : {}),
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

    return res.status(error?.statusCode || 500).json({
      ok: false,
      message:
        error?.message ||
        "Errore tecnico durante la creazione del pagamento.",
    });
  }
}
