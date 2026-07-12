import fs from "node:fs";

const cronPath = new URL("../api/cron-sync-calendars.js", import.meta.url);
let source = fs.readFileSync(cronPath, "utf8");

const replacements = [
  ["const arrivalDate = today;", "const arrivalDate = tomorrow;"],
  ["Arrivi di oggi", "Arrivi di domani"],
  ["Promemoria arrivi di oggi", "Promemoria arrivi di domani"],
  ["Riepilogo operativo degli arrivi di oggi", "Riepilogo operativo degli arrivi di domani"],
  ["Nessun arrivo oggi.", "Nessun arrivo domani."],
  ["arrival_reminder_today_", "arrival_reminder_"],
  ["promemoria professionale per gli arrivi di oggi", "promemoria professionale per gli arrivi di domani"],
];

for (const [before, after] of replacements) {
  source = source.split(before).join(after);
}

if (!source.includes("const arrivalDate = tomorrow;")) {
  throw new Error("Impossibile ripristinare il controllo degli arrivi di domani.");
}

if (!source.includes("romitofrancesco1@gmail.com")) {
  throw new Error("Indirizzo di Francesco non presente nel promemoria arrivi.");
}

if (!source.includes("Arrivi di domani")) {
  throw new Error("Testo professionale degli arrivi di domani non presente.");
}

fs.writeFileSync(cronPath, source, "utf8");
console.log("Promemoria verificato: arrivi di domani, invio a Orazio e Francesco, grafica professionale.");
