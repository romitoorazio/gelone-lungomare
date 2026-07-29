import fs from "node:fs";

const filePath = "api/cron-sync-calendars.js";
let source = fs.readFileSync(filePath, "utf8");

function replaceOrThrow(pattern, replacement, message) {
  if (!pattern.test(source)) throw new Error(message);
  source = source.replace(pattern, replacement);
}

if (!source.includes('const PRIMARY_NOTIFICATION_EMAIL = "info@gelone.it";')) {
  replaceOrThrow(
    /const BROTHER_ARRIVAL_EMAIL = "romitofrancesco1@gmail\.com";\nconst FALLBACK_ARRIVAL_EMAIL = "romitoorazio@gmail\.com";/,
    'const BROTHER_ARRIVAL_EMAIL = "romitofrancesco1@gmail.com";\nconst PRIMARY_NOTIFICATION_EMAIL = "info@gelone.it";\nconst FALLBACK_ARRIVAL_EMAIL = "romitoorazio@gmail.com";',
    "Costanti destinatari promemoria non trovate."
  );
}

replaceOrThrow(
  /async function getPrimaryNotificationEmail\(adminDb\) \{[\s\S]*?\n\}/,
  `async function getPrimaryNotificationEmail() {
  return PRIMARY_NOTIFICATION_EMAIL;
}`,
  "Funzione destinatario principale non trovata."
);

const insertionPoint = "async function runArrivalReminder(options = {}) {";
if (!source.includes(insertionPoint)) {
  throw new Error("Punto di inserimento promemoria check-out non trovato.");
}

const checkoutCode = `async function sendReminderEmailWithFallback(adminDb, { subject, text, html }) {
  const primaryEmail = await getPrimaryNotificationEmail(adminDb);
  const delivered = [];
  const failures = [];

  async function sendWithRetry(email, label) {
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await sendResendEmail({ to: [email], subject, text, html });
        delivered.push(email);
        return true;
      } catch (error) {
        lastError = error;
        console.warn(label + " non inviato, tentativo " + attempt + ":", error);
      }
    }
    failures.push({ email, label, error: lastError?.message || "Invio fallito" });
    return false;
  }

  await sendWithRetry(BROTHER_ARRIVAL_EMAIL, "Promemoria a Francesco");
  const primarySent = await sendWithRetry(primaryEmail, "Promemoria principale");

  if (!primarySent && primaryEmail !== FALLBACK_ARRIVAL_EMAIL) {
    await sendWithRetry(FALLBACK_ARRIVAL_EMAIL, "Promemoria di ripiego a Orazio");
  }

  if (delivered.length === 0) {
    throw new Error(
      "Nessuna email promemoria inviata: " +
        failures.map((item) => item.email + " (" + item.error + ")").join(", ")
    );
  }

  if (failures.length > 0) {
    console.warn("Alcuni destinatari non hanno ricevuto il promemoria:", failures);
  }

  return delivered;
}

async function loadCheckoutBookings(adminDb, today) {
  const snapshot = await adminDb
    .collection("bookings")
    .where("checkOut", "==", today)
    .get();
  const unitNames = await getArrivalUnitNames(adminDb);

  return snapshot.docs
    .map((document) => {
      const data = document.data() || {};
      const unitId = data.unitId || "lunarossa1";
      return {
        id: document.id,
        ...data,
        unitId,
        unitName: data.unitName || unitNames.get(unitId) || unitId,
      };
    })
    .filter(canNotifyArrival)
    .sort((a, b) => {
      const unitCompare = String(a.unitName || "").localeCompare(String(b.unitName || ""));
      if (unitCompare !== 0) return unitCompare;
      return String(a.guestName || "").localeCompare(String(b.guestName || ""));
    });
}

async function sendCheckoutReminderEmail(adminDb, today, departures) {
  const rowsText = departures
    .map((booking) =>
      [
        "Alloggio: " + booking.unitName,
        "Ospite: " + (booking.guestName || "Ospite"),
        "Telefono: " + (booking.guestPhone || "-"),
        "Arrivo: " + (booking.checkIn || "-"),
        "Partenza: " + (booking.checkOut || "-"),
        "Canale: " + arrivalLabel(booking.source || booking.channel || booking.status),
        "Pagamento: " + arrivalLabel(booking.paymentStatus),
        "WelcoMate: " + arrivalLabel(booking.welcomateStatus),
      ].join("\\n")
    )
    .join("\\n\\n---\\n\\n");

  const subject = "Gelone - Partenze di oggi " + today + " (" + departures.length + ")";
  const text =
    "Promemoria partenze di oggi\\n\\n" +
    "Data di uscita: " + today + "\\n" +
    "Ospiti in partenza: " + departures.length + "\\n\\n" +
    rowsText;
  const html =
    '<div style="font-family:Arial,sans-serif;color:#0a1d35;line-height:1.5;">' +
    '<h2>Promemoria partenze di oggi</h2>' +
    '<p>Oggi <strong>' + escapeHtml(today) + '</strong> sono previste <strong>' + departures.length + '</strong> partenze.</p>' +
    '<pre style="white-space:pre-wrap;background:#faf6ee;padding:14px;border-radius:12px;">' + escapeHtml(rowsText) + '</pre>' +
    '</div>';

  const recipients = await sendReminderEmailWithFallback(adminDb, { subject, text, html });
  return recipients.join(", ");
}

async function runCheckoutReminder(options = {}) {
  const send = Boolean(options.send);
  const sourceName = options.source || "manual";
  const adminDb = getFirebaseAdminDb();
  const today = getRomeDate(0);
  const departures = await loadCheckoutBookings(adminDb, today);

  if (departures.length === 0) {
    return { ok: true, today, sent: false, message: "Nessuna partenza oggi.", departures: [] };
  }

  if (!send) {
    return {
      ok: true,
      today,
      sent: false,
      message: "Anteprima partenze. Aggiungi &send=1 per inviare la mail.",
      departures: departures.map((booking) => ({
        id: booking.id,
        unitId: booking.unitId,
        unitName: booking.unitName,
        guestName: booking.guestName || "",
        guestPhone: booking.guestPhone || "",
        checkIn: booking.checkIn || "",
        checkOut: booking.checkOut || "",
      })),
    };
  }

  const reminderId = "checkout_reminder_" + today;
  const reminderRef = adminDb.collection("maintenanceLogs").doc(reminderId);
  const existingReminder = await reminderRef.get();

  if (existingReminder.exists) {
    return { ok: true, today, sent: false, message: "Promemoria partenze già inviato.", departures: departures.length };
  }

  const emailTo = await sendCheckoutReminderEmail(adminDb, today, departures);

  await reminderRef.set({
    type: "checkout_reminder",
    action: "checkout_reminder_email",
    source: sourceName,
    ok: true,
    today,
    departuresCount: departures.length,
    emailTo,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, today, sent: true, emailTo, departures: departures.length };
}

`;

