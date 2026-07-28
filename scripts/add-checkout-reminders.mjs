import fs from "node:fs";

const filePath = "api/cron-sync-calendars.js";
let source = fs.readFileSync(filePath, "utf8");

if (source.includes("async function runCheckoutReminder(")) {
  console.log("Checkout reminders already present.");
  process.exit(0);
}

const insertionPoint = "async function runArrivalReminder(options = {}) {";
if (!source.includes(insertionPoint)) {
  throw new Error("Punto di inserimento promemoria check-out non trovato.");
}

const checkoutCode = `async function loadCheckoutBookings(adminDb, today) {
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
      const unitCompare = String(a.unitName || "").localeCompare(
        String(b.unitName || "")
      );
      if (unitCompare !== 0) return unitCompare;
      return String(a.guestName || "").localeCompare(String(b.guestName || ""));
    });
}

async function sendCheckoutReminderEmail(adminDb, today, departures) {
  const primaryEmail = await getPrimaryNotificationEmail(adminDb);
  const recipients = splitEmails(primaryEmail, BROTHER_ARRIVAL_EMAIL);

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

  const subject =
    "Gelone - Partenze di oggi " + today + " (" + departures.length + ")";
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

  await sendResendEmail({ to: recipients, subject, text, html });
  return recipients.join(", ");
}

async function runCheckoutReminder(options = {}) {
  const send = Boolean(options.send);
  const sourceName = options.source || "manual";
  const adminDb = getFirebaseAdminDb();
  const today = getRomeDate(0);
  const departures = await loadCheckoutBookings(adminDb, today);

  if (departures.length === 0) {
    return {
      ok: true,
      today,
      sent: false,
      message: "Nessuna partenza oggi.",
      departures: [],
    };
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
    return {
      ok: true,
      today,
      sent: false,
      message: "Promemoria partenze già inviato.",
      departures: departures.length,
    };
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

  return {
    ok: true,
    today,
    sent: true,
    emailTo,
    departures: departures.length,
  };
}

`;

source = source.replace(insertionPoint, checkoutCode + insertionPoint);

const modeBlock = `      const result = await runArrivalReminder({
        send: String(req.query?.send || "") === "1",
        source: "manual_api",
      });
      return json(res, 200, result);`;

const modeReplacement = `      const shouldSend = String(req.query?.send || "") === "1";
      const result = await runArrivalReminder({
        send: shouldSend,
        source: "manual_api",
      });
      const checkoutReminder = await runCheckoutReminder({
        send: shouldSend,
        source: "same_cron_as_arrival_reminders",
      });
      return json(res, 200, { ...result, checkoutReminder });`;

if (!source.includes(modeBlock)) {
  throw new Error("Blocco API arrivi non trovato.");
}
source = source.replace(modeBlock, modeReplacement);

const automaticDeclaration = `    let arrivalReminderResult = null;`;
const automaticDeclarationReplacement = `    let arrivalReminderResult = null;
    let checkoutReminderResult = null;`;
if (!source.includes(automaticDeclaration)) {
  throw new Error("Dichiarazione promemoria automatico non trovata.");
}
source = source.replace(automaticDeclaration, automaticDeclarationReplacement);

const automaticReturn = `    return json(res, 200, {
      ok: true,
      source: "cron-sync-calendars",
      startedAt,
      finishedAt,
      syncResult: payload,
      arrivalReminder: arrivalReminderResult,
    });`;

const automaticReturnReplacement = `    try {
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
    });`;

if (!source.includes(automaticReturn)) {
  throw new Error("Risposta cron automatica non trovata.");
}
source = source.replace(automaticReturn, automaticReturnReplacement);

fs.writeFileSync(filePath, source);
console.log("Promemoria check-out aggiunto al cron esistente.");
