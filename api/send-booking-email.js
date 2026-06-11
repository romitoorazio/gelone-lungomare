import { getFirebaseAdminAuth, getFirebaseAdminDb, FieldValue } from "./_firebaseAdmin.js";

const ADMIN_EMAILS = ["romitoorazio@gmail.com", "romitofrancesco1@gmail.com"].map((email) =>
  email.toLowerCase()
);

const NOTIFY_EMAIL = "info@gelone.it";

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

function getBearerToken(req) {
  const authorization = cleanText(req.headers.authorization || req.headers.Authorization);
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

async function verifyAdminRequest(req) {
  const token = getBearerToken(req);

  if (!token) {
    const error = new Error("Accesso admin richiesto.");
    error.statusCode = 401;
    throw error;
  }

  const decodedToken = await getFirebaseAdminAuth().verifyIdToken(token);
  const email = cleanText(decodedToken.email).toLowerCase();

  if (!ADMIN_EMAILS.includes(email)) {
    const error = new Error("Account non autorizzato.");
    error.statusCode = 403;
    throw error;
  }

  return { email, uid: decodedToken.uid };
}

function getSiteOrigin(req) {
  const configured = cleanText(process.env.PUBLIC_SITE_URL);
  if (configured) return configured.replace(/\/+$/, "");

  const host = req.headers["x-forwarded-host"] || req.headers.host || "www.gelone.it";
  const proto = req.headers["x-forwarded-proto"] || "https";
  return proto + "://" + host;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  const text = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text || "-";
  const [year, month, day] = text.split("-");
  return `${day}/${month}/${year}`;
}

function formatEuro(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "-";

  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(number);
}

function getNightsCount(checkIn, checkOut) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(checkIn || ""))) return 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(checkOut || ""))) return 0;

  const start = new Date(checkIn + "T00:00:00Z");
  const end = new Date(checkOut + "T00:00:00Z");
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);

  return nights > 0 ? nights : 0;
}

