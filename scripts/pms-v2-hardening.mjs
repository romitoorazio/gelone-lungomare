import fs from "node:fs";

const adminPath = new URL("../src/Admin.jsx", import.meta.url);
let source = fs.readFileSync(adminPath, "utf8");
let changes = 0;

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) {
    console.warn(`[pms-v2] blocco non trovato: ${label}`);
    return;
  }
  source = source.replace(before, after);
  changes += 1;
  console.log(`[pms-v2] applicato: ${label}`);
}

function replaceAll(before, after, label) {
  if (!source.includes(before)) return;
  const parts = source.split(before);
  const count = parts.length - 1;
  source = parts.join(after);
  changes += count;
  console.log(`[pms-v2] applicato ${count}x: ${label}`);
}

// 1) Non lasciare credenziali Wi-Fi di fallback nel bundle pubblico.
replaceOnce(
  '  wifiName: "lunarossa",\n  wifiPassword: "gelone123",',
  '  wifiName: "",\n  wifiPassword: "",',
  "rimozione credenziali Wi-Fi hardcoded"
);

// 2) Wi-Fi deve vivere in privateSettings, non nel documento settings pubblico.
replaceAll(
  '        directPaymentEnabled: Boolean(settings.directPaymentEnabled),\nwifiName: settings.wifiName || "",\n        wifiPassword: settings.wifiPassword || "",\n        unitId: selectedUnitId,',
  '        directPaymentEnabled: Boolean(settings.directPaymentEnabled),\n        unitId: selectedUnitId,',
  "rimozione Wi-Fi dalle impostazioni pubbliche"
);

replaceAll(
  '        notificationEmail: settings.notificationEmail || "info@gelone.it",\n        unitId: selectedUnitId,',
  '        notificationEmail: settings.notificationEmail || "info@gelone.it",\n        wifiName: settings.wifiName || "",\n        wifiPassword: settings.wifiPassword || "",\n        unitId: selectedUnitId,',
  "salvataggio Wi-Fi in privateSettings"
);

// 3) Correzione bug: ogni riga Pulizie deve aprire la propria prenotazione.
replaceAll(
  'onClick={() => openBookingFromDashboard(preparationStats.notReadyRows[0], "calendar")}',
  'onClick={() => openBookingFromDashboard(booking, "calendar")}',
  "apertura corretta prenotazione dalla lista pulizie"
);

// 4) Testo sync aggiornato: l'automatismo può arrivare da GitHub Actions o Vercel.
replaceAll(
  'Nessuna sincronizzazione automatica registrata ancora. Verrà compilata dopo il primo passaggio del cron Vercel.',
  'Nessuna sincronizzazione automatica registrata ancora. Verrà compilata dopo il primo passaggio automatico GitHub Actions/Vercel.',
  "testo monitor sincronizzazione"
);

fs.writeFileSync(adminPath, source, "utf8");
console.log(`[pms-v2] hardening completato: ${changes} modifiche.`);
