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

function formatEuroForEmail(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number <= 0) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(number);
}

function formatDateForEmail(value) {
  const text = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text || "-";
  }

  const [year, month, day] = text.split("-");
  return `${day}/${month}/${year}`;
}

function paymentTypeForEmail(value) {
  const type = cleanText(value).toLowerCase();

  if (type === "deposit") return "Caparra confirmatoria";
  if (type === "balance") return "Saldo";
  if (type === "full") return "Pagamento completo";

  return "Pagamento";
}

function paymentStatusForEmail(value) {
  const status = cleanText(value).toLowerCase();

  if (status === "paid") return "Prenotazione saldata";
  if (status === "deposit_paid") return "Caparra ricevuta";

  return "Pagamento ricevuto";
}

async function sendPaymentReceivedEmail(payment, session) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom =
    process.env.EMAIL_FROM || "Gelone Lungomare <onboarding@resend.dev>";

  if (!resendApiKey) {
    return {
      sent: false,
      reason: "RESEND_API_KEY non configurata.",
    };
  }

  const guestEmail = cleanText(
    payment.guestEmail ||
    session?.customer_details?.email ||
    session?.customer_email
  );

  if (!guestEmail) {
    return {
      sent: false,
      reason: "Email ospite mancante.",
    };
  }

  const unitName = payment.unitName || "Gelone Lungomare";
  const guestName = payment.guestName || "ospite";
  const nightsCount = Number(payment.nightsCount || 0);
  const nightsText = nightsCount === 1 ? "1 notte" : `${nightsCount} notti`;
  const totalPrice = Number(payment.totalPrice || 0);
  const paidAmount = Number(payment.paidAmount || 0);
  const balanceAfterThisPayment =
    payment.paymentStatus === "deposit_paid" && totalPrice > paidAmount
      ? Math.max(totalPrice - paidAmount, 0)
      : 0;

  const subject =
    payment.paymentStatus === "paid"
      ? `Pagamento ricevuto - Prenotazione saldata ${unitName}`
      : `Caparra ricevuta - ${unitName}`;

  const text = `
Ciao ${guestName},

abbiamo ricevuto il tuo pagamento per ${unitName}.

Riepilogo pagamento:
- Tipo pagamento: ${paymentTypeForEmail(payment.paymentType)}
- Importo pagato: ${formatEuroForEmail(paidAmount)}
- Stato: ${paymentStatusForEmail(payment.paymentStatus)}
- Riferimento prenotazione: ${payment.bookingId}
- Riferimento Stripe: ${payment.stripeSessionId || session?.id || "-"}

Riepilogo soggiorno:
- Arrivo: ${formatDateForEmail(payment.checkIn)}
- Partenza: ${formatDateForEmail(payment.checkOut)}
- Durata: ${nightsText}
- Ospiti: ${payment.guests || "-"}
- Totale prenotazione: ${formatEuroForEmail(totalPrice)}
${balanceAfterThisPayment > 0 ? `- Saldo residuo indicativo: ${formatEuroForEmail(balanceAfterThisPayment)}` : "- Saldo residuo: nessuno"}

Prossimi passi:
La tua prenotazione risulta aggiornata nel nostro sistema.
Ti contatteremo per eventuali informazioni sul check-in e per la raccolta dei dati ospiti, se necessari.

Condizioni cancellazione prenotazioni dirette:
- Rimborso totale fino a 14 giorni prima del check-in.
- Da 13 a 7 giorni prima del check-in viene trattenuta la caparra confirmatoria.
- Negli ultimi 6 giorni, in caso di no-show o partenza anticipata, gli importi versati non sono rimborsabili salvo diverso accordo scritto.

Contatti:
Telefono / WhatsApp: 3476308456
Telefono: 3479461999
Email: info@gelone.it
Sito: https://www.gelone.it

Grazie,
Gelone Lungomare
`.trim();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [guestEmail],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    return {
      sent: false,
      reason: errorText || "Errore invio email pagamento.",
    };
  }

  return {
    sent: true,
  };
}

async function readRawBody(req) {
  if (req.rawBody) {
    return Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(String(req.rawBody), "utf8");
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === "string") {
    return Buffer.from(req.body, "utf8");
  }

  const chunks = [];

  try {
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  } catch {
    // In alcuni ambienti Vercel il body è già stato letto e non è più streammabile.
  }

  if (chunks.length > 0) {
    return Buffer.concat(chunks);
  }

  if (req.body && typeof req.body === "object") {
    return Buffer.from(JSON.stringify(req.body), "utf8");
  }

  return Buffer.from("");
}

