import Stripe from "stripe";
import { getFirebaseAdminDb, FieldValue } from "./_firebaseAdmin.js";

function getStripe() {
  const secretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY non configurata su Vercel.");
  }

  return new Stripe(secretKey);
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

function getRequestUrl(req) {
  return new URL(req.url || "/", getSiteOrigin(req));
}

function getToken(req) {
  const queryToken = cleanText(req.query?.token);

  if (queryToken) return queryToken;

  const url = getRequestUrl(req);
  return cleanText(url.searchParams.get("token"));
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

function formatDescription(booking) {
  return `Soggiorno: ${booking.checkIn || "-"} / ${booking.checkOut || "-"}. Pagamento collegato alla prenotazione Gelone Lungomare.`;
}

function productName(paymentType, unitName) {
  if (paymentType === "balance") return `Saldo soggiorno ${unitName}`;
  if (paymentType === "full") return `Pagamento soggiorno ${unitName}`;
  return `Caparra confirmatoria prenotazione ${unitName}`;
}

export default async function handler(req, res) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (!["GET", "HEAD"].includes(req.method)) {
    return renderMessage(res, 405, "Metodo non consentito", "Apri il link pagamento ricevuto dalla struttura.");
  }

  try {
    const token = getToken(req);

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
  } catch (error) {
    console.error("Errore pay redirect:", error);
    return renderMessage(res, 500, "Errore pagamento", "Non riesco ad aprire il pagamento in questo momento. Contatta la struttura.");
  }
}