source = source.replace(insertionPoint, checkoutCode + insertionPoint);

replaceOrThrow(
  /  const primaryEmail = await getPrimaryNotificationEmail\(adminDb\);\n  const recipients = splitEmails\(primaryEmail, BROTHER_ARRIVAL_EMAIL\);\n/,
  "",
  "Destinatari promemoria arrivi non trovati."
);

replaceOrThrow(
  /  await sendResendEmail\(\{ to: recipients, subject, text, html \}\);\n  return recipients\.join\(", "\);/,
  `  const recipients = await sendReminderEmailWithFallback(adminDb, { subject, text, html });
  return recipients.join(", ");`,
  "Invio promemoria arrivi non trovato."
);

replaceOrThrow(
  /if \(mode === "arrival-reminders" \|\| mode === "arrivals"\) \{[\s\S]*?\n  \}\n\n  const startedAt/,
  `if (mode === "arrival-reminders" || mode === "arrivals") {
    try {
      const shouldSend = String(req.query?.send || "") === "1";
      const result = await runArrivalReminder({
        send: shouldSend,
        forceTest: String(req.query?.test || "") === "1",
        offsetDays: Number(req.query?.offset ?? 1),
        source: "manual_api",
      });
      const checkoutReminder = await runCheckoutReminder({
        send: shouldSend,
        source: "same_cron_as_arrival_reminders",
      });
      return json(res, 200, { ...result, checkoutReminder });
    } catch (error) {
      console.error("Errore promemoria arrivi/partenze:", error);
      return json(res, 500, { ok: false, sent: false, message: error?.message || "Promemoria non inviato." });
    }
  }

  const startedAt`,
  "Blocco API arrivi non trovato."
);

if (!source.includes("let checkoutReminderResult = null;")) {
  replaceOrThrow(
    /    let arrivalReminderResult = null;/,
    `    let arrivalReminderResult = null;
    let checkoutReminderResult = null;`,
    "Dichiarazione promemoria automatico non trovata."
  );
}

replaceOrThrow(
  /    return json\(res, 200, \{\n      ok: true,\n      source: "cron-sync-calendars",\n      startedAt,\n      finishedAt,\n      syncResult: payload,\n      arrivalReminder: arrivalReminderResult,\n    \}\);/,
  `    try {
      checkoutReminderResult = await runCheckoutReminder({
        send: true,
        source: "automatic_after_calendar_sync",
      });
    } catch (checkoutError) {
      console.warn("Promemoria partenze non inviato:", checkoutError);
      checkoutReminderResult = {
        ok: false,
        sent: false,
        message: checkoutError?.message || "Promemoria partenze non inviato.",
      };
    }

    return json(res, 200, {
      ok: true,
      source: "cron-sync-calendars",
      startedAt,
      finishedAt,
      syncResult: payload,
      arrivalReminder: arrivalReminderResult,
      checkoutReminder: checkoutReminderResult,
    });`,
  "Risposta cron automatica non trovata."
);

fs.writeFileSync(filePath, source);
console.log("Promemoria arrivi e check-out aggiornati con destinatario principale e fallback.");
