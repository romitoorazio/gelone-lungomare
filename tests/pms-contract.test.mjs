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

test("la sincronizzazione GitHub usa OIDC e non dipende più dal secret condiviso", () => {
  const workflow = read(".github/workflows/sync-calendars.yml");
  const oidcPatch = read("scripts/pms-v2-github-oidc.mjs");
  const pkg = read("package.json");

  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /ACTIONS_ID_TOKEN_REQUEST_TOKEN/);
  assert.match(workflow, /audience=https%3A%2F%2Fwww\.gelone\.it/);
  assert.doesNotMatch(workflow, /secrets\.CRON_SECRET/);
  assert.match(oidcPatch, /verifyGithubActionsOidc/);
  assert.match(oidcPatch, /token\.actions\.githubusercontent\.com/);
  assert.match(oidcPatch, /romitoorazio\/gelone-lungomare/);
  assert.match(oidcPatch, /refs\/heads\/main/);
  assert.match(pkg, /pms-v2-github-oidc\.mjs/);
});

test("l'hardening rimuove il Wi-Fi dal documento pubblico e corregge il click Pulizie", () => {
  const hardening = read("scripts/pms-v2-hardening.mjs");
  assert.match(hardening, /revenue management pubblico senza Wi-Fi/);
  assert.match(hardening, /salvataggio Wi-Fi in privateSettings/);
  assert.match(hardening, /openBookingFromDashboard\(booking, "calendar"\)/);
});

test("la migrazione sicurezza riusa il cron esistente e cancella i campi pubblici", () => {
  const migration = read("scripts/pms-v2-security-migration.mjs");
  assert.match(migration, /migrateSensitivePmsSettings/);
  assert.match(migration, /FieldValue\.delete\(\)/);
  assert.match(migration, /wifiPassword/);
  assert.match(migration, /privateSettings/);
  assert.match(migration, /saveCronSyncLog/);
});

test("l'admin ha una modalità iPhone-first con navigazione rapida", () => {
  const mobilePatch = read("scripts/pms-v2-mobile-first.mjs");
  const mobileCss = read("src/pms-mobile.css");
  const main = read("src/main.jsx");
  const pkg = read("package.json");

  assert.match(mobilePatch, /pms-admin-shell/);
  assert.match(mobilePatch, /pms-mobile-nav/);
  assert.match(mobilePatch, /Calendario/);
  assert.match(mobilePatch, /Prenotazioni/);
  assert.match(mobileCss, /@media \(max-width: 767px\)/);
  assert.match(mobileCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(mobileCss, /env\(safe-area-inset-bottom/);
  assert.match(main, /pms-mobile\.css/);
  assert.match(pkg, /pms-v2-mobile-first\.mjs/);
});

test("tutte le pagine PMS ricevono il trattamento responsive mobile", () => {
  const pagesPatch = read("scripts/pms-v2-mobile-pages.mjs");
  const mobileCss = read("src/pms-mobile.css");
  const pkg = read("package.json");

  for (const tab of [
    "dashboard", "structure", "availability", "calendar", "new", "economy",
    "checks", "backup", "checkin", "preparation", "quality", "internal",
    "block", "units", "settings", "maintenance", "logs", "visits",
  ]) {
    assert.match(pagesPatch, new RegExp(`\\"${tab}\\"`));
  }

  assert.match(pagesPatch, /pms-responsive-table/);
  assert.match(pagesPatch, /data-label/);
  assert.match(pagesPatch, /querySelectorAll\("\.pms-admin \.pms-page table"\)/);
  assert.match(mobileCss, /pms-page:not\(\.pms-page-availability\) \.pms-responsive-table/);
  assert.match(mobileCss, /content: attr\(data-label\)/);
  assert.match(mobileCss, /pms-page-availability \.pms-responsive-table/);
  assert.match(pkg, /pms-v2-mobile-pages\.mjs/);
});
