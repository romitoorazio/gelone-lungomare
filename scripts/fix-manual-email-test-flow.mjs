import fs from "node:fs";

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

const adminPath = new URL("../src/Admin.jsx", import.meta.url);
let admin = fs.readFileSync(adminPath, "utf8");

admin = admin.replace(
  '"/api/cron-sync-calendars?mode=arrival-reminders&send=1&test=1&_=" + Date.now()',
  '"/api/cron-sync-calendars?mode=arrival-reminders&send=1&offset=0&force=1&_=" + Date.now()'
);
admin = admin.replace(
  "Vuoi inviare adesso una vera email di prova a Orazio e Francesco?",
  "Vuoi inviare adesso il riepilogo reale di arrivi e partenze di oggi?"
);
admin = admin.replaceAll("Invia email di prova adesso", "Invia riepilogo di oggi");
admin = admin.replace(
  'const successMessage = data.message || "Email di prova inviata.";',
  'const checkoutText = data.checkoutReminder?.sent ? " Promemoria partenze inviato." : data.checkoutReminder?.message ? " " + data.checkoutReminder.message : "";\n      const successMessage = (data.message || "Controllo giornaliero completato.") + checkoutText;'
);

ensure(admin.includes("force=1"), "Endpoint riepilogo manuale non aggiornato");
fs.writeFileSync(adminPath, admin, "utf8");

const cronPath = new URL("../api/cron-sync-calendars.js", import.meta.url);
let cron = fs.readFileSync(cronPath, "utf8");

cron = cron.replace(
  'const sourceName = options.source || "manual";\n  const adminDb = getFirebaseAdminDb();',
  'const sourceName = options.source || "manual";\n  const forceSend = Boolean(options.forceSend);\n  const adminDb = getFirebaseAdminDb();'
);
cron = cron.replace(
  'if (existingReminder.exists) {\n    return { ok: true, today, sent: false, message: "Promemoria partenze già inviato.", departures: departures.length };\n  }',
  'if (existingReminder.exists && !forceSend) {\n    return { ok: true, today, sent: false, message: "Promemoria partenze già inviato.", departures: departures.length };\n  }'
);
cron = cron.replace(
  'const shouldSend = String(req.query?.send || "") === "1";',
  'const shouldSend = String(req.query?.send || "") === "1";\n      const forceSend = String(req.query?.force || "") === "1";'
);
cron = cron.replace(
  'forceTest: String(req.query?.test || "") === "1",',
  'forceTest: false,'
);
cron = cron.replace(
  'source: "same_cron_as_arrival_reminders",\n      });',
  'source: "manual_daily_summary",\n        forceSend,\n      });'
);

ensure(cron.includes("const forceSend = Boolean(options.forceSend)"), "Forzatura manuale check-out non applicata");
ensure(cron.includes("forceTest: false"), "Test tecnico non disattivato nel riepilogo manuale");
fs.writeFileSync(cronPath, cron, "utf8");

console.log("Pulsante test collegato al riepilogo reale di arrivi e partenze.");
