import { FieldValue, getFirebaseAdminAuth, getFirebaseAdminDb } from "./_firebaseAdmin.js";
import { DEFAULT_UNIT_ID, bookingUnitId, getPublicUnitConfig } from "./_units.js";

const DEFAULT_ADMIN_EMAILS = ["romitoorazio@gmail.com", "romitofrancesco1@gmail.com"];
const DEFAULT_BRAND_NAME = "Gelone Lungomare";
const DEFAULT_PUBLIC_EMAIL = "info@gelone.it";
const DEFAULT_PUBLIC_PHONE = "3479461999";
const DEFAULT_PUBLIC_WHATSAPP = "3476308456";
const DEFAULT_PUBLIC_SITE_URL = "https://www.gelone.it";

export function json(res, status, payload) {
  return res.status(status).json(payload);
}

export function getBody(req) {
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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getAllowedAdminEmails() {
  const envEmails = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);

  return Array.from(
    new Set([...DEFAULT_ADMIN_EMAILS, ...envEmails].map(normalizeEmail).filter(Boolean))
  );
}

export async function requireAdmin(req) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!token) {
    const error = new Error("Token Firebase mancante.");
    error.statusCode = 401;
    throw error;
  }

  const adminAuth = getFirebaseAdminAuth();
  const decoded = await adminAuth.verifyIdToken(token);
  const email = normalizeEmail(decoded.email);
  const allowedEmails = getAllowedAdminEmails();

  if (!email || !allowedEmails.includes(email)) {
    const error = new Error("Utente non autorizzato.");
    error.statusCode = 403;
    throw error;
  }

  return {
    email,
    uid: decoded.uid || "",
  };
}

function formatDateForEmail(value) {
  const text = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text || "-";
  }

  const [year, month, day] = text.split("-");
  return `${day}/${month}/${year}`;
}

