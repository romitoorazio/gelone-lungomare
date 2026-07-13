import fs from "node:fs";

const adminPath = new URL("../src/Admin.jsx", import.meta.url);
let admin = fs.readFileSync(adminPath, "utf8");

if (!admin.includes("arrivalEmailLoading")) {
  admin = admin.replace(
    '  const [syncLoading, setSyncLoading] = useState(false);',
    '  const [syncLoading, setSyncLoading] = useState(false);\n  const [arrivalEmailLoading, setArrivalEmailLoading] = useState(false);'
  );
}

if (!admin.includes("async function sendArrivalReminderNow")) {
  const fn = `  async function sendArrivalReminderNow() {
    clearMessages();
    if (!window.confirm("Vuoi inviare adesso una email di prova a Orazio e Francesco?")) return;
    try {
      setArrivalEmailLoading(true);
      const token = await getIdToken(user, true);
      const response = await fetch(
        "/api/cron-sync-calendars?mode=arrival-reminders&send=1&test=1&_=" + Date.now(),
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: \`Bearer \${token}\`,
            "Cache-Control": "no-cache",
          },
        }
      );
      const data = await response.json().catch(() => null);
      const resultMessage = data?.message || (response.ok ? "Operazione completata." : "Email di prova non inviata.");
      if (!response.ok || !data?.ok) {
        setError(resultMessage);
        window.alert(resultMessage);
        return;
      }
      setMessage(resultMessage);
      window.alert(resultMessage);
    } catch (err) {
      console.error(err);
      const resultMessage = "Errore tecnico durante il test email.";
      setError(resultMessage);
      window.alert(resultMessage);
    } finally {
      setArrivalEmailLoading(false);
    }
  }

`;
  admin = admin.replace("  async function cleanupGhostNights() {", fn + "  async function cleanupGhostNights() {");
}

if (!admin.includes("Invia email di prova adesso")) {
  const syncButtonEnd = `                  {syncLoading ? "Sincronizzazione..." : "Sincronizza ora"}
                </button>`;
  const testButton = `${syncButtonEnd}

                <button
                  type="button"
                  onClick={sendArrivalReminderNow}
                  disabled={arrivalEmailLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-green-700 px-6 py-4 font-bold text-white disabled:opacity-60"
                >
                  <Mail size={18} />
                  {arrivalEmailLoading ? "Invio email..." : "Invia email di prova adesso"}
                </button>`;
  admin = admin.replace(syncButtonEnd, testButton);
}

fs.writeFileSync(adminPath, admin, "utf8");

const cronPath = new URL("../api/cron-sync-calendars.js", import.meta.url);
let cron = fs.readFileSync(cronPath, "utf8");

cron = cron.replace(
  'import { FieldValue, getFirebaseAdminDb } from "./_firebaseAdmin.js";',
  'import { FieldValue, getFirebaseAdminAuth, getFirebaseAdminDb } from "./_firebaseAdmin.js";'
);

if (!cron.includes('res.setHeader("Cache-Control"')) {
  cron = cron.replace(
    '  res.setHeader("Content-Type", "application/json; charset=utf-8");',
    '  res.setHeader("Content-Type", "application/json; charset=utf-8");\n  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");\n  res.setHeader("Pragma", "no-cache");\n  res.setHeader("Expires", "0");'
  );
}

if (!cron.includes("authorizedByAdmin")) {
  const authPattern = /\n  if \(!authorizedByCron && !authorizedBySync(?: && !authorizedByVercelCron)?\) \{\n    return json\(res, 401, \{ ok: false, message: "Cron non autorizzato\." \}\);\n  \}/;
  const hasVercelAuth = cron.includes("authorizedByVercelCron");
  cron = cron.replace(
    authPattern,
    `
  let authorizedByAdmin = false;
  if (authorization.startsWith("Bearer ")) {
    try {
      const idToken = authorization.slice("Bearer ".length).trim();
      const decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken);
      authorizedByAdmin = String(decodedToken?.email || "").toLowerCase() === "romitoorazio@gmail.com";
    } catch (error) {
      console.warn("Token admin non valido per test email:", error);
    }
  }

  if (!authorizedByCron && !authorizedBySync${hasVercelAuth ? " && !authorizedByVercelCron" : ""} && !authorizedByAdmin) {
    return json(res, 401, { ok: false, message: "Cron non autorizzato." });
  }`
  );
}

if (!cron.includes("const forceTest = Boolean(options.forceTest)")) {
  cron = cron.replace(
    '  const send = Boolean(options.send);',
    '  const send = Boolean(options.send);\n  const forceTest = Boolean(options.forceTest);'
  );
}

if (!cron.includes("Gelone - TEST email promemoria")) {
  cron = cron.replace(
    '  const arrivals = await loadArrivalBookings(adminDb, tomorrow);',
    `  if (forceTest) {
    const primaryEmail = await getPrimaryNotificationEmail(adminDb);
    const recipients = splitEmails(primaryEmail, BROTHER_ARRIVAL_EMAIL);
    const sentAt = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
    await sendResendEmail({
      to: recipients,
      subject: "Gelone - TEST email promemoria",
      text: "TEST RIUSCITO. Sistema email Gelone attivo. Data e ora: " + sentAt,
      html: "<h2>TEST RIUSCITO</h2><p>Il sistema email Gelone è attivo.</p><p>Data e ora: " + escapeHtml(sentAt) + "</p>",
    });
    return {
      ok: true,
      sent: true,
      test: true,
      today,
      tomorrow,
      arrivals: 0,
      emailTo: recipients.join(", "),
      message: "Email di prova inviata correttamente a " + recipients.join(", ") + ".",
    };
  }

  const arrivals = await loadArrivalBookings(adminDb, tomorrow);`
  );
}

if (!cron.includes('forceTest: String(req.query?.test || "") === "1"')) {
  cron = cron.replace(
    '        send: String(req.query?.send || "") === "1",',
    '        send: String(req.query?.send || "") === "1",\n        forceTest: String(req.query?.test || "") === "1",'
  );
}

fs.writeFileSync(cronPath, cron, "utf8");
console.log("Patch test email applicata correttamente.");