function parsePayload(rawBody, req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  const text = rawBody.toString("utf8");

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isSafeTestFallbackEvent(event, secretKey) {
  if (!event || typeof event !== "object") return false;

  const isTestSecret = String(secretKey || "").trim().startsWith("sk_test_");
  const session = event?.data?.object;
  const eventType = String(event?.type || "");
  const sessionId = String(session?.id || "");

  return (
    isTestSecret &&
    event.livemode === false &&
    eventType.startsWith("checkout.session.") &&
    sessionId.startsWith("cs_test_")
  );
}

async function getVerifiedOrSafeTestEvent({ stripe, req, rawBody, signature, webhookSecret }) {
  try {
    return {
      event: stripe.webhooks.constructEvent(rawBody, signature, webhookSecret),
      verified: true,
      fallback: false,
    };
  } catch (error) {
    const parsedEvent = parsePayload(rawBody, req);
    const secretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();

    if (!isSafeTestFallbackEvent(parsedEvent, secretKey)) {
      console.error("Firma webhook Stripe non valida:", error);

      return {
        event: null,
        verified: false,
        fallback: false,
        error,
      };
    }

    const sessionId = String(parsedEvent.data.object.id || "");
    const liveSession = await stripe.checkout.sessions.retrieve(sessionId);

    if (
      !liveSession ||
      liveSession.id !== sessionId ||
      liveSession.livemode !== false ||
      !["paid", "unpaid", "no_payment_required"].includes(String(liveSession.payment_status || ""))
    ) {
      console.error("Fallback test Stripe rifiutato: sessione non verificabile.");

      return {
        event: null,
        verified: false,
        fallback: false,
        error,
      };
    }

    console.warn(
      "Firma webhook Stripe non valida, ma evento test verificato tramite Stripe API. Fallback valido solo con sk_test_ e cs_test_."
    );

    return {
      event: {
        ...parsedEvent,
        data: {
          ...parsedEvent.data,
          object: {
            ...parsedEvent.data.object,
            ...liveSession,
          },
        },
      },
      verified: false,
      fallback: true,
    };
  }
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
    const totalPrice = Number(booking.totalPrice || 0);
    const unitId = cleanText(session.metadata?.unitId || booking.unitId || "");
    const nights = getNightDates(booking.checkIn, booking.checkOut);

    const paymentCoversTotal =
      totalPrice > 0 && paidAmount >= Math.max(totalPrice - 0.01, 0);

    const nextPaymentStatus =
      ["full", "balance"].includes(paymentType) || paymentCoversTotal
        ? "paid"
        : "deposit_paid";
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
      paymentType,
      stripeSessionId: session.id,
      guestName: booking.guestName || cleanText(session.customer_details?.name),
      guestEmail: booking.guestEmail || cleanText(session.customer_details?.email || session.customer_email),
      guestPhone: booking.guestPhone || "",
      unitName: booking.unitName || "Gelone Lungomare",
      checkIn: booking.checkIn || "",
      checkOut: booking.checkOut || "",
      guests: booking.guests || "",
      nightsCount: booking.nightsCount || nights.length,
      totalPrice: booking.totalPrice || 0,
      depositAmount: booking.depositAmount || 0,
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
    const eventResult = await getVerifiedOrSafeTestEvent({
      stripe,
      req,
      rawBody,
      signature,
      webhookSecret,
    });

    if (!eventResult.event) {
      return res.status(400).json({
        ok: false,
        message: "Firma webhook Stripe non valida.",
      });
    }

    const event = eventResult.event;
    const adminDb = getFirebaseAdminDb();
    const session = event.data.object;

    let result = {
      received: true,
      ignored: true,
      type: event.type,
      verified: eventResult.verified,
      fallback: eventResult.fallback,
    };

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      result = await markBookingPaid(adminDb, session, event);

      if (result?.updated) {
        const paymentEmailResult = await sendPaymentReceivedEmail(result, session);
        result = {
          ...result,
          paymentEmailNotification: paymentEmailResult,
        };
      }
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
      verified: eventResult.verified,
      fallback: eventResult.fallback,
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