function getNightDates(checkIn, checkOut) {
  const nights = [];

  if (!checkIn || !checkOut) return nights;

  const [startYear, startMonth, startDay] = String(checkIn).split("-").map(Number);
  const [endYear, endMonth, endDay] = String(checkOut).split("-").map(Number);

  if (![startYear, startMonth, startDay, endYear, endMonth, endDay].every(Number.isFinite)) {
    return nights;
  }

  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  while (cursor < end) {
    nights.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return nights;
}

function getNightsText(booking) {
  const explicitNights = Number(booking?.nightsCount || booking?.nights || 0);
  const nights = Number.isFinite(explicitNights) && explicitNights > 0
    ? explicitNights
    : getNightDates(booking?.checkIn, booking?.checkOut).length;

  if (nights === 1) return "1 notte";
  if (nights > 1) return `${nights} notti`;
  return "-";
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

function escapeHtmlForEmail(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPublicContacts() {
  const publicEmail = String(process.env.PUBLIC_EMAIL || DEFAULT_PUBLIC_EMAIL).trim();
  const publicPhone = String(process.env.PUBLIC_PHONE || DEFAULT_PUBLIC_PHONE).trim();
  const publicWhatsapp = String(process.env.PUBLIC_WHATSAPP || DEFAULT_PUBLIC_WHATSAPP).trim();
  const publicSiteUrl = String(process.env.PUBLIC_SITE_URL || DEFAULT_PUBLIC_SITE_URL).trim();

  return {
    brandName: String(process.env.PUBLIC_BRAND_NAME || DEFAULT_BRAND_NAME).trim() || DEFAULT_BRAND_NAME,
    publicEmail,
    publicPhone,
    publicWhatsapp,
    publicWhatsappDigits: publicWhatsapp.replace(/\D/g, "").startsWith("39")
      ? publicWhatsapp.replace(/\D/g, "")
      : `39${publicWhatsapp.replace(/\D/g, "")}`,
    publicSiteUrl,
  };
}

async function loadBookingAndUnit(adminDb, bookingId) {
  const cleanBookingId = String(bookingId || "").trim();

  if (!cleanBookingId) {
    const error = new Error("ID prenotazione mancante.");
    error.statusCode = 400;
    throw error;
  }

  const bookingRef = adminDb.collection("bookings").doc(cleanBookingId);
  const bookingSnapshot = await bookingRef.get();

  if (!bookingSnapshot.exists) {
    const error = new Error("Prenotazione non trovata.");
    error.statusCode = 404;
    throw error;
  }

  const booking = {
    id: bookingSnapshot.id,
    ...bookingSnapshot.data(),
  };

  const unitId = bookingUnitId(booking) || DEFAULT_UNIT_ID;
  const unit = await getPublicUnitConfig(adminDb, unitId);

  return {
    bookingRef,
    booking,
    unit: unit || {
      id: unitId,
      name: booking.unitName || DEFAULT_BRAND_NAME,
      publicName: booking.unitName || DEFAULT_BRAND_NAME,
    },
  };
}

async function sendEmailWithResend({ to, subject, text, html }) {
  const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
  const contacts = getPublicContacts();
  const emailFrom =
    process.env.EMAIL_FROM || `${contacts.brandName} <onboarding@resend.dev>`;

  if (!resendApiKey) {
    return {
      sent: false,
      reason: "RESEND_API_KEY non configurata.",
    };
  }

  const emailTo = String(to || "").trim();

  if (!emailTo) {
    return {
      sent: false,
      reason: "Email ospite mancante.",
    };
  }

  const payload = {
    from: emailFrom,
    to: [emailTo],
    subject,
    text,
    html,
  };

  if (contacts.publicEmail) {
    payload.reply_to = contacts.publicEmail;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    return {
      sent: false,
      reason: errorText || "Errore invio email ospite.",
    };
  }

  const data = await response.json().catch(() => ({}));

  return {
    sent: true,
    provider: "resend",
    emailId: data?.id || "",
  };
}

function buildSummaryTableRows(booking, unitName, extraRows = "") {
  const rows = [
    ["Alloggio", unitName],
    ["Arrivo", formatDateForEmail(booking.checkIn)],
    ["Partenza", formatDateForEmail(booking.checkOut)],
    ["Durata", getNightsText(booking)],
    ["Ospiti", booking.guests || "-"],
    ["Totale", formatEuroForEmail(booking.totalPrice)],
    ["Caparra", formatEuroForEmail(booking.depositAmount)],
  ];

  return rows
    .map(([label, value]) => {
      const safeLabel = escapeHtmlForEmail(label);
      const safeValue = escapeHtmlForEmail(value);
      return `<tr><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">${safeLabel}</td><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">${safeValue}</td></tr>`;
    })
    .join("") + extraRows;
}

function buildEmailShell({ title, subtitle, preheader, childrenHtml }) {
  const contacts = getPublicContacts();
  const safeBrandName = escapeHtmlForEmail(contacts.brandName);
  const safeTitle = escapeHtmlForEmail(title);
  const safeSubtitle = escapeHtmlForEmail(subtitle);
  const safePreheader = escapeHtmlForEmail(preheader || subtitle);
  const safePublicPhone = escapeHtmlForEmail(contacts.publicPhone);
  const safePublicWhatsapp = escapeHtmlForEmail(contacts.publicWhatsapp);
  const safePublicEmail = escapeHtmlForEmail(contacts.publicEmail);
  const safePublicSiteUrl = escapeHtmlForEmail(contacts.publicSiteUrl);

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4efe6;font-family:Arial,Helvetica,sans-serif;color:#0a1d35;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safePreheader}</div>
    <div style="max-width:720px;margin:0 auto;padding:28px 14px;">
      <div style="background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #e4d8c2;box-shadow:0 18px 60px rgba(10,29,53,0.10);">
        <div style="background:#0a1d35;padding:30px 24px;text-align:center;">
          <div style="color:#f5c84b;text-transform:uppercase;letter-spacing:0.16em;font-size:12px;font-weight:800;">${safeBrandName}</div>
          <h1 style="margin:12px 0 0;color:#ffffff;font-family:Georgia,serif;font-size:32px;line-height:1.1;">${safeTitle}</h1>
          <p style="margin:14px auto 0;color:#dbe6f4;font-size:15px;line-height:1.6;max-width:520px;">${safeSubtitle}</p>
        </div>
        <div style="padding:30px 26px;">
          ${childrenHtml}
          <div style="border:1px solid #e4d8c2;border-radius:18px;padding:18px;margin:24px 0;">
            <h2 style="font-size:18px;margin:0 0 12px;color:#0a1d35;">Contatti</h2>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:15px;">
              <tr><td style="padding:10px 0;color:#6b5b46;">WhatsApp</td><td style="padding:10px 0;text-align:right;"><a href="https://wa.me/${contacts.publicWhatsappDigits}" style="color:#0a1d35;font-weight:800;">${safePublicWhatsapp}</a></td></tr>
              <tr><td style="padding:10px 0;color:#6b5b46;">Telefono</td><td style="padding:10px 0;text-align:right;"><a href="tel:+39${safePublicPhone.replace(/\D/g, "")}" style="color:#0a1d35;font-weight:800;">${safePublicPhone}</a></td></tr>
              <tr><td style="padding:10px 0;color:#6b5b46;">Email</td><td style="padding:10px 0;text-align:right;"><a href="mailto:${safePublicEmail}" style="color:#0a1d35;font-weight:800;">${safePublicEmail}</a></td></tr>
              <tr><td style="padding:10px 0;color:#6b5b46;">Sito</td><td style="padding:10px 0;text-align:right;"><a href="${safePublicSiteUrl}" style="color:#0a1d35;font-weight:800;">${safePublicSiteUrl}</a></td></tr>
            </table>
          </div>
          <p style="margin:26px 0 0;font-size:16px;line-height:1.7;">Cordiali saluti,<br><strong>${safeBrandName}</strong></p>
        </div>
      </div>
      <p style="text-align:center;color:#8a7a66;font-size:12px;margin:18px 0 0;">${safeBrandName} · Via Pascoli 1 · 93012 Gela (CL)</p>
    </div>
  </body>
</html>`;
}

export async function sendBookingConfirmationEmail({ bookingId, adminEmail }) {
  const adminDb = getFirebaseAdminDb();
  const { bookingRef, booking, unit } = await loadBookingAndUnit(adminDb, bookingId);
  const contacts = getPublicContacts();
  const unitName = unit.publicName || unit.name || contacts.brandName;

  if (!booking.guestEmail) {
    return {
      bookingId: booking.id,
      sent: false,
      reason: "Email ospite mancante.",
    };
  }

  const subject = `Prenotazione confermata - ${unitName}`;

  const text = `
Gentile ${booking.guestName || "ospite"},

la tua prenotazione presso ${unitName} è confermata.

Dettagli prenotazione:
- Arrivo: ${formatDateForEmail(booking.checkIn)}
- Partenza: ${formatDateForEmail(booking.checkOut)}
- Durata: ${getNightsText(booking)}
- Ospiti: ${booking.guests || "-"}
- Totale: ${formatEuroForEmail(booking.totalPrice)}
- Caparra: ${formatEuroForEmail(booking.depositAmount)}

Prima dell'arrivo potrebbe essere necessario completare la registrazione ospiti. La struttura ti invierà le istruzioni se richieste.

Per qualsiasi necessità puoi rispondere direttamente a questa email.

Contatti:
WhatsApp: ${contacts.publicWhatsapp}
Telefono: ${contacts.publicPhone}
Email: ${contacts.publicEmail}
Sito: ${contacts.publicSiteUrl}

Cordiali saluti,
${contacts.brandName}
`.trim();

  const safeGuestName = escapeHtmlForEmail(booking.guestName || "ospite");
  const safeUnitName = escapeHtmlForEmail(unitName);
  const html = buildEmailShell({
    title: "Prenotazione confermata",
    subtitle: "La tua prenotazione è stata confermata dalla struttura.",
    preheader: `Prenotazione confermata per ${unitName}`,
    childrenHtml: `
      <p style="font-size:18px;line-height:1.7;margin:0 0 18px;">Gentile <strong>${safeGuestName}</strong>,</p>
      <p style="font-size:16px;line-height:1.75;margin:0 0 22px;color:#4f5b67;">Ti confermiamo che la tua prenotazione presso <strong>${safeUnitName}</strong> è confermata.</p>
      <div style="border:1px solid #e4d8c2;border-radius:22px;overflow:hidden;margin:24px 0;">
        <div style="background:#faf6ee;padding:16px 18px;font-weight:900;color:#9b6b25;text-transform:uppercase;letter-spacing:0.08em;font-size:12px;">Riepilogo prenotazione</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:15px;">
          ${buildSummaryTableRows(booking, unitName)}
        </table>
      </div>
      <div style="margin:26px 0;padding:20px;border-radius:18px;background:#ecfdf3;color:#064e3b;border:1px solid #bbf7d0;">
        <strong>Conferma completata</strong><br>
        <span style="line-height:1.7;">La struttura ha confermato le date della tua prenotazione. Prima dell'arrivo potrai ricevere le istruzioni per la registrazione ospiti, se richiesta.</span>
      </div>
      <div style="font-size:13px;line-height:1.65;color:#6b5b46;background:#faf6ee;border-radius:18px;padding:18px;">
        <strong style="color:#0a1d35;">Condizioni cancellazione prenotazioni dirette</strong><br>
        Rimborso totale fino a 14 giorni prima del check-in. Da 13 a 7 giorni prima del check-in viene trattenuta la caparra confirmatoria. Negli ultimi 6 giorni, no-show o partenza anticipata: importi non rimborsabili salvo diverso accordo scritto.
      </div>
    `,
  });

  const emailResult = await sendEmailWithResend({
    to: booking.guestEmail,
    subject,
    text,
    html,
  });

  await bookingRef.set(
    {
      confirmationEmail: {
        ...emailResult,
        sentAt: emailResult.sent ? FieldValue.serverTimestamp() : null,
        attemptedAt: FieldValue.serverTimestamp(),
        sentBy: adminEmail || "",
      },
      confirmationEmailSent: Boolean(emailResult.sent),
      confirmationEmailSentAt: emailResult.sent ? FieldValue.serverTimestamp() : null,
      confirmationEmailLastError: emailResult.sent ? "" : emailResult.reason || "Email non inviata.",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    bookingId: booking.id,
    guestEmail: booking.guestEmail,
    ...emailResult,
  };
}

export async function sendBookingCancellationEmail({ bookingId, reason, adminEmail }) {
  const adminDb = getFirebaseAdminDb();
  const { bookingRef, booking, unit } = await loadBookingAndUnit(adminDb, bookingId);
  const contacts = getPublicContacts();
  const unitName = unit.publicName || unit.name || contacts.brandName;
  const cleanReason = String(reason || booking.cancellationReason || "Prenotazione annullata dalla struttura.").trim();

  if (!booking.guestEmail) {
    return {
      bookingId: booking.id,
      sent: false,
      reason: "Email ospite mancante.",
    };
  }

  const subject = `Prenotazione annullata - ${unitName}`;

  const text = `
Gentile ${booking.guestName || "ospite"},

ti confermiamo che la tua prenotazione presso ${unitName} è stata annullata.

Dettagli prenotazione annullata:
- Arrivo: ${formatDateForEmail(booking.checkIn)}
- Partenza: ${formatDateForEmail(booking.checkOut)}
- Durata: ${getNightsText(booking)}
- Ospiti: ${booking.guests || "-"}

Motivo annullamento:
${cleanReason}

Per qualsiasi chiarimento puoi rispondere direttamente a questa email.

Contatti:
WhatsApp: ${contacts.publicWhatsapp}
Telefono: ${contacts.publicPhone}
Email: ${contacts.publicEmail}
Sito: ${contacts.publicSiteUrl}

Cordiali saluti,
${contacts.brandName}
`.trim();

  const safeGuestName = escapeHtmlForEmail(booking.guestName || "ospite");
  const safeUnitName = escapeHtmlForEmail(unitName);
  const safeReason = escapeHtmlForEmail(cleanReason);
  const html = buildEmailShell({
    title: "Prenotazione annullata",
    subtitle: "La prenotazione indicata è stata annullata dalla struttura.",
    preheader: `Prenotazione annullata per ${unitName}`,
    childrenHtml: `
      <p style="font-size:18px;line-height:1.7;margin:0 0 18px;">Gentile <strong>${safeGuestName}</strong>,</p>
      <p style="font-size:16px;line-height:1.75;margin:0 0 22px;color:#4f5b67;">Ti confermiamo che la tua prenotazione presso <strong>${safeUnitName}</strong> è stata annullata.</p>
      <div style="border:1px solid #e4d8c2;border-radius:22px;overflow:hidden;margin:24px 0;">
        <div style="background:#faf6ee;padding:16px 18px;font-weight:900;color:#9b6b25;text-transform:uppercase;letter-spacing:0.08em;font-size:12px;">Riepilogo prenotazione annullata</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:15px;">
          ${buildSummaryTableRows(booking, unitName)}
        </table>
      </div>
      <div style="margin:26px 0;padding:20px;border-radius:18px;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;">
        <strong>Motivo annullamento</strong><br>
        <span style="line-height:1.7;">${safeReason}</span>
      </div>
      <p style="font-size:15px;line-height:1.7;color:#4f5b67;">Per qualsiasi chiarimento puoi rispondere direttamente a questa email.</p>
    `,
  });

  const emailResult = await sendEmailWithResend({
    to: booking.guestEmail,
    subject,
    text,
    html,
  });

  await bookingRef.set(
    {
      cancellationEmail: {
        ...emailResult,
        reason: cleanReason,
        sentAt: emailResult.sent ? FieldValue.serverTimestamp() : null,
        attemptedAt: FieldValue.serverTimestamp(),
        sentBy: adminEmail || "",
      },
      cancellationEmailSent: Boolean(emailResult.sent),
      cancellationEmailSentAt: emailResult.sent ? FieldValue.serverTimestamp() : null,
      cancellationEmailLastError: emailResult.sent ? "" : emailResult.reason || "Email non inviata.",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    bookingId: booking.id,
    guestEmail: booking.guestEmail,
    ...emailResult,
  };
}
