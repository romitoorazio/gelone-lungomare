import fs from "node:fs";

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

const adminPath = new URL("../src/Admin.jsx", import.meta.url);
let adminSource = fs.readFileSync(adminPath, "utf8");

if (!adminSource.includes("arrivalEmailLoading")) {
  adminSource = adminSource.replace(
    /const \[syncLoading, setSyncLoading\] = useState\(false\);/,
    `const [syncLoading, setSyncLoading] = useState(false);\n  const [arrivalEmailLoading, setArrivalEmailLoading] = useState(false);`
  );
}

if (!adminSource.includes("async function sendArrivalReminderNow()")) {
  const functionCode = `  async function sendArrivalReminderNow() {\n    clearMessages();\n\n    const confirmed = window.confirm(\n      "Vuoi inviare adesso una vera email di prova a Orazio e Francesco?"\n    );\n\n    if (!confirmed) return;\n\n    try {\n      setArrivalEmailLoading(true);\n      const token = await getIdToken(user, true);\n      const response = await fetch(\n        "/api/cron-sync-calendars?mode=arrival-reminders&send=1&test=1&_=" + Date.now(),\n        {\n          method: "GET",\n          cache: "no-store",\n          headers: {\n            Authorization: \`Bearer \${token}\`,\n            "Cache-Control": "no-cache",\n          },\n        }\n      );\n      const data = await response.json().catch(() => null);\n\n      if (!response.ok || !data?.ok) {\n        const errorMessage = data?.message || "Email di prova non inviata.";\n        setError(errorMessage);\n        window.alert(errorMessage);\n        return;\n      }\n\n      const successMessage = data.message || "Email di prova inviata.";\n      setMessage(successMessage);\n      window.alert(successMessage);\n    } catch (err) {\n      console.error(err);\n      const errorMessage = "Errore tecnico durante il test email.";\n      setError(errorMessage);\n      window.alert(errorMessage);\n    } finally {\n      setArrivalEmailLoading(false);\n    }\n  }\n\n`;

  adminSource = adminSource.replace(
    /  async function cleanupGhostNights\(\) \{/,
    functionCode + "  async function cleanupGhostNights() {"
  );
}

if (!adminSource.includes("Invia email di prova adesso")) {
  const syncButtonRegex = /(<button[\s\S]*?onClick=\{syncCalendars\}[\s\S]*?\{syncLoading \? "Sincronizzazione\.\.\." : "Sincronizza ora"\}[\s\S]*?<\/button>)/;
  ensure(syncButtonRegex.test(adminSource), "Pulsante sincronizzazione non trovato in Admin.jsx");
  adminSource = adminSource.replace(
    syncButtonRegex,
    `$1\n\n                <button\n                  type="button"\n                  onClick={sendArrivalReminderNow}\n                  disabled={arrivalEmailLoading}\n                  className="inline-flex items-center gap-2 rounded-full bg-green-700 px-6 py-4 font-bold text-white disabled:opacity-60"\n                >\n                  <Mail size={18} />\n                  {arrivalEmailLoading ? "Invio email..." : "Invia email di prova adesso"}\n                </button>`
  );
}

ensure(adminSource.includes("sendArrivalReminderNow"), "Funzione test email non presente in Admin.jsx");
ensure(adminSource.includes("Invia email di prova adesso"), "Pulsante test email non presente in Admin.jsx");
fs.writeFileSync(adminPath, adminSource, "utf8");

const cronPath = new URL("../api/cron-sync-calendars.js", import.meta.url);
let cronSource = fs.readFileSync(cronPath, "utf8");

cronSource = cronSource.replace(
  /import \{ FieldValue,\s*(?:getFirebaseAdminAuth,\s*)?getFirebaseAdminDb \} from "\.\/_firebaseAdmin\.js";/,
  `import { FieldValue, getFirebaseAdminAuth, getFirebaseAdminDb } from "./_firebaseAdmin.js";`
);

cronSource = cronSource.replace(
  /function json\(res, status, payload\) \{[\s\S]*?\n\}/,
  `function json(res, status, payload) {\n  res.setHeader("Content-Type", "application/json; charset=utf-8");\n  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");\n  res.setHeader("Pragma", "no-cache");\n  res.setHeader("Expires", "0");\n  return res.status(status).json(payload);\n}`
);

const genericEmailFunction = `async function sendArrivalReminderEmail(adminDb, arrivalDate, arrivals, title) {\n  const primaryEmail = await getPrimaryNotificationEmail(adminDb);\n  const recipients = splitEmails(primaryEmail, BROTHER_ARRIVAL_EMAIL);\n\n  const rowsText = arrivals\n    .map((booking) =>\n      [\n        "Alloggio: " + booking.unitName,\n        "Ospite: " + (booking.guestName || "Ospite"),\n        "Telefono: " + (booking.guestPhone || "-"),\n        "Arrivo: " + (booking.checkIn || "-"),\n        "Partenza: " + (booking.checkOut || "-"),\n        "Notti: " + (booking.nights || "-"),\n        "Pagamento: " + arrivalLabel(booking.paymentStatus),\n        "WelcoMate: " + arrivalLabel(booking.welcomateStatus),\n        "Prezzo: " + formatArrivalEuro(booking.totalPrice || 0),\n      ].join("\\n")\n    )\n    .join("\\n\\n---\\n\\n");\n\n  const subject = "Gelone - " + title + " " + arrivalDate + " (" + arrivals.length + ")";\n  const text = title + "\\n\\nData arrivo: " + arrivalDate + "\\nArrivi: " + arrivals.length + "\\n\\n" + rowsText;\n  const html =\n    '<div style="font-family:Arial,sans-serif;color:#0a1d35;line-height:1.5;">' +\n    '<h2>' + escapeHtml(title) + '</h2>' +\n    '<p>Data arrivo: <strong>' + escapeHtml(arrivalDate) + '</strong> · Arrivi: <strong>' + arrivals.length + '</strong></p>' +\n    '<pre style="white-space:pre-wrap;background:#faf6ee;padding:14px;border-radius:12px;">' + escapeHtml(rowsText) + '</pre>' +\n    '</div>';\n\n  await sendResendEmail({ to: recipients, subject, text, html });\n  return recipients.join(", ");\n}`;

cronSource = cronSource.replace(
  /async function sendArrivalReminderEmail\([\s\S]*?\n\}/,
  genericEmailFunction
);

const reminderFunctions = `async function runArrivalReminder(options = {}) {\n  const send = Boolean(options.send);\n  const forceTest = Boolean(options.forceTest);\n  const source = options.source || "manual";\n  const offsetDays = Number.isFinite(Number(options.offsetDays)) ? Number(options.offsetDays) : 1;\n  const labelKey = options.labelKey || (offsetDays === 0 ? "today" : offsetDays === 1 ? "1day" : "2days");\n  const title = options.title || (offsetDays === 0 ? "Arrivi di oggi" : offsetDays === 1 ? "Arrivi di domani" : "Arrivi tra due giorni");\n  const adminDb = getFirebaseAdminDb();\n  const today = getRomeDate(0);\n  const arrivalDate = getRomeDate(offsetDays);\n\n  if (forceTest) {\n    const primaryEmail = await getPrimaryNotificationEmail(adminDb);\n    const recipients = splitEmails(primaryEmail, BROTHER_ARRIVAL_EMAIL);\n    const sentAt = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });\n    const subject = "Gelone - TEST email promemoria";\n    const text = "TEST RIUSCITO. Sistema email Gelone attivo. Data e ora: " + sentAt;\n    const html = "<h2>TEST RIUSCITO</h2><p>Il sistema email Gelone è attivo.</p><p>Data e ora: " + escapeHtml(sentAt) + "</p>";\n    await sendResendEmail({ to: recipients, subject, text, html });\n    return { ok: true, sent: true, test: true, today, arrivalDate, arrivals: 0, emailTo: recipients.join(", "), message: "Email di prova inviata correttamente a " + recipients.join(", ") + "." };\n  }\n\n  const arrivals = await loadArrivalBookings(adminDb, arrivalDate);\n\n  if (arrivals.length === 0) {\n    return { ok: true, today, arrivalDate, sent: false, message: "Nessun arrivo per " + title.toLowerCase() + ".", arrivals: [] };\n  }\n\n  if (!send) {\n    return { ok: true, today, arrivalDate, sent: false, message: "Anteprima.", arrivals: arrivals.length };\n  }\n\n  const reminderId = "arrival_reminder_" + labelKey + "_" + arrivalDate;\n  const reminderRef = adminDb.collection("maintenanceLogs").doc(reminderId);\n  const existingReminder = await reminderRef.get();\n\n  if (existingReminder.exists) {\n    return { ok: true, today, arrivalDate, sent: false, message: title + " già inviato.", arrivals: arrivals.length };\n  }\n\n  const emailTo = await sendArrivalReminderEmail(adminDb, arrivalDate, arrivals, title);\n\n  await reminderRef.set({\n    type: "arrival_reminder", action: "arrival_reminder_email", source, labelKey, offsetDays, title, ok: true, today, arrivalDate, arrivalsCount: arrivals.length, emailTo, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),\n  });\n\n  return { ok: true, today, arrivalDate, sent: true, emailTo, arrivals: arrivals.length, message: title + " inviato a " + emailTo + "." };\n}\n\nasync function runScheduledArrivalReminders(options = {}) {\n  const source = options.source || "automatic";\n  const schedules = [\n    { offsetDays: 2, labelKey: "2days", title: "Arrivi tra due giorni" },\n    { offsetDays: 1, labelKey: "1day", title: "Arrivi di domani" },\n    { offsetDays: 0, labelKey: "today", title: "Arrivi di oggi" },\n  ];\n  const results = [];\n  for (const schedule of schedules) {\n    results.push(await runArrivalReminder({ ...schedule, send: true, source }));\n  }\n  return { ok: true, results };\n}`;

cronSource = cronSource.replace(
  /async function runArrivalReminder\(options = \{\}\) \{[\s\S]*?\n\}\n\nexport default async function handler/,
  reminderFunctions + `\n\nexport default async function handler`
);

const modeBlockRegex = /if \(mode === "arrival-reminders" \|\| mode === "arrivals"\) \{[\s\S]*?\n  \}\n\n  const startedAt/;
cronSource = cronSource.replace(
  modeBlockRegex,
  `if (mode === "arrival-reminders" || mode === "arrivals") {\n    try {\n      const result = await runArrivalReminder({\n        send: String(req.query?.send || "") === "1",\n        forceTest: String(req.query?.test || "") === "1",\n        offsetDays: Number(req.query?.offset ?? 1),\n        source: "manual_api",\n      });\n      return json(res, 200, result);\n    } catch (error) {\n      console.error("Errore promemoria arrivi:", error);\n      return json(res, 500, { ok: false, sent: false, message: error?.message || "Promemoria arrivi non inviato." });\n    }\n  }\n\n  const startedAt`
);

cronSource = cronSource.replace(
  /arrivalReminderResult = await runArrivalReminder\(\{[\s\S]*?source: "automatic_after_calendar_sync",[\s\S]*?\}\);/,
  `arrivalReminderResult = await runScheduledArrivalReminders({ source: "automatic_after_calendar_sync" });`
);

const authGuardRegex = /if \(!authorizedByCron && !authorizedBySync(?: && !authorizedByVercelCron)?\) \{\n    return json\(res, 401, \{ ok: false, message: "Cron non autorizzato\." \}\);\n  \}/;
if (!cronSource.includes("authorizedByAdmin")) {
  ensure(authGuardRegex.test(cronSource), "Guardia autorizzazione cron non trovata");
  cronSource = cronSource.replace(
    authGuardRegex,
    `let authorizedByAdmin = false;\n\n  if (!authorizedByCron && !authorizedBySync && authorization.startsWith("Bearer ")) {\n    try {\n      const idToken = authorization.slice("Bearer ".length).trim();\n      const decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken);\n      authorizedByAdmin = String(decodedToken?.email || "").toLowerCase() === "romitoorazio@gmail.com";\n    } catch (error) {\n      console.warn("Token admin non valido per promemoria arrivi:", error);\n    }\n  }\n\n  if (!authorizedByCron && !authorizedBySync && !authorizedByAdmin) {\n    return json(res, 401, { ok: false, message: "Cron non autorizzato." });\n  }`
  );
}

ensure(cronSource.includes("runScheduledArrivalReminders"), "Promemoria triplo non applicato");
ensure(cronSource.includes("forceTest"), "Modalità test non applicata");
ensure(cronSource.includes("getFirebaseAdminAuth"), "Autorizzazione admin non applicata");
fs.writeFileSync(cronPath, cronSource, "utf8");

console.log("Test email stabile e promemoria a 2 giorni, 1 giorno e giorno arrivo applicati.");