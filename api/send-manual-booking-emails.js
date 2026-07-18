import { getFirebaseAdminDb } from "./_firebaseAdmin.js";
import { getBody, json, requireAdmin, sendBookingConfirmationEmail } from "./_bookingGuestEmails.js";

const INTERNAL_RECIPIENTS = ["info@gelone.it", "romitofrancesco1@gmail.com"];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text || "-";
  const [year, month, day] = text.split("-");
  return `${day}/${month}/${year}`;
}

function formatEuro(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "-";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);
}

function nightsCount(booking) {
  if (Number(booking.nightsCount || 0) > 0) return Number(booking.nightsCount);
  const start = new Date(`${booking.checkIn}T00:00:00Z`);
  const end = new Date(`${booking.checkOut}T00:00:00Z`);
  const count = Math.round((end - start) / 86400000);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

async function sendInternalEmail(booking) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY non configurata." };

  const from = process.env.EMAIL_FROM || "Gelone Lungomare <onboarding@resend.dev>";
  const unitName = booking.unitName || booking.unitId || "Gelone Lungomare";
  const nights = nightsCount(booking);
  const phoneDigits = String(booking.guestPhone || "").replace(/\D/g, "");
  const subject = `Nuova prenotazione inserita - ${unitName}`;
  const text = [
    "Nuova prenotazione inserita nel PMS Gelone Lungomare.",
    "",
    `Alloggio: ${unitName}`,
    `Ospite: ${booking.guestName || "-"}`,
    `Email: ${booking.guestEmail || "-"}`,
    `Telefono: ${booking.guestPhone || "-"}`,
    `Arrivo: ${formatDate(booking.checkIn)}`,
    `Partenza: ${formatDate(booking.checkOut)}`,
    `Notti: ${nights || "-"}`,
    `Totale: ${formatEuro(booking.totalPrice)}`,
    `Caparra: ${formatEuro(booking.depositAmount)}`,
    `Pagamento: ${booking.paymentStatus || "unpaid"}`,
    "",
    "Apri il PMS: https://www.gelone.it/admin",
  ].join("\n");

  const rows = [
    ["Alloggio", unitName],
    ["Ospite", booking.guestName || "-"],
    ["Email", booking.guestEmail || "-"],
    ["Telefono", booking.guestPhone || "-"],
    ["Arrivo", formatDate(booking.checkIn)],
    ["Partenza", formatDate(booking.checkOut)],
    ["Durata", nights ? `${nights} ${nights === 1 ? "notte" : "notti"}` : "-"],
    ["Totale", formatEuro(booking.totalPrice)],
    ["Caparra", formatEuro(booking.depositAmount)],
    ["Pagamento", booking.paymentStatus || "unpaid"],
  ].map(([label, value]) => `<tr><td style="padding:13px 16px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">${escapeHtml(label)}</td><td style="padding:13px 16px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;color:#0a1d35;">${escapeHtml(value)}</td></tr>`).join("");

  const callButton = phoneDigits
    ? `<a href="tel:+39${phoneDigits.startsWith("39") ? phoneDigits.slice(2) : phoneDigits}" style="display:inline-block;margin:8px 6px;padding:13px 20px;border-radius:999px;background:#15803d;color:#fff;text-decoration:none;font-weight:800;">Chiama ospite</a>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f4efe6;font-family:Arial,Helvetica,sans-serif;color:#0a1d35;"><div style="max-width:720px;margin:0 auto;padding:28px 14px;"><div style="background:#fff;border-radius:28px;overflow:hidden;border:1px solid #e4d8c2;box-shadow:0 18px 60px rgba(10,29,53,.10);"><div style="background:#0a1d35;padding:30px 24px;text-align:center;"><div style="color:#f5c84b;text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:800;">Gelone Lungomare · PMS</div><h1 style="margin:12px 0 0;color:#fff;font-family:Georgia,serif;font-size:31px;">Nuova prenotazione</h1><p style="margin:12px 0 0;color:#dbe6f4;">Inserita correttamente nel calendario</p></div><div style="padding:28px 24px;"><div style="border:1px solid #e4d8c2;border-radius:22px;overflow:hidden;"><div style="background:#faf6ee;padding:16px 18px;font-weight:900;color:#9b6b25;text-transform:uppercase;letter-spacing:.08em;font-size:12px;">Riepilogo operativo</div><table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:15px;">${rows}</table></div><div style="text-align:center;margin:24px 0;">${callButton}<a href="https://www.gelone.it/admin" style="display:inline-block;margin:8px 6px;padding:13px 20px;border-radius:999px;background:#0a1d35;color:#fff;text-decoration:none;font-weight:800;">Apri il PMS</a></div><p style="font-size:12px;color:#8a7a66;text-align:center;">Comunicazione automatica riservata allo staff.</p></div></div></div></body></html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: INTERNAL_RECIPIENTS, reply_to: "info@gelone.it", subject, text, html }),
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => "Errore invio email interna.");
    return { sent: false, reason };
  }
  return { sent: true, recipients: INTERNAL_RECIPIENTS };
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") return json(res, 405, { ok: false, message: "Metodo non consentito." });

  try {
    const admin = await requireAdmin(req);
    const body = getBody(req);
    const bookingId = String(body.bookingId || "").trim();
    if (!bookingId) return json(res, 400, { ok: false, message: "ID prenotazione mancante." });

    const db = getFirebaseAdminDb();
    const snapshot = await db.collection("bookings").doc(bookingId).get();
    if (!snapshot.exists) return json(res, 404, { ok: false, message: "Prenotazione non trovata." });
    const booking = { id: snapshot.id, ...snapshot.data() };

    const guestEmailNotification = booking.guestEmail
      ? await sendBookingConfirmationEmail({ bookingId, adminEmail: admin.email })
      : { sent: false, reason: "Email ospite mancante." };
    const internalEmailNotification = await sendInternalEmail(booking);

    return json(res, 200, { ok: true, guestEmailNotification, internalEmailNotification });
  } catch (error) {
    console.error("Errore send-manual-booking-emails:", error);
    return json(res, error?.statusCode || 500, { ok: false, message: error?.message || "Errore invio email prenotazione." });
  }
}
