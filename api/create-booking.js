import crypto from "crypto";
import { getFirebaseAdminDb, FieldValue } from "./_firebaseAdmin.js";
import { DEFAULT_UNIT_ID, bookingUnitId, getPublicUnitConfig } from "./_units.js";
import { calculateServerBookingPricing } from "./_pricing.js";

const NOTIFY_EMAIL = "info@gelone.it";
const PENDING_REQUEST_HOLD_HOURS = 24;

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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(req.headers["x-real-ip"] || req.socket?.remoteAddress || "").trim();
}

function hashRateLimitKey(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex")
    .slice(0, 32);
}

function createPublicPaymentToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashPublicPaymentToken(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

function normalizePhoneKey(value) {
  return String(value || "").replace(/\D/g, "");
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function enforceBookingRateLimit(adminDb, req, { guestEmail, guestPhone }) {
  const day = getTodayKey();
  const ip = getClientIp(req);

  const entries = [
    { kind: "ip", key: ip, limit: 8 },
    { kind: "email", key: cleanText(guestEmail).toLowerCase(), limit: 3 },
    { kind: "phone", key: normalizePhoneKey(guestPhone), limit: 3 },
  ].filter((entry) => entry.key);

  await adminDb.runTransaction(async (transaction) => {
    const rows = [];

    for (const entry of entries) {
      const ref = adminDb
        .collection("bookingRateLimits")
        .doc(`${day}_${entry.kind}_${hashRateLimitKey(entry.key)}`);

      const snapshot = await transaction.get(ref);
      const count = Number(snapshot.data()?.count || 0);

      if (count >= entry.limit) {
        throw new Error("TOO_MANY_BOOKING_REQUESTS");
      }

      rows.push({ ref, entry, count, exists: snapshot.exists });
    }

    rows.forEach(({ ref, entry, count, exists }) => {
      transaction.set(
        ref,
        {
          day,
          kind: entry.kind,
          count: count + 1,
          limit: entry.limit,
          updatedAt: FieldValue.serverTimestamp(),
          ...(exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        },
        { merge: true }
      );
    });
  });
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

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return null;
}

function isExpiredPending(data) {
  const status = String(data?.status || "").toLowerCase();

  if (!["pending_direct", "pending", "pending_payment"].includes(status)) {
    return false;
  }

  const expiresAtMillis = toMillis(data?.expiresAt);
  return Boolean(expiresAtMillis && expiresAtMillis <= Date.now());
}

function isActiveStatusForData(data) {
  if (isExpiredPending(data)) return false;
  return isActiveStatus(data?.status);
}

function isActiveStatus(status) {
  const value = String(status || "").toLowerCase();
  return !["cancelled", "canceled", "deleted", "available", "rejected", "declined"].includes(value);
}

function bookingBelongsToUnit(data, unitId) {
  return bookingUnitId(data) === unitId;
}

function bookingOverlaps(data, checkIn, checkOut) {
  const bookingCheckIn = String(data?.checkIn || "").trim();
  const bookingCheckOut = String(data?.checkOut || "").trim();

  if (!isValidDate(bookingCheckIn) || !isValidDate(bookingCheckOut)) {
    return false;
  }

  return bookingCheckIn < checkOut && bookingCheckOut > checkIn;
}

async function hasBookingConflict(adminDb, unitId, checkIn, checkOut) {
  const snapshot = await adminDb.collection("bookings").get();
  let conflict = false;

  snapshot.forEach((doc) => {
    if (conflict) return;

    const data = doc.data();

    if (bookingBelongsToUnit(data, unitId) && isActiveStatusForData(data) && bookingOverlaps(data, checkIn, checkOut)) {
      conflict = true;
    }
  });

  return conflict;
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

function escapeHtmlForEmail(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendEmailViaResend({ to, subject, text, html }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || "Gelone Lungomare <onboarding@resend.dev>";

  if (!resendApiKey) {
    return { sent: false, reason: "RESEND_API_KEY non configurata." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: emailFrom, to: Array.isArray(to) ? to : [to], subject, text, html }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return { sent: false, reason: errorText || "Errore invio email." };
  }

  return { sent: true };
}

async function sendNotificationEmail(booking, unit) {
  const unitName = unit.publicName || unit.name || "Gelone Lungomare";
  const subject = `Nuova richiesta prenotazione ${unitName}`;
  const text = `
Nuova richiesta prenotazione ricevuta dal sito.

Struttura: ${unitName}
Nome ospite: ${booking.guestName}
Email ospite: ${booking.guestEmail || "-"}
Telefono ospite: ${booking.guestPhone || "-"}
Arrivo: ${formatDateForEmail(booking.checkIn)}
Partenza: ${formatDateForEmail(booking.checkOut)}
Ospiti: ${booking.guests}
Notti: ${booking.nightsCount}
Totale calcolato dal server: ${formatEuroForEmail(booking.totalPrice)}
Caparra calcolata dal server: ${formatEuroForEmail(booking.depositAmount)}
Note: ${booking.notes || "-"}

Stato: ${booking.status}
Origine: ${booking.source}
Booking ID: ${booking.bookingId}

Controlla il PMS admin:
https://www.gelone.it/admin
`.trim();

  return sendEmailViaResend({ to: NOTIFY_EMAIL, subject, text });
}

async function sendGuestRequestEmail(booking, unit) {
  if (!booking.guestEmail) {
    return { sent: false, reason: "Email ospite mancante." };
  }

  const unitName = unit.publicName || unit.name || "Gelone Lungomare";
  const nightsCount = Number(booking.nightsCount || 0);
  const nightsText = nightsCount === 1 ? "1 notte" : `${nightsCount} notti`;
  const holdExpiresAt = booking.holdExpiresAt
    ? new Date(booking.holdExpiresAt).toLocaleString("it-IT", {
        timeZone: "Europe/Rome",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "entro 24 ore";

  const safeGuestName = escapeHtmlForEmail(booking.guestName || "ospite");
  const safeUnitName = escapeHtmlForEmail(unitName);
  const safeCheckIn = escapeHtmlForEmail(formatDateForEmail(booking.checkIn));
  const safeCheckOut = escapeHtmlForEmail(formatDateForEmail(booking.checkOut));
  const safeNightsText = escapeHtmlForEmail(nightsText);
  const safeGuests = escapeHtmlForEmail(booking.guests || "-");
  const safeTotal = escapeHtmlForEmail(formatEuroForEmail(booking.totalPrice));
  const safeDeposit = escapeHtmlForEmail(formatEuroForEmail(booking.depositAmount));
  const safeHoldExpiresAt = escapeHtmlForEmail(holdExpiresAt);

  const subject = `Richiesta ricevuta - ${unitName}`;
  const text = `
Ciao ${booking.guestName},

abbiamo ricevuto la tua richiesta di prenotazione per ${unitName}.

Riepilogo richiesta:
- Arrivo: ${formatDateForEmail(booking.checkIn)}
- Partenza: ${formatDateForEmail(booking.checkOut)}
- Durata: ${nightsText}
- Ospiti: ${booking.guests}
- Totale stimato: ${formatEuroForEmail(booking.totalPrice)}
- Caparra indicativa: ${formatEuroForEmail(booking.depositAmount)}

La richiesta è in attesa di conferma da parte della struttura. Le date possono restare bloccate temporaneamente fino a: ${holdExpiresAt}.

Privacy e condizioni: hai dichiarato di aver letto e accettato Privacy Policy, Cookie Policy e Termini e condizioni.

Contatti:
Telefono / WhatsApp: 3476308456
Telefono: 3479461999
Email: info@gelone.it
Sito: https://www.gelone.it

Grazie,
Gelone Lungomare
`.trim();

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4efe6;font-family:Arial,Helvetica,sans-serif;color:#0a1d35;">
    <div style="max-width:720px;margin:0 auto;padding:28px 14px;">
      <div style="background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #e4d8c2;box-shadow:0 18px 60px rgba(10,29,53,0.10);">
        <div style="background:#0a1d35;padding:30px 24px;text-align:center;">
          <div style="color:#f5c84b;text-transform:uppercase;letter-spacing:0.16em;font-size:12px;font-weight:800;">Gelone Lungomare</div>
          <h1 style="margin:12px 0 0;color:#ffffff;font-family:Georgia,serif;font-size:32px;line-height:1.1;">Richiesta ricevuta</h1>
          <p style="margin:14px auto 0;color:#dbe6f4;font-size:15px;line-height:1.6;max-width:520px;">Abbiamo ricevuto la tua richiesta e la struttura la controllerà al più presto.</p>
        </div>
        <div style="padding:30px 26px;">
          <p style="font-size:18px;line-height:1.7;margin:0 0 18px;">Ciao <strong>${safeGuestName}</strong>,</p>
          <p style="font-size:16px;line-height:1.75;margin:0 0 22px;color:#4f5b67;">Grazie per la richiesta di prenotazione per <strong>${safeUnitName}</strong>. Le date risultano bloccate temporaneamente in attesa di conferma da parte della struttura.</p>
          <div style="border:1px solid #e4d8c2;border-radius:22px;overflow:hidden;margin:24px 0;">
            <div style="background:#faf6ee;padding:16px 18px;font-weight:900;color:#9b6b25;text-transform:uppercase;letter-spacing:0.08em;font-size:12px;">Riepilogo richiesta</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:15px;">
              <tr><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Alloggio</td><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">${safeUnitName}</td></tr>
              <tr><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Arrivo</td><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">${safeCheckIn}</td></tr>
              <tr><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Partenza</td><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">${safeCheckOut}</td></tr>
              <tr><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Durata</td><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">${safeNightsText}</td></tr>
              <tr><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Ospiti</td><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">${safeGuests}</td></tr>
              <tr><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Totale stimato</td><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">${safeTotal}</td></tr>
              <tr><td style="padding:14px 18px;color:#6b5b46;">Caparra indicativa</td><td style="padding:14px 18px;text-align:right;font-weight:800;">${safeDeposit}</td></tr>
            </table>
          </div>
          <div style="margin:26px 0;padding:20px;border-radius:18px;background:#0a1d35;color:#ffffff;">
            <strong style="color:#f5c84b;">Stato della richiesta</strong><br>
            <span style="line-height:1.7;">La richiesta è in attesa di conferma. Le date possono restare bloccate temporaneamente fino a: <strong>${safeHoldExpiresAt}</strong>.</span>
          </div>
          <div style="font-size:13px;line-height:1.65;color:#6b5b46;background:#faf6ee;border-radius:18px;padding:18px;">
            <strong style="color:#0a1d35;">Condizioni cancellazione prenotazioni dirette</strong><br>
            Rimborso totale fino a 14 giorni prima del check-in. Da 13 a 7 giorni prima del check-in viene trattenuta la caparra confirmatoria. Negli ultimi 6 giorni, no-show o partenza anticipata: importi non rimborsabili salvo diverso accordo scritto.
          </div>
          <p style="margin:26px 0 0;font-size:16px;line-height:1.7;">Grazie,<br><strong>Gelone Lungomare</strong></p>
        </div>
      </div>
      <p style="text-align:center;color:#8a7a66;font-size:12px;margin:18px 0 0;">Gelone Lungomare · Via Pascoli 1 · 93012 Gela (CL)</p>
    </div>
  </body>
</html>`;

  return sendEmailViaResend({ to: booking.guestEmail, subject, text, html });
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Metodo non consentito." });
  }

  try {
    const adminDb = getFirebaseAdminDb();
    const body = getBody(req);

    const requestedUnitId = body.unitId || DEFAULT_UNIT_ID;
    const unit = await getPublicUnitConfig(adminDb, requestedUnitId);

    if (!unit) {
      return res.status(404).json({ ok: false, message: "Unità non disponibile sul sito pubblico." });
    }

    const unitId = unit.id;
    const unitName = unit.publicName || unit.name;
    const guestName = cleanText(body.guestName);
    const guestEmail = cleanText(body.guestEmail);
    const guestPhone = cleanText(body.guestPhone);
    const checkIn = cleanText(body.checkIn);
    const checkOut = cleanText(body.checkOut);
    const notes = cleanText(body.notes);
    const guests = Number(body.guests || 1);
    const botTrap = cleanText(body.website || body.company || body.url);
    const privacyAccepted = body.privacyAccepted === true;
    const termsAccepted = body.termsAccepted === true;
    const cookiePolicyAccepted = body.cookiePolicyAccepted === true;
    const legalAcceptedAtClient = cleanText(body.legalAcceptedAt);
    const privacyVersion = cleanText(body.privacyVersion || "2026-05-16");
    const termsVersion = cleanText(body.termsVersion || "2026-05-16");
    const cookieVersion = cleanText(body.cookieVersion || "2026-05-16");

    if (botTrap) {
      return res.status(400).json({ ok: false, message: "Richiesta non valida." });
    }

    if (!privacyAccepted || !termsAccepted || !cookiePolicyAccepted) {
      return res.status(400).json({
        ok: false,
        message: "Accetta Privacy Policy, Cookie Policy e Termini prima di continuare.",
      });
    }

    if (!guestName) {
      return res.status(400).json({ ok: false, message: "Inserisci nome e cognome." });
    }

    if (!guestEmail) {
      return res.status(400).json({ ok: false, message: "Inserisci email." });
    }

    if (!isValidEmail(guestEmail)) {
      return res.status(400).json({ ok: false, message: "Inserisci un indirizzo email valido." });
    }

    if (!guestPhone) {
      return res.status(400).json({ ok: false, message: "Inserisci telefono." });
    }

    if (!isValidPhone(guestPhone)) {
      return res.status(400).json({ ok: false, message: "Inserisci un numero di telefono valido." });
    }

    await enforceBookingRateLimit(adminDb, req, { guestEmail, guestPhone });

    if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
      return res.status(400).json({ ok: false, message: "Inserisci date valide." });
    }

    if (checkOut <= checkIn) {
      return res.status(400).json({
        ok: false,
        message: "La data di partenza deve essere successiva alla data di arrivo.",
      });
    }

    if (!Number.isFinite(guests) || guests < 1 || guests > Number(unit.maxGuests || 2)) {
      return res.status(400).json({
        ok: false,
        message: `${unitName} può ospitare massimo ${unit.maxGuests || 2} persone.`,
      });
    }

    const nights = getNightDates(checkIn, checkOut);

    if (nights.length < 1) {
      return res.status(400).json({ ok: false, message: "Devi selezionare almeno una notte." });
    }

    if (nights.length > 60) {
      return res.status(400).json({
        ok: false,
        message: "Per soggiorni superiori a 60 notti contatta la struttura.",
      });
    }

    const serverPricing = await calculateServerBookingPricing(adminDb, unitId, nights.length);

    if (nights.length < serverPricing.minimumNights) {
      return res.status(400).json({
        ok: false,
        message: `Soggiorno minimo: ${serverPricing.minimumNights} ${serverPricing.minimumNights === 1 ? "notte" : "notti"}.`,
      });
    }

    // Controllo di sicurezza sulle prenotazioni: serve se una prenotazione esiste
    // in bookings ma mancano i relativi documenti nights.
    if (await hasBookingConflict(adminDb, unitId, checkIn, checkOut)) {
      throw new Error("DATES_NOT_AVAILABLE");
    }

    const bookingRef = adminDb.collection("bookings").doc();
    const pendingExpiresAt = new Date(Date.now() + PENDING_REQUEST_HOLD_HOURS * 60 * 60 * 1000);
    const publicPaymentToken = createPublicPaymentToken();
    const publicPaymentTokenHash = hashPublicPaymentToken(publicPaymentToken);

    const bookingData = {
      unitId,
      unitName,
      guestName,
      guestEmail,
      guestPhone,
      checkIn,
      checkOut,
      guests,
      source: "direct_site",
      status: "pending_direct",
      totalPrice: serverPricing.totalPrice,
      nightlyRate: serverPricing.nightlyRate,
      cleaningFee: serverPricing.cleaningFee,
      nightsCount: serverPricing.nightsCount,
      depositAmount: serverPricing.depositAmount,
      pricingCalculatedBy: serverPricing.pricingCalculatedBy,
      pricingSource: serverPricing.source,
      pricingSettingsDocId: serverPricing.settingsDocId,
      paymentStatus: "unpaid",
      welcomateStatus: "to_send",
      expiresAt: pendingExpiresAt,
      holdExpiresAt: pendingExpiresAt.toISOString(),
      holdExpiresHours: PENDING_REQUEST_HOLD_HOURS,
      publicPaymentTokenHash,
      publicPaymentTokenCreatedAt: FieldValue.serverTimestamp(),
      notes,
      privacyAccepted,
      termsAccepted,
      cookiePolicyAccepted,
      legalAcceptedAt: FieldValue.serverTimestamp(),
      legalAcceptance: {
        privacyAccepted,
        termsAccepted,
        cookiePolicyAccepted,
        privacyVersion,
        termsVersion,
        cookieVersion,
        acceptedAtClient: legalAcceptedAtClient,
        acceptedFrom: "public_site",
        userAgent: cleanText(req.headers["user-agent"]),
        ip: getClientIp(req),
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.runTransaction(async (transaction) => {
      const nightRefs = nights.map((night) => adminDb.collection("nights").doc(`${unitId}_${night}`));
      const nightSnapshots = [];

      for (const nightRef of nightRefs) {
        const nightSnapshot = await transaction.get(nightRef);
        nightSnapshots.push(nightSnapshot);
      }

      const occupiedNight = nightSnapshots.find((snapshot) => {
        if (!snapshot.exists) return false;
        const data = snapshot.data();
        return isActiveStatusForData(data);
      });

      if (occupiedNight) {
        throw new Error("DATES_NOT_AVAILABLE");
      }

      transaction.set(bookingRef, bookingData);

      nights.forEach((night) => {
        const nightRef = adminDb.collection("nights").doc(`${unitId}_${night}`);

        transaction.set(nightRef, {
          unitId,
          date: night,
          bookingId: bookingRef.id,
          status: "pending_direct",
          source: "direct_site",
          guestName,
          expiresAt: pendingExpiresAt,
          holdExpiresAt: pendingExpiresAt.toISOString(),
          holdExpiresHours: PENDING_REQUEST_HOLD_HOURS,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    });

    const savedBooking = { ...bookingData, bookingId: bookingRef.id };
    const emailResult = await sendNotificationEmail(savedBooking, unit);
    const guestEmailResult = await sendGuestRequestEmail(savedBooking, unit);

    return res.status(201).json({
      ok: true,
      bookingId: bookingRef.id,
      publicPaymentToken,
      unitId,
      unitName,
      checkIn,
      checkOut,
      nights,
      pricing: {
        totalPrice: serverPricing.totalPrice,
        nightlyRate: serverPricing.nightlyRate,
        cleaningFee: serverPricing.cleaningFee,
        nightsCount: serverPricing.nightsCount,
        depositAmount: serverPricing.depositAmount,
        calculatedBy: serverPricing.pricingCalculatedBy,
      },
      status: "pending_direct",
      message: `Richiesta ricevuta. Le date sono state bloccate nel sistema ${unitName} in attesa di conferma della struttura.`,
      emailNotification: emailResult,
      guestEmailNotification: guestEmailResult,
    });
  } catch (error) {
    console.error("Errore create-booking:", error);

    if (error?.message === "TOO_MANY_BOOKING_REQUESTS") {
      return res.status(429).json({
        ok: false,
        message: "Troppe richieste inviate. Contattaci direttamente su WhatsApp o riprova più tardi.",
      });
    }

    if (error?.message === "DATES_NOT_AVAILABLE") {
      return res.status(409).json({
        ok: false,
        message: "Le date selezionate non sono più disponibili. Prova altre date o contattaci su WhatsApp.",
      });
    }

    return res.status(500).json({
      ok: false,
      message: error?.message || "Errore tecnico durante la richiesta. Riprova più tardi o contattaci su WhatsApp.",
    });
  }
}
