import fs from "node:fs";

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

const cronPath = new URL("../api/cron-sync-calendars.js", import.meta.url);
let cron = fs.readFileSync(cronPath, "utf8");

const helperCode = `function formatProfessionalDate(value) {
  const raw = String(value || "").trim();
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) return raw || "-";
  const [year, month, day] = raw.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function cleanGuestName(value) {
  return String(value || "Ospite")
    .replace(/^prenotazione\\s+(booking|airbnb)\\s+/i, "")
    .replace(/\\s+/g, " ")
    .trim()
    .replace(/\\b\\p{L}/gu, (letter) => letter.toUpperCase());
}

function professionalChannel(value) {
  const channel = String(value || "").toLowerCase();
  if (channel.includes("booking")) return "Booking.com";
  if (channel.includes("airbnb")) return "Airbnb";
  if (channel.includes("direct") || channel.includes("manual")) return "Prenotazione diretta";
  if (channel.includes("ical")) return "Calendario esterno";
  return value || "-";
}

function statusBadge(label, value, positiveValues = []) {
  const normalized = String(value || "").toLowerCase();
  const positive = positiveValues.includes(normalized);
  const background = positive ? "#eaf7ef" : "#fff4df";
  const color = positive ? "#187545" : "#9a5b00";
  return '<div style="padding:12px 14px;border-radius:12px;background:' + background + ';color:' + color + ';font-weight:800;margin-top:10px;">' + escapeHtml(label) + ': ' + escapeHtml(arrivalLabel(value)) + '</div>';
}

function buildStaffEmailShell({ title, subtitle, date, countLabel, count, cardsHtml }) {
  return '<!doctype html><html><body style="margin:0;padding:0;background:#f2f5f8;font-family:Arial,Helvetica,sans-serif;color:#102a43;">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">' + escapeHtml(subtitle) + '</div>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f5f8;border-collapse:collapse;"><tr><td align="center" style="padding:24px 12px;">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;">' +
        '<tr><td style="background:#102f4f;border-radius:22px 22px 0 0;padding:28px 22px;text-align:center;color:#ffffff;">' +
          '<div style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#f5c84b;">Gelone Lungomare · PMS</div>' +
          '<div style="font-size:30px;line-height:1.2;font-weight:800;margin-top:10px;">' + escapeHtml(title) + '</div>' +
          '<div style="font-size:16px;line-height:1.5;margin-top:10px;color:#dbe6f4;">' + escapeHtml(formatProfessionalDate(date)) + '</div>' +
        '</td></tr>' +
        '<tr><td style="background:#ffffff;padding:20px 18px 6px;">' +
          '<div style="background:#f7f9fc;border:1px solid #e5e9f0;border-radius:16px;padding:16px;text-align:center;margin-bottom:18px;">' +
            '<div style="font-size:28px;font-weight:900;color:#102f4f;">' + count + '</div>' +
            '<div style="font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:#667085;font-weight:800;margin-top:4px;">' + escapeHtml(countLabel) + '</div>' +
          '</div>' + cardsHtml +
        '</td></tr>' +
        '<tr><td style="background:#ffffff;border-radius:0 0 22px 22px;padding:8px 24px 24px;text-align:center;">' +
          '<a href="https://www.gelone.it/admin" style="display:inline-block;padding:13px 22px;border-radius:999px;background:#102f4f;color:#ffffff;text-decoration:none;font-weight:800;">Apri il PMS</a>' +
          '<div style="color:#7a8898;font-size:12px;line-height:1.6;margin-top:18px;">Comunicazione automatica riservata allo staff di Gelone Lungomare.</div>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr></table>' +
  '</body></html>';
}
`;

if (!cron.includes("function formatProfessionalDate(")) {
  const marker = "async function loadCheckoutBookings(adminDb, today) {";
  ensure(cron.includes(marker), "Punto inserimento helper email professionali non trovato");
  cron = cron.replace(marker, helperCode + "\n" + marker);
}

