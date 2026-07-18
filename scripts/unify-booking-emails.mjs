import fs from "node:fs";

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

const adminPath = new URL("../src/Admin.jsx", import.meta.url);
let adminSource = fs.readFileSync(adminPath, "utf8");

const createStart = adminSource.indexOf("  async function createBooking(event) {");
const createEnd = adminSource.indexOf("\n  async function createBlock(event)", createStart);
ensure(createStart >= 0 && createEnd > createStart, "Funzione createBooking non trovata");
let createBlock = adminSource.slice(createStart, createEnd);

if (!createBlock.includes("/api/send-manual-booking-emails")) {
  const marker = "      setNewBooking({";
  ensure(createBlock.includes(marker), "Punto inserimento email prenotazione non trovato");
  const emailCode = `      let guestEmailResult = { sent: false, reason: "Email ospite mancante." };\n      let internalEmailResult = { sent: false, reason: "Invio non eseguito." };\n\n      try {\n        const token = await getIdToken(user, true);\n        const emailResponse = await fetch("/api/send-manual-booking-emails", {\n          method: "POST",\n          headers: {\n            Authorization: "Bearer " + token,\n            "Content-Type": "application/json",\n          },\n          body: JSON.stringify({ bookingId: bookingRef.id }),\n        });\n        const emailData = await emailResponse.json().catch(() => ({}));\n        if (emailResponse.ok && emailData?.ok) {\n          guestEmailResult = emailData.guestEmailNotification || guestEmailResult;\n          internalEmailResult = emailData.internalEmailNotification || internalEmailResult;\n        } else {\n          internalEmailResult = { sent: false, reason: emailData?.message || "Errore invio email." };\n        }\n      } catch (emailError) {\n        console.error("Errore email nuova prenotazione:", emailError);\n        internalEmailResult = { sent: false, reason: emailError?.message || "Errore tecnico invio email." };\n      }\n\n`;
  createBlock = createBlock.replace(marker, emailCode + marker);

  createBlock = createBlock.replace(
    '      setMessage("Prenotazione inserita e notti bloccate.");',
    `      const guestStatus = guestEmailResult?.sent\n        ? "Email professionale inviata all'ospite."\n        : newBooking.guestEmail\n          ? "Email ospite non inviata: " + (guestEmailResult?.reason || "motivo non disponibile")\n          : "Email ospite non inviata perché manca l'indirizzo.";\n      const internalStatus = internalEmailResult?.sent\n        ? "Notifica inviata a Orazio e Francesco."\n        : "Notifica interna non inviata: " + (internalEmailResult?.reason || "motivo non disponibile");\n      setMessage("Prenotazione inserita e notti bloccate. " + guestStatus + " " + internalStatus);`
  );

  adminSource = adminSource.slice(0, createStart) + createBlock + adminSource.slice(createEnd);
}

fs.writeFileSync(adminPath, adminSource, "utf8");

const bookingPath = new URL("../api/create-booking.js", import.meta.url);
let bookingSource = fs.readFileSync(bookingPath, "utf8");

bookingSource = bookingSource.replace(
  'const NOTIFY_EMAIL = "info@gelone.it";',
  'const NOTIFY_EMAILS = ["info@gelone.it", "romitofrancesco1@gmail.com"];'
);

bookingSource = bookingSource.replace(
  'return sendEmailViaResend({ to: NOTIFY_EMAIL, subject, text });',
  `const safeGuest = escapeHtmlForEmail(booking.guestName || "Ospite");\n  const safeUnit = escapeHtmlForEmail(unitName);\n  const safePhone = escapeHtmlForEmail(booking.guestPhone || "-");\n  const phoneDigits = String(booking.guestPhone || "").replace(/\\D/g, "");\n  const callButton = phoneDigits\n    ? '<a href="tel:+39' + (phoneDigits.startsWith("39") ? phoneDigits.slice(2) : phoneDigits) + '" style="display:inline-block;margin:8px 6px;padding:13px 20px;border-radius:999px;background:#15803d;color:#fff;text-decoration:none;font-weight:800;">Chiama ospite</a>'\n    : "";\n  const html = '<!doctype html><html><body style="margin:0;background:#f4efe6;font-family:Arial,Helvetica,sans-serif;color:#0a1d35;"><div style="max-width:720px;margin:0 auto;padding:28px 14px;"><div style="background:#fff;border-radius:28px;overflow:hidden;border:1px solid #e4d8c2;box-shadow:0 18px 60px rgba(10,29,53,.10);"><div style="background:#0a1d35;padding:30px 24px;text-align:center;"><div style="color:#f5c84b;text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:800;">Gelone Lungomare · PMS</div><h1 style="margin:12px 0 0;color:#fff;font-family:Georgia,serif;font-size:31px;">Nuova richiesta dal sito</h1><p style="margin:12px 0 0;color:#dbe6f4;">È stata ricevuta una nuova richiesta di prenotazione</p></div><div style="padding:28px 24px;"><h2 style="margin:0 0 8px;">' + safeGuest + '</h2><p style="margin:0 0 20px;color:#6b5b46;">' + safeUnit + '</p><div style="border:1px solid #e4d8c2;border-radius:22px;overflow:hidden;"><table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:15px;"><tr><td style="padding:13px 16px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Telefono</td><td style="padding:13px 16px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">' + safePhone + '</td></tr><tr><td style="padding:13px 16px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Arrivo</td><td style="padding:13px 16px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">' + escapeHtmlForEmail(formatDateForEmail(booking.checkIn)) + '</td></tr><tr><td style="padding:13px 16px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Partenza</td><td style="padding:13px 16px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">' + escapeHtmlForEmail(formatDateForEmail(booking.checkOut)) + '</td></tr><tr><td style="padding:13px 16px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Notti</td><td style="padding:13px 16px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">' + escapeHtmlForEmail(booking.nightsCount || "-") + '</td></tr><tr><td style="padding:13px 16px;border-bottom:1px solid #f0e6d5;color:#6b5b46;">Totale</td><td style="padding:13px 16px;border-bottom:1px solid #f0e6d5;text-align:right;font-weight:800;">' + escapeHtmlForEmail(formatEuroForEmail(booking.totalPrice)) + '</td></tr></table></div><div style="text-align:center;margin:24px 0;">' + callButton + '<a href="https://www.gelone.it/admin" style="display:inline-block;margin:8px 6px;padding:13px 20px;border-radius:999px;background:#0a1d35;color:#fff;text-decoration:none;font-weight:800;">Apri il PMS</a></div><p style="font-size:12px;color:#8a7a66;text-align:center;">Comunicazione automatica riservata allo staff.</p></div></div></div></body></html>';\n  return sendEmailViaResend({ to: NOTIFY_EMAILS, subject, text, html });`
);

ensure(bookingSource.includes("romitofrancesco1@gmail.com"), "Destinatario Francesco non applicato");
fs.writeFileSync(bookingPath, bookingSource, "utf8");

console.log("Email prenotazioni uniformate per sito, admin, ospite, Orazio e Francesco.");
