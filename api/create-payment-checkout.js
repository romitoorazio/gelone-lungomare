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

function createShortPaymentToken() {
  return crypto.randomBytes(9).toString("base64url");
}

async function createUniquePaymentLinkToken(adminDb) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const token = createShortPaymentToken();
    const snapshot = await adminDb.collection("paymentLinks").doc(token).get();

    if (!snapshot.exists) {
      return token;
    }
  }

  throw new Error("Non riesco a generare un codice pagamento univoco. Riprova.");
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
    "blocked",
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

function getQueryValue(req, name) {
  const direct = req.query?.[name];

  if (Array.isArray(direct)) return cleanText(direct[0]);
  if (direct) return cleanText(direct);

  const origin = getSiteOrigin(req);
  const url = new URL(req.url || "/", origin);
  return cleanText(url.searchParams.get(name));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMessage(res, statusCode, title, message) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(`<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>${escapeHtml(title)} - Gelone Lungomare</title>
    <style>
      body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#faf6ee;color:#0a1d35;display:grid;min-height:100vh;place-items:center;padding:24px}
      .card{max-width:560px;background:#fff;border:1px solid #e4d8c2;border-radius:28px;padding:32px;box-shadow:0 18px 60px rgba(10,29,53,.10)}
      h1{margin:0 0 12px;font-family:Georgia,serif;font-size:32px}
      p{font-size:17px;line-height:1.65;color:#4f5b67}
      a{display:inline-block;margin-top:14px;background:#0a1d35;color:white;text-decoration:none;border-radius:999px;padding:14px 20px;font-weight:800}
    </style>
  </head>
  <body>
    <main class="card">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <a href="/">Torna al sito</a>
    </main>
  </body>
</html>`);
}

function redirect(res, location) {
  res.writeHead(303, {
    Location: location,
    "Cache-Control": "no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
  });
  res.end();
}

function productName(paymentType, unitName) {
  if (paymentType === "balance") return `Saldo soggiorno ${unitName}`;
  if (paymentType === "full") return `Pagamento soggiorno ${unitName}`;
  return `Caparra confirmatoria prenotazione ${unitName}`;
}

function formatDescription(booking) {
  return `Soggiorno: ${booking.checkIn || "-"} / ${booking.checkOut || "-"}. Pagamento collegato alla prenotazione Gelone Lungomare.`;
}

