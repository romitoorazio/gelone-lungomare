import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("le prenotazioni dirette proteggono le notti con una transazione Firestore", () => {
  const source = read("api/create-booking.js");
  assert.match(source, /runTransaction/);
  assert.match(source, /DATES_NOT_AVAILABLE/);
  assert.match(source, /collection\("nights"\)/);
});

test("Stripe deduplica gli eventi webhook", () => {
  const source = read("api/stripe-webhook.js");
  assert.match(source, /collection\("stripeEvents"\)/);
  assert.match(source, /eventSnapshot\.exists/);
  assert.match(source, /runTransaction/);
});

test("le impostazioni private non sono leggibili pubblicamente", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/privateSettings\/\{document=\*\*\}/);
  assert.match(rules, /allow read, write: if isAdmin\(\)/);
});

test("le sole impostazioni PMS previste restano pubbliche", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /settingId == "pms"/);
  assert.match(rules, /settingId == "units"/);
  assert.match(rules, /settingId\.matches\('pms_\.\*'\)/);
});

test("la sincronizzazione OTA è programmata ogni 15 minuti", () => {
  const workflow = read(".github/workflows/sync-calendars.yml");
  assert.match(workflow, /cron: "\*\/15 \* \* \* \*"/);
  assert.match(workflow, /cancel-in-progress: false/);
});

test("l'hardening rimuove il Wi-Fi dal documento pubblico e corregge il click Pulizie", () => {
  const hardening = read("scripts/pms-v2-hardening.mjs");
  assert.match(hardening, /rimozione Wi-Fi dalle impostazioni pubbliche/);
  assert.match(hardening, /salvataggio Wi-Fi in privateSettings/);
  assert.match(hardening, /openBookingFromDashboard\(booking, "calendar"\)/);
});

test("l'endpoint di migrazione elimina credenziali dal documento pubblico", () => {
  const migration = read("api/migrate-private-settings.js");
  assert.match(migration, /FieldValue\.delete\(\)/);
  assert.match(migration, /wifiPassword/);
  assert.match(migration, /privateSettings/);
});
