import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) {
    throw new Error(`Blocco non trovato: ${label}`);
  }
  return source.replace(before, after);
}

const adminPath = new URL("../src/Admin.jsx", import.meta.url);
let adminSource = fs.readFileSync(adminPath, "utf8");

adminSource = replaceOnce(
  adminSource,
  `  const [syncLoading, setSyncLoading] = useState(false);\n  const [syncResult, setSyncResult] = useState(null);`,
  `  const [syncLoading, setSyncLoading] = useState(false);\n  const [arrivalEmailLoading, setArrivalEmailLoading] = useState(false);\n  const [syncResult, setSyncResult] = useState(null);`,
  "stato invio email arrivi"
);

adminSource = replaceOnce(
  adminSource,
  `  async function cleanupGhostNights() {`,
  `  async function sendArrivalReminderNow() {\n    clearMessages();\n\n    const confirmed = window.confirm(\n      "Vuoi inviare adesso una email di prova a Orazio e Francesco?"\n    );\n\n    if (!confirmed) return;\n\n    try {\n      setArrivalEmailLoading(true);\n      const token = await getIdToken(user, true);\n      const response = await fetch(\n        "/api/cron-sync-calendars?mode=arrival-reminders&send=1&test=1&_=" + Date.now(),\n        {\n          method: "GET",\n          cache: "no-store",\n          headers: {\n            Authorization: \`Bearer \${token}\`,\n            "Cache-Control": "no-cache",\n          },\n        }\n      );\n      const data = await response.json().catch(() => null);\n\n      if (!response.ok || !data?.ok) {\n        const errorMessage = data?.message || "Email di prova non inviata.";\n        setError(errorMessage);\n        window.alert(errorMessage);\n        return;\n      }\n\n      const successMessage = data.message ||\n        (data.sent\n          ? "Email inviata a " + (data.emailTo || "Orazio e Francesco") + "."\n          : "Nessuna email inviata.");\n      setMessage(successMessage);\n      window.alert(successMessage);\n    } catch (err) {\n      console.error(err);\n      const errorMessage = "Errore tecnico durante il test email.";\n      setError(errorMessage);\n      window.alert(errorMessage);\n    } finally {\n      setArrivalEmailLoading(false);\n    }\n  }\n\n  async function cleanupGhostNights() {`,
  "funzione invio manuale promemoria"
);

adminSource = replaceOnce(
  adminSource,
  `                <button\n                  type="button"\n                  onClick={syncCalendars}\n                  disabled={syncLoading}\n                  className="inline-flex items-center gap-2 rounded-full bg-[#9b6b25] px-6 py-4 font-bold text-white disabled:opacity-60"\n                >\n                  <RefreshCcw size={18} />\n                  {syncLoading ? "Sincronizzazione..." : "Sincronizza ora"}\n                </button>`,
  `                <button\n                  type="button"\n                  onClick={syncCalendars}\n                  disabled={syncLoading}\n                  className="inline-flex items-center gap-2 rounded-full bg-[#9b6b25] px-6 py-4 font-bold text-white disabled:opacity-60"\n                >\n                  <RefreshCcw size={18} />\n                  {syncLoading ? "Sincronizzazione..." : "Sincronizza ora"}\n                </button>\n\n                <button\n                  type="button"\n                  onClick={sendArrivalReminderNow}\n                  disabled={arrivalEmailLoading}\n                  className="inline-flex items-center gap-2 rounded-full bg-green-700 px-6 py-4 font-bold text-white disabled:opacity-60"\n                >\n                  <Mail size={18} />\n                  {arrivalEmailLoading\n                    ? "Invio email..."\n                    : "Invia email di prova adesso"}\n                </button>`,
  "pulsante invio promemoria"
);

fs.writeFileSync(adminPath, adminSource, "utf8");

const cronPath = new URL("../api/cron-sync-calendars.js", import.meta.url);
let cronSource = fs.readFileSync(cronPath, "utf8");

cronSource = replaceOnce(
  cronSource,
  `import { FieldValue, getFirebaseAdminDb } from "./_firebaseAdmin.js";`,
  `import { FieldValue, getFirebaseAdminAuth, getFirebaseAdminDb } from "./_firebaseAdmin.js";`,
  "import auth admin"
);

cronSource = replaceOnce(
  cronSource,
  `  if (!authorizedByCron && !authorizedBySync && !authorizedByVercelCron) {\n    return json(res, 401, { ok: false, message: "Cron non autorizzato." });\n  }`,
  `  let authorizedByAdmin = false;\n\n  if (\n    !authorizedByCron &&\n    !authorizedBySync &&\n    !authorizedByVercelCron &&\n    authorization.startsWith("Bearer ")\n  ) {\n    try {\n      const idToken = authorization.slice("Bearer ".length).trim();\n      const decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken);\n      authorizedByAdmin =\n        String(decodedToken?.email || "").toLowerCase() ===\n        "romitoorazio@gmail.com";\n    } catch (error) {\n      console.warn("Token admin non valido per promemoria arrivi:", error);\n    }\n  }\n\n  if (\n    !authorizedByCron &&\n    !authorizedBySync &&\n    !authorizedByVercelCron &&\n    !authorizedByAdmin\n  ) {\n    return json(res, 401, { ok: false, message: "Cron non autorizzato." });\n  }`,
  "autorizzazione admin Firebase"
);

cronSource = replaceOnce(
  cronSource,
  `function json(res, status, payload) {\n  res.setHeader("Content-Type", "application/json; charset=utf-8");\n  return res.status(status).json(payload);\n}`,
  `function json(res, status, payload) {\n  res.setHeader("Content-Type", "application/json; charset=utf-8");\n  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");\n  res.setHeader("Pragma", "no-cache");\n  res.setHeader("Expires", "0");\n  return res.status(status).json(payload);\n}`,
  "header no-cache"
);

cronSource = replaceOnce(
  cronSource,
  `  const arrivals = await loadArrivalBookings(adminDb, tomorrow);`,
  `  if (Boolean(options.forceTest)) {\n    const primaryEmail = await getPrimaryNotificationEmail(adminDb);\n    const recipients = splitEmails(primaryEmail, BROTHER_ARRIVAL_EMAIL);\n    const sentAt = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });\n    const subject = "Gelone - TEST email promemoria";\n    const text = "TEST RIUSCITO. Sistema email Gelone attivo. Data e ora: " + sentAt;\n    const html = "<h2>TEST RIUSCITO</h2><p>Il sistema email Gelone e attivo.</p><p>Data e ora: " + escapeHtml(sentAt) + "</p>";\n    await sendResendEmail({ to: recipients, subject, text, html });\n    return { ok: true, sent: true, test: true, today, tomorrow, arrivals: 0, emailTo: recipients.join(", "), message: "Email di prova inviata correttamente a " + recipients.join(", ") + "." };\n  }\n\n  const arrivals = await loadArrivalBookings(adminDb, tomorrow);`,
  "modalita test"
);

cronSource = replaceOnce(
  cronSource,
  `        send: String(req.query?.send || "") === "1",\n        source: "manual_api",`,
  `        send: String(req.query?.send || "") === "1",\n        forceTest: String(req.query?.test || "") === "1",\n        source: "manual_api",`,
  "parametro test"
);

fs.writeFileSync(cronPath, cronSource, "utf8");
console.log("Pulsante test email, no-cache, messaggi visibili e autorizzazione admin applicati.");