const checkoutEmail = `async function sendCheckoutReminderEmail(adminDb, today, departures) {
  const cardsHtml = departures.map((booking) => {
    const guestName = cleanGuestName(booking.guestName);
    const phone = String(booking.guestPhone || "").trim();
    const phoneDigits = phone.replace(/\\D/g, "");
    const callButton = phoneDigits
      ? '<a href="tel:+' + (phoneDigits.startsWith("39") ? phoneDigits : "39" + phoneDigits) + '" style="display:inline-block;margin-top:14px;padding:11px 18px;border-radius:999px;background:#15803d;color:#ffffff;text-decoration:none;font-weight:800;">Chiama ospite</a>'
      : "";

    return '<div style="margin:0 0 18px;background:#ffffff;border:1px solid #e5e9f0;border-radius:18px;overflow:hidden;box-shadow:0 4px 14px rgba(15,35,60,.06);">' +
      '<div style="padding:18px 20px;background:#f7f9fc;border-bottom:1px solid #e5e9f0;">' +
        '<div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#667085;font-weight:800;">' + escapeHtml(booking.unitName || "Alloggio") + '</div>' +
        '<div style="font-size:23px;color:#102a43;font-weight:900;margin-top:5px;">' + escapeHtml(guestName) + '</div>' +
        '<div style="font-size:14px;color:#52667a;margin-top:5px;">' + escapeHtml(professionalChannel(booking.source || booking.channel || booking.status)) + '</div>' +
      '</div>' +
      '<div style="padding:20px;">' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:15px;">' +
          '<tr><td style="padding:10px 0;color:#667085;">Arrivo</td><td style="padding:10px 0;text-align:right;font-weight:800;">' + escapeHtml(formatProfessionalDate(booking.checkIn)) + '</td></tr>' +
          '<tr><td style="padding:10px 0;color:#667085;">Partenza</td><td style="padding:10px 0;text-align:right;font-weight:800;">' + escapeHtml(formatProfessionalDate(booking.checkOut)) + '</td></tr>' +
          '<tr><td style="padding:10px 0;color:#667085;">Telefono</td><td style="padding:10px 0;text-align:right;font-weight:800;">' + escapeHtml(phone || "-") + '</td></tr>' +
        '</table>' +
        statusBadge("Pagamento", booking.paymentStatus, ["paid", "pagato"]) +
        statusBadge("WelcoMate", booking.welcomateStatus, ["sent", "completed", "inviato", "completato"]) +
        '<div style="text-align:center;">' + callButton + '</div>' +
      '</div>' +
    '</div>';
  }).join("");

  const subject = "Gelone Lungomare · Partenze di oggi (" + departures.length + ")";
  const text = "Promemoria partenze di oggi - " + formatProfessionalDate(today) + "\\n\\n" + departures.map((booking) => [
    "Alloggio: " + (booking.unitName || "-"),
    "Ospite: " + cleanGuestName(booking.guestName),
    "Telefono: " + (booking.guestPhone || "-"),
    "Arrivo: " + formatProfessionalDate(booking.checkIn),
    "Partenza: " + formatProfessionalDate(booking.checkOut),
    "Canale: " + professionalChannel(booking.source || booking.channel || booking.status),
    "Pagamento: " + arrivalLabel(booking.paymentStatus),
    "WelcoMate: " + arrivalLabel(booking.welcomateStatus),
  ].join("\\n")).join("\\n\\n---\\n\\n");
  const html = buildStaffEmailShell({
    title: "Partenze di oggi",
    subtitle: departures.length === 1 ? "È prevista una partenza." : "Sono previste " + departures.length + " partenze.",
    date: today,
    countLabel: departures.length === 1 ? "Partenza prevista" : "Partenze previste",
    count: departures.length,
    cardsHtml,
  });

  const recipients = await sendReminderEmailWithFallback(adminDb, { subject, text, html });
  return recipients.join(", ");
}`;

const checkoutRegex = /async function sendCheckoutReminderEmail\(adminDb, today, departures\) \{[\s\S]*?\n\}/;
ensure(checkoutRegex.test(cron), "Funzione email check-out non trovata");
cron = cron.replace(checkoutRegex, checkoutEmail);

fs.writeFileSync(cronPath, cron, "utf8");

const guestPath = new URL("../api/_bookingGuestEmails.js", import.meta.url);
let guest = fs.readFileSync(guestPath, "utf8");

guest = guest.replace(
  'const subject = `Prenotazione confermata - ${unitName}`;',
  'const subject = `Gelone Lungomare · Prenotazione confermata · ${unitName}`;'
);
guest = guest.replace(
  'const subject = `Prenotazione annullata - ${unitName}`;',
  'const subject = `Gelone Lungomare · Prenotazione annullata · ${unitName}`;'
);
guest = guest.replaceAll(
  'font-family:Georgia,serif;font-size:32px;line-height:1.1;',
  'font-family:Arial,Helvetica,sans-serif;font-size:30px;line-height:1.2;font-weight:800;'
);
guest = guest.replace(
  '${safeBrandName} · Via Pascoli 1 · 93012 Gela (CL)',
  '${safeBrandName} · Gela, Sicilia · www.gelone.it'
);
fs.writeFileSync(guestPath, guest, "utf8");

const internalPath = new URL("../api/send-confirmation-email.js", import.meta.url);
let internal = fs.readFileSync(internalPath, "utf8");
internal = internal.replace(
  'const subject = `Nuova prenotazione inserita - ${unitName}`;',
  'const subject = `Gelone Lungomare · Nuova prenotazione · ${unitName}`;'
);
fs.writeFileSync(internalPath, internal, "utf8");

console.log("Template email Gelone uniformati e resi professionali.");