function buildHtmlEmail({ booking, unitName, origin, paymentUrl, welcomateUrl }) {
  const guestName = escapeHtml(booking.guestName || "ospite");
  const safeUnitName = escapeHtml(unitName || "Gelone Lungomare");
  const nights = getNightsCount(booking.checkIn, booking.checkOut);
  const nightsText = nights === 1 ? "1 notte" : `${nights} notti`;
  const logoUrl = origin + "/images/logo-gelone-header-senza-qrcode.png";

  const paymentBox = paymentUrl
    ? `
      <div style="margin:26px 0;padding:22px;border-radius:18px;background:#0a1d35;text-align:center;">
        <p style="margin:0 0 14px;color:#fff;font-size:16px;">Puoi completare il pagamento in modo sicuro dal link seguente.</p>
        <a href="${escapeHtml(paymentUrl)}" style="display:inline-block;background:#f5c84b;color:#0a1d35;text-decoration:none;font-weight:800;padding:14px 24px;border-radius:999px;">Paga in modo sicuro</a>
      </div>`
    : `
      <div style="margin:26px 0;padding:20px;border-radius:18px;background:#faf6ee;border:1px solid #eadcc5;color:#0a1d35;">
        La struttura ti invierà le indicazioni per il pagamento, se dovuto.
      </div>`;

  const welcomateRow = welcomateUrl
    ? `
      <tr>
        <td style="padding:10px 0;color:#6b5b46;">Check-in ospiti</td>
        <td style="padding:10px 0;text-align:right;"><a href="${escapeHtml(welcomateUrl)}" style="color:#0a1d35;font-weight:800;">Apri WelcoMate</a></td>
      </tr>`
    : "";

  return `<!doctype html>
<html>
<body style="margin:0;background:#f4efe6;font-family:Arial,Helvetica,sans-serif;color:#0a1d35;">
  <div style="max-width:720px;margin:0 auto;padding:28px 14px;">
    <div style="background:#fff;border-radius:28px;overflow:hidden;border:1px solid #e4d8c2;box-shadow:0 18px 60px rgba(10,29,53,0.10);">
      <div style="background:#0a1d35;padding:30px 24px;text-align:center;">
        <img src="${escapeHtml(logoUrl)}" alt="Gelone Lungomare" style="max-width:220px;width:70%;height:auto;margin:0 auto 18px;display:block;">
        <div style="color:#f5c84b;text-transform:uppercase;letter-spacing:0.16em;font-size:12px;font-weight:800;">Disponibilità confermata</div>
        <h1 style="margin:12px 0 0;color:#fff;font-family:Georgia,serif;font-size:32px;line-height:1.1;">La tua richiesta è stata confermata</h1>
      </div>

      <div style="padding:30px 26px;">
        <p style="font-size:18px;line-height:1.7;margin:0 0 18px;">Ciao <strong>${guestName}</strong>,</p>
        <p style="font-size:16px;line-height:1.75;margin:0 0 22px;color:#4f5b67;">
          Abbiamo verificato la disponibilità e la tua richiesta per <strong>${safeUnitName}</strong> è confermata dalla struttura.
        </p>

        <div style="border:1px solid #e4d8c2;border-radius:22px;overflow:hidden;margin:24px 0;">
          <div style="background:#faf6ee;padding:16px 18px;font-weight:900;color:#9b6b25;text-transform:uppercase;letter-spacing:0.08em;font-size:12px;">Riepilogo soggiorno</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:15px;">
            <tr><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Alloggio</td><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">${safeUnitName}</td></tr>
            <tr><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Arrivo</td><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">${escapeHtml(formatDate(booking.checkIn))}</td></tr>
            <tr><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Partenza</td><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">${escapeHtml(formatDate(booking.checkOut))}</td></tr>
            <tr><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Durata</td><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">${escapeHtml(nightsText)}</td></tr>
            <tr><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Ospiti</td><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">${escapeHtml(booking.guests || "-")}</td></tr>
            <tr><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Totale</td><td style="padding:14px 18px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">${escapeHtml(formatEuro(booking.totalPrice))}</td></tr>
            <tr><td style="padding:14px 18px;color:#6b5b46;">Caparra</td><td style="padding:14px 18px;text-align:right;font-weight:800;">${escapeHtml(formatEuro(booking.depositAmount))}</td></tr>
          </table>
        </div>

        ${paymentBox}

        <div style="border:1px solid #e4d8c2;border-radius:18px;padding:18px;margin:24px 0;">
          <h2 style="font-size:18px;margin:0 0 12px;color:#0a1d35;">Informazioni utili</h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:15px;">
            ${welcomateRow}
            <tr><td style="padding:10px 0;color:#6b5b46;">WhatsApp</td><td style="padding:10px 0;text-align:right;"><a href="https://wa.me/393476308456" style="color:#0a1d35;font-weight:800;">3476308456</a></td></tr>
            <tr><td style="padding:10px 0;color:#6b5b46;">Email</td><td style="padding:10px 0;text-align:right;"><a href="mailto:info@gelone.it" style="color:#0a1d35;font-weight:800;">info@gelone.it</a></td></tr>
          </table>
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
}

function buildTextEmail({ booking, unitName, paymentUrl, welcomateUrl }) {
  const nights = getNightsCount(booking.checkIn, booking.checkOut);
  const nightsText = nights === 1 ? "1 notte" : `${nights} notti`;

  return [
    `Ciao ${booking.guestName || "ospite"},`,
    "",
    `Abbiamo verificato la disponibilità e la tua richiesta per ${unitName} è confermata dalla struttura.`,
    "",
    "Riepilogo soggiorno:",
    `Arrivo: ${formatDate(booking.checkIn)}`,
    `Partenza: ${formatDate(booking.checkOut)}`,
    `Durata: ${nightsText}`,
    `Ospiti: ${booking.guests || "-"}`,
    `Totale: ${formatEuro(booking.totalPrice)}`,
    `Caparra: ${formatEuro(booking.depositAmount)}`,
    "",
    paymentUrl ? `Pagamento sicuro: ${paymentUrl}` : "Per il pagamento riceverai indicazioni dalla struttura.",
    welcomateUrl ? `Check-in ospiti / WelcoMate: ${welcomateUrl}` : "",
    "",
    "Grazie,",
    "Gelone Lungomare",
  ].filter(Boolean).join("\n");
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Metodo non consentito." });
  }

  try {
    const adminUser = await verifyAdminRequest(req);
    const adminDb = getFirebaseAdminDb();
    const body = getBody(req);

    const bookingId = cleanText(body.bookingId);
    const emailType = cleanText(body.emailType || "availability_confirmed");

    if (!bookingId) {
      return res.status(400).json({ ok: false, message: "Booking ID mancante." });
    }

    const bookingRef = adminDb.collection("bookings").doc(bookingId);
    const bookingSnapshot = await bookingRef.get();

    if (!bookingSnapshot.exists) {
      return res.status(404).json({ ok: false, message: "Prenotazione non trovata." });
    }

    const booking = { id: bookingSnapshot.id, ...bookingSnapshot.data() };
    const guestEmail = cleanText(booking.guestEmail);

    if (!guestEmail) {
      return res.status(400).json({ ok: false, message: "Email ospite mancante." });
    }

    const resendApiKey = cleanText(process.env.RESEND_API_KEY);
    const emailFrom = cleanText(process.env.EMAIL_FROM) || "Gelone Lungomare <onboarding@resend.dev>";

    if (!resendApiKey) {
      return res.status(500).json({ ok: false, message: "RESEND_API_KEY non configurata su Vercel." });
    }

    const unitName = cleanText(booking.unitName) || "Gelone Lungomare";
    const origin = getSiteOrigin(req);

    const unitId = cleanText(booking.unitId || "lunarossa1");
    const privateSettingsDocId = unitId === "lunarossa1" ? "pms" : unitId;
    const privateSettingsSnapshot = await adminDb.collection("privateSettings").doc(privateSettingsDocId).get();
    const privateSettings = privateSettingsSnapshot.exists ? privateSettingsSnapshot.data() : {};

    const paymentUrl = cleanText(booking.paymentCheckoutUrl);
    const welcomateUrl = cleanText(privateSettings.welcomateUrl);

    const subject =
      emailType === "availability_confirmed"
        ? "Disponibilità confermata - " + unitName
        : "Comunicazione prenotazione - " + unitName;

    const html = buildHtmlEmail({ booking, unitName, origin, paymentUrl, welcomateUrl });
    const text = buildTextEmail({ booking, unitName, paymentUrl, welcomateUrl });

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + resendApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [guestEmail],
        bcc: [NOTIFY_EMAIL],
        subject,
        html,
        text,
      }),
    });

    const responseText = await emailResponse.text().catch(() => "");
    let responseData = null;

    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseData = null;
    }

    if (!emailResponse.ok) {
      await adminDb.collection("maintenanceLogs").add({
        type: "admin_activity",
        action: "professional_email_failed",
        unitId: booking.unitId || "",
        unitName,
        bookingId: booking.id,
        guestName: booking.guestName || "",
        guestEmail,
        guestPhone: booking.guestPhone || "",
        checkIn: booking.checkIn || "",
        checkOut: booking.checkOut || "",
        status: booking.status || "",
        paymentStatus: booking.paymentStatus || "",
        adminEmail: adminUser.email,
        details: {
          emailType,
          reason: responseText || "Errore invio Resend",
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      return res.status(502).json({
        ok: false,
        message: "Email non inviata: errore dal servizio email.",
        reason: responseText,
      });
    }

    await bookingRef.update({
      lastProfessionalEmailType: emailType,
      lastProfessionalEmailTo: guestEmail,
      lastProfessionalEmailId: responseData?.id || "",
      lastProfessionalEmailSentAt: FieldValue.serverTimestamp(),
      lastProfessionalEmailSentBy: adminUser.email,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("maintenanceLogs").add({
      type: "admin_activity",
      action: "professional_email_sent",
      unitId: booking.unitId || "",
      unitName,
      bookingId: booking.id,
      guestName: booking.guestName || "",
      guestEmail,
      guestPhone: booking.guestPhone || "",
      checkIn: booking.checkIn || "",
      checkOut: booking.checkOut || "",
      status: booking.status || "",
      paymentStatus: booking.paymentStatus || "",
      adminEmail: adminUser.email,
      details: {
        emailType,
        emailTo: guestEmail,
        emailId: responseData?.id || "",
        bcc: NOTIFY_EMAIL,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      ok: true,
      bookingId: booking.id,
      emailType,
      emailTo: guestEmail,
      emailId: responseData?.id || "",
      message: "Email professionale inviata correttamente.",
    });
  } catch (error) {
    console.error("Errore send-booking-email:", error);

    return res.status(error?.statusCode || 500).json({
      ok: false,
      message: error?.message || "Errore tecnico durante invio email.",
    });
  }
}
