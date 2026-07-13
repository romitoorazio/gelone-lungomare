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
  `  async function sendArrivalReminderNow() {\n    clearMessages();\n\n    const confirmed = window.confirm(\n      "Vuoi inviare adesso il promemoria degli arrivi di domani a Orazio e Francesco?"\n    );\n\n    if (!confirmed) return;\n\n    try {\n      setArrivalEmailLoading(true);\n      const token = await getIdToken(user, true);\n      const response = await fetch(\n        "/api/cron-sync-calendars?mode=arrival-reminders&send=1",\n        {\n          method: "GET",\n          headers: { Authorization: \`Bearer \${token}\` },\n        }\n      );\n      const data = await response.json().catch(() => null);\n\n      if (!response.ok || !data?.ok) {\n        setError(data?.message || "Email promemoria non inviata.");\n        return;\n      }\n\n      if (data.sent) {\n        setMessage(\n          "Promemoria inviato a " +\n            (data.emailTo || "Orazio e Francesco") +\n            ". Arrivi trovati: " +\n            (data.arrivals || 0) +\n            "."\n        );\n      } else {\n        setMessage(data.message || "Nessuna email inviata.");\n      }\n    } catch (err) {\n      console.error(err);\n      setError("Errore tecnico durante l'invio del promemoria email.");\n    } finally {\n      setArrivalEmailLoading(false);\n    }\n  }\n\n  async function cleanupGhostNights() {`,
  "funzione invio manuale promemoria"
);

adminSource = replaceOnce(
  adminSource,
  `                <button\n                  type="button"\n                  onClick={syncCalendars}\n                  disabled={syncLoading}\n                  className="inline-flex items-center gap-2 rounded-full bg-[#9b6b25] px-6 py-4 font-bold text-white disabled:opacity-60"\n                >\n                  <RefreshCcw size={18} />\n                  {syncLoading ? "Sincronizzazione..." : "Sincronizza ora"}\n                </button>`,
  `                <button\n                  type="button"\n                  onClick={syncCalendars}\n                  disabled={syncLoading}\n                  className="inline-flex items-center gap-2 rounded-full bg-[#9b6b25] px-6 py-4 font-bold text-white disabled:opacity-60"\n                >\n                  <RefreshCcw size={18} />\n                  {syncLoading ? "Sincronizzazione..." : "Sincronizza ora"}\n                </button>\n\n                <button\n                  type="button"\n                  onClick={sendArrivalReminderNow}\n                  disabled={arrivalEmailLoading}\n                  className="inline-flex items-center gap-2 rounded-full bg-green-700 px-6 py-4 font-bold text-white disabled:opacity-60"\n                >\n                  <Mail size={18} />\n                  {arrivalEmailLoading\n                    ? "Invio email..."\n                    : "Invia promemoria email adesso"}\n                </button>`,
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

fs.writeFileSync(cronPath, cronSource, "utf8");
console.log("Pulsante email arrivi e autorizzazione admin applicati.");