async function handleShortPaymentRedirect(req, res) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const token = getQueryValue(req, "token");

  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) {
    return renderMessage(res, 400, "Link non valido", "Il link pagamento non è valido o è incompleto. Contatta la struttura.");
  }

  const adminDb = getFirebaseAdminDb();
  const linkRef = adminDb.collection("paymentLinks").doc(token);
  const linkSnapshot = await linkRef.get();

  if (!linkSnapshot.exists) {
    return renderMessage(res, 404, "Link non trovato", "Questo link pagamento non esiste o non è più disponibile. Contatta la struttura.");
  }

  const link = linkSnapshot.data() || {};

  if (String(link.status || "active") !== "active") {
    return renderMessage(res, 410, "Link non attivo", "Questo link pagamento non è più attivo. Contatta la struttura per ricevere un nuovo link.");
  }

  const bookingId = cleanText(link.bookingId);

  if (!bookingId) {
    return renderMessage(res, 400, "Prenotazione mancante", "Il link pagamento non è collegato a una prenotazione valida.");
  }

  const bookingRef = adminDb.collection("bookings").doc(bookingId);
  const bookingSnapshot = await bookingRef.get();

  if (!bookingSnapshot.exists) {
    return renderMessage(res, 404, "Prenotazione non trovata", "La prenotazione collegata a questo pagamento non è stata trovata.");
  }

  const booking = bookingSnapshot.data() || {};
  const paymentType = ["deposit", "full", "balance"].includes(cleanText(link.paymentType))
    ? cleanText(link.paymentType)
    : "deposit";
  const currentPaymentStatus = cleanText(booking.paymentStatus).toLowerCase();

  if (isInactiveBooking(booking.status)) {
    return renderMessage(res, 400, "Prenotazione non pagabile", "Questa prenotazione non è attiva. Contatta la struttura.");
  }

  if (currentPaymentStatus === "paid") {
    return renderMessage(res, 200, "Prenotazione già saldata", "Questa prenotazione risulta già pagata nel sistema.");
  }

  if (currentPaymentStatus === "deposit_paid" && paymentType === "deposit") {
    return renderMessage(res, 200, "Caparra già ricevuta", "La caparra risulta già pagata. Contatta la struttura se devi pagare il saldo.");
  }

  const amount = Number(link.amount || 0);
  const amountCents = moneyToCents(amount);

  if (amountCents < 50) {
    return renderMessage(res, 400, "Importo non valido", "L'importo di questo pagamento non è valido. Contatta la struttura.");
  }

  const stripe = getStripe();
  const origin = getSiteOrigin(req);
  const unitName = cleanText(link.unitName || booking.unitName) || "Gelone Lungomare";
  const guestEmail = cleanText(link.guestEmail || booking.guestEmail);

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
            name: productName(paymentType, unitName),
            description: formatDescription(booking),
          },
        },
      },
    ],
    metadata: {
      bookingId,
      unitId: String(booking.unitId || link.unitId || ""),
      paymentType,
      paymentLinkToken: token,
      source: "gelone_lungomare",
    },
    payment_intent_data: {
      metadata: {
        bookingId,
        unitId: String(booking.unitId || link.unitId || ""),
        paymentType,
        paymentLinkToken: token,
        source: "gelone_lungomare",
      },
    },
    success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?payment=cancelled&bookingId=${encodeURIComponent(bookingId)}&paymentType=${encodeURIComponent(paymentType)}&paymentLink=${encodeURIComponent(token)}`,
  });

  await Promise.all([
    bookingRef.update({
      paymentProvider: "stripe",
      paymentStatus: "pending",
      paymentType,
      paymentAmount: amount,
      paymentCheckoutUrl: `${origin}/p/${token}`,
      paymentLinkToken: token,
      stripeCheckoutSessionId: session.id,
      stripeCheckoutUrl: session.url,
      paymentUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }),
    linkRef.set(
      {
        lastStripeCheckoutSessionId: session.id,
        lastStripeCheckoutUrl: session.url,
        lastOpenedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        openCount: FieldValue.increment(1),
      },
      { merge: true }
    ),
  ]);

  return redirect(res, session.url);
}

async function handleCreatePaymentLink(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    const adminDb = getFirebaseAdminDb();
    const body = getBody(req);
    const publicDirectPayment = body.publicDirectPayment === true;
    const adminUser = publicDirectPayment ? null : await verifyAdminRequest(req);

    const bookingId = cleanText(body.bookingId);
    const requestedPaymentType = cleanText(body.paymentType || "deposit");
    let paymentType = ["deposit", "full", "balance"].includes(requestedPaymentType)
      ? requestedPaymentType
      : "deposit";
    const publicPaymentToken = publicDirectPayment ? cleanText(body.publicPaymentToken) : "";

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
      if (!verifyPublicPaymentToken(booking, publicPaymentToken)) {
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
    const token = await createUniquePaymentLinkToken(adminDb);
    const shortUrl = `${origin}/p/${token}`;
    const unitName = cleanText(booking.unitName) || "Gelone Lungomare";
    const guestEmail = cleanText(booking.guestEmail);

    await adminDb.collection("paymentLinks").doc(token).set({
      token,
      bookingId,
      unitId: String(booking.unitId || ""),
      unitName,
      guestName: cleanText(booking.guestName),
      guestEmail,
      paymentType,
      amount,
      amountCents,
      totalPrice,
      depositAmount,
      shortUrl,
      status: "active",
      source: publicDirectPayment ? "public_site" : "admin",
      createdBy: adminUser?.email || "public_site",
      publicDirectPayment: Boolean(publicDirectPayment),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await bookingRef.update({
      ...pricingUpdate,
      paymentProvider: "stripe",
      paymentStatus: "pending",
      paymentType,
      paymentAmount: amount,
      paymentCheckoutUrl: shortUrl,
      paymentLinkToken: token,
      paymentLinkCreatedAt: FieldValue.serverTimestamp(),
      paymentCreatedBy: adminUser?.email || "public_site",
      stripeCheckoutSessionId: "",
      stripeCheckoutUrl: "",
      ...(publicDirectPayment ? { publicPaymentTokenLastUsedAt: FieldValue.serverTimestamp() } : {}),
      paymentUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      ok: true,
      bookingId,
      paymentType,
      amount,
      paymentLinkToken: token,
      checkoutUrl: shortUrl,
      shortUrl,
      message: "Link pagamento breve creato correttamente.",
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

export default async function handler(req, res) {
  if (["GET", "HEAD"].includes(req.method)) {
    return handleShortPaymentRedirect(req, res);
  }

  if (req.method === "POST") {
    return handleCreatePaymentLink(req, res);
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(405).json({
    ok: false,
    message: "Metodo non consentito.",
  });
}
