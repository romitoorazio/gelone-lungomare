import fs from "node:fs";

const filePath = new URL("../src/Admin.jsx", import.meta.url);
let source = fs.readFileSync(filePath, "utf8");

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) {
    throw new Error(`Blocco non trovato: ${label}`);
  }
  source = source.replace(before, after);
}

function replaceEvery(before, after) {
  if (!source.includes(before)) return;
  source = source.split(before).join(after);
}

replaceOnce(
  `    if (\n      (source === "direct_site" || ["pending_direct", "confirmed_direct"].includes(status)) &&\n      !(booking.privacyAccepted && booking.termsAccepted)\n    ) {\n      issues.push("Consenso privacy/termini non registrato");\n    }\n`,
  `    if (\n      source === "direct_site" &&\n      !(booking.privacyAccepted && booking.termsAccepted)\n    ) {\n      issues.push("Consenso privacy/termini non registrato");\n    }\n`,
  "privacy solo sito diretto"
);

replaceOnce(
  `  const qualityStats = useMemo(() => {\n    const rows = bookings\n      .filter((booking) => booking.status !== "blocked" && booking.status !== "cancelled")\n      .map((booking) => ({\n`,
  `  const qualityStats = useMemo(() => {\n    const today = getToday();\n    const rows = bookings\n      .filter((booking) => booking.status !== "blocked" && booking.status !== "cancelled")\n      .filter((booking) => {\n        const checkOut = String(booking.checkOut || "");\n        return !checkOut || checkOut >= today;\n      })\n      .map((booking) => ({\n`,
  "archiviazione automatica qualità dati"
);

replaceOnce(
  `const CLOUDINARY_WIDGET_SCRIPT_URL = "https://upload-widget.cloudinary.com/latest/global/all.js";\n`,
  `const CLOUDINARY_WIDGET_SCRIPT_URL = "https://upload-widget.cloudinary.com/latest/global/all.js";\nconst ALL_UNITS_ID = "__all_units__";\n`,
  "costante tutte le unità"
);

replaceOnce(
  `  const selectedUnit =\n    units.find((unit) => unit.id === selectedUnitId) || DEFAULT_UNITS[0];\n`,
  `  const isAllUnits = selectedUnitId === ALL_UNITS_ID;\n  const selectedUnit = isAllUnits\n    ? { ...DEFAULT_UNIT, id: ALL_UNITS_ID, name: "TUTTE LE UNITÀ", publicName: "TUTTE LE UNITÀ" }\n    : units.find((unit) => unit.id === selectedUnitId) || DEFAULT_UNITS[0];\n`,
  "unità virtuale tutte"
);

replaceOnce(
  `        setSelectedUnitId((current) =>\n          nextUnits.some((unit) => unit.id === current) ? current : UNIT_ID\n        );\n`,
  `        setSelectedUnitId((current) =>\n          current === ALL_UNITS_ID || nextUnits.some((unit) => unit.id === current)\n            ? current\n            : UNIT_ID\n        );\n`,
  "mantenimento selezione tutte"
);

replaceOnce(
  `  useEffect(() => {\n    setUnitForm(createUnitForm(selectedUnit));\n  }, [selectedUnitId, units]);\n`,
  `  useEffect(() => {\n    if (isAllUnits) return;\n    setUnitForm(createUnitForm(selectedUnit));\n  }, [selectedUnitId, units, isAllUnits]);\n`,
  "protezione form unità"
);

replaceOnce(
  `          }))\n          .filter((item) => (item.unitId || UNIT_ID) === selectedUnitId);\n`,
  `          }))\n          .filter(\n            (item) =>\n              selectedUnitId === ALL_UNITS_ID ||\n              (item.unitId || UNIT_ID) === selectedUnitId\n          );\n`,
  "filtro prenotazioni globale"
);

replaceOnce(
  `    const publicSettingsDocId = selectedUnitId === UNIT_ID ? "pms" : \`pms_\${selectedUnitId}\`;\n    const privateSettingsDocId = selectedUnitId === UNIT_ID ? "pms" : selectedUnitId;\n`,
  `    const useGeneralSettings = selectedUnitId === UNIT_ID || selectedUnitId === ALL_UNITS_ID;\n    const publicSettingsDocId = useGeneralSettings ? "pms" : \`pms_\${selectedUnitId}\`;\n    const privateSettingsDocId = useGeneralSettings ? "pms" : selectedUnitId;\n`,
  "impostazioni generali vista globale"
);

replaceEvery(
  `.filter((item) => !item.unitId || item.unitId === selectedUnitId)`,
  `.filter(\n        (item) =>\n          selectedUnitId === ALL_UNITS_ID ||\n          !item.unitId ||\n          item.unitId === selectedUnitId\n      )`
);

replaceOnce(
  `  function openBookingFromDashboard(booking, targetTab = "calendar") {\n`,
  `  function openAdminTab(tab) {\n    const requiresSpecificUnit = ["new", "block", "units", "settings"].includes(tab);\n\n    if (isAllUnits && requiresSpecificUnit) {\n      setSelectedUnitId(UNIT_ID);\n      setMessage("Per questa operazione ho selezionato Gelone Lungomare. Puoi scegliere un altro alloggio dal menu in alto.");\n    }\n\n    setActiveTab(tab);\n  }\n\n  function openBookingFromDashboard(booking, targetTab = "calendar") {\n`,
  "navigazione protetta"
);

replaceEvery(`onClick={() => setActiveTab("new")}`, `onClick={() => openAdminTab("new")}`);
replaceEvery(`onClick={() => setActiveTab("block")}`, `onClick={() => openAdminTab("block")}`);
replaceEvery(`onClick={() => setActiveTab("units")}`, `onClick={() => openAdminTab("units")}`);
replaceEvery(`onClick={() => setActiveTab("settings")}`, `onClick={() => openAdminTab("settings")}`);

replaceOnce(
  `            <select\n              value={selectedUnitId}\n              onChange={(event) => setSelectedUnitId(event.target.value)}\n              className="rounded-full border border-[#d7c49f] bg-white px-5 py-3 font-semibold text-[#0a1d35]"\n            >\n              {units.map((unit) => (\n`,
  `            <select\n              value={selectedUnitId}\n              onChange={(event) => {\n                const nextUnitId = event.target.value;\n                setSelectedUnitId(nextUnitId);\n                if (nextUnitId === ALL_UNITS_ID) {\n                  setSelectedBookingId("");\n                  setActiveTab("dashboard");\n                }\n              }}\n              className="rounded-full border border-[#d7c49f] bg-white px-5 py-3 font-semibold text-[#0a1d35]"\n            >\n              <option value={ALL_UNITS_ID}>TUTTE LE UNITÀ</option>\n              {units.map((unit) => (\n`,
  "opzione tutte nel selettore"
);

replaceOnce(
  `      <section className="mx-auto max-w-7xl px-5 py-8">\n        <div className="grid gap-4 md:grid-cols-7">\n`,
  `      <section className="mx-auto max-w-7xl px-5 py-8">\n        {isAllUnits && (\n          <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 font-semibold text-blue-950">\n            Vista globale attiva: Dashboard, prenotazioni, economia, check-in, pulizie e controlli comprendono tutte le unità abitative.\n          </div>\n        )}\n        <div className="grid gap-4 md:grid-cols-7">\n`,
  "avviso vista globale"
);

fs.writeFileSync(filePath, source, "utf8");

const cronPath = new URL("../api/cron-sync-calendars.js", import.meta.url);
let cronSource = fs.readFileSync(cronPath, "utf8");

function replaceCron(before, after, label) {
  if (cronSource.includes(after)) return;
  if (!cronSource.includes(before)) throw new Error(`Blocco cron non trovato: ${label}`);
  cronSource = cronSource.replace(before, after);
}

replaceCron(
  `async function loadArrivalBookings(adminDb, tomorrow) {\n  const snapshot = await adminDb\n    .collection("bookings")\n    .where("checkIn", "==", tomorrow)\n`,
  `async function loadArrivalBookings(adminDb, arrivalDate) {\n  const snapshot = await adminDb\n    .collection("bookings")\n    .where("checkIn", "==", arrivalDate)\n`,
  "data arrivi del giorno"
);

replaceCron(
  `async function sendArrivalReminderEmail(adminDb, tomorrow, arrivals) {`,
  `async function sendArrivalReminderEmail(adminDb, arrivalDate, arrivals) {`,
  "parametro data email"
);

const oldEmailBlock = `  const rowsText = arrivals\n    .map((booking) =>\n      [\n        "Alloggio: " + booking.unitName,\n        "Ospite: " + (booking.guestName || "Ospite"),\n        "Telefono: " + (booking.guestPhone || "-"),\n        "Arrivo: " + (booking.checkIn || "-"),\n        "Partenza: " + (booking.checkOut || "-"),\n        "Notti: " + (booking.nights || "-"),\n        "Pagamento: " + arrivalLabel(booking.paymentStatus),\n        "WelcoMate: " + arrivalLabel(booking.welcomateStatus),\n        "Prezzo: " + formatArrivalEuro(booking.totalPrice || 0),\n      ].join("\\n")\n    )\n    .join("\\n\\n---\\n\\n");\n\n  const subject =\n    "Gelone - Arrivi di domani " + tomorrow + " (" + arrivals.length + ")";\n  const text =\n    "Promemoria arrivi di domani\\n\\n" +\n    "Data arrivo: " + tomorrow + "\\n" +\n    "Arrivi: " + arrivals.length + "\\n\\n" +\n    rowsText;\n  const html =\n    '<div style="font-family:Arial,sans-serif;color:#0a1d35;line-height:1.5;">' +\n    '<h2>Promemoria arrivi di domani</h2>' +\n    '<p>Domani <strong>' + escapeHtml(tomorrow) + '</strong> sono previsti <strong>' + arrivals.length + '</strong> arrivi.</p>' +\n    '<pre style="white-space:pre-wrap;background:#faf6ee;padding:14px;border-radius:12px;">' + escapeHtml(rowsText) + '</pre>' +\n    '</div>';`;

const newEmailBlock = `  const rowsText = arrivals\n    .map((booking) =>\n      [\n        "Alloggio: " + booking.unitName,\n        "Ospite: " + (booking.guestName || "Ospite"),\n        "Telefono: " + (booking.guestPhone || "-"),\n        "Arrivo: " + (booking.checkIn || "-"),\n        "Partenza: " + (booking.checkOut || "-"),\n        "Notti: " + (booking.nights || "-"),\n        "Pagamento: " + arrivalLabel(booking.paymentStatus),\n        "WelcoMate: " + arrivalLabel(booking.welcomateStatus),\n        "Totale: " + formatArrivalEuro(booking.totalPrice || 0),\n      ].join("\\n")\n    )\n    .join("\\n\\n---\\n\\n");\n\n  const cardsHtml = arrivals.map((booking) =>\n    '<div style="margin:0 0 18px;border:1px solid #e4d8c2;border-radius:16px;overflow:hidden;background:#ffffff;">' +\n      '<div style="background:#0a1d35;color:#ffffff;padding:14px 18px;font-size:18px;font-weight:700;">' + escapeHtml(booking.unitName || "Alloggio") + '</div>' +\n      '<div style="padding:18px;">' +\n        '<div style="font-size:20px;font-weight:700;margin-bottom:12px;">' + escapeHtml(booking.guestName || "Ospite") + '</div>' +\n        '<table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px;">' +\n          '<tr><td style="padding:6px 0;color:#6b6257;width:42%;">Telefono</td><td style="padding:6px 0;font-weight:600;">' + escapeHtml(booking.guestPhone || "-") + '</td></tr>' +\n          '<tr><td style="padding:6px 0;color:#6b6257;">Soggiorno</td><td style="padding:6px 0;font-weight:600;">' + escapeHtml(booking.checkIn || "-") + ' → ' + escapeHtml(booking.checkOut || "-") + '</td></tr>' +\n          '<tr><td style="padding:6px 0;color:#6b6257;">Notti</td><td style="padding:6px 0;font-weight:600;">' + escapeHtml(booking.nights || "-") + '</td></tr>' +\n          '<tr><td style="padding:6px 0;color:#6b6257;">Pagamento</td><td style="padding:6px 0;font-weight:600;">' + escapeHtml(arrivalLabel(booking.paymentStatus)) + '</td></tr>' +\n          '<tr><td style="padding:6px 0;color:#6b6257;">WelcoMate</td><td style="padding:6px 0;font-weight:600;">' + escapeHtml(arrivalLabel(booking.welcomateStatus)) + '</td></tr>' +\n          '<tr><td style="padding:6px 0;color:#6b6257;">Totale</td><td style="padding:6px 0;font-weight:700;color:#9b6b25;">' + escapeHtml(formatArrivalEuro(booking.totalPrice || 0)) + '</td></tr>' +\n        '</table>' +\n      '</div>' +\n    '</div>'\n  ).join("");\n\n  const subject = "Gelone Lungomare · Arrivi di oggi " + arrivalDate + " (" + arrivals.length + ")";\n  const text =\n    "GELONE LUNGOMARE\\nPromemoria arrivi di oggi\\n\\n" +\n    "Data: " + arrivalDate + "\\n" +\n    "Arrivi previsti: " + arrivals.length + "\\n\\n" +\n    rowsText;\n  const html =\n    '<div style="margin:0;background:#f7f2e9;padding:24px 12px;font-family:Arial,sans-serif;color:#0a1d35;line-height:1.5;">' +\n      '<div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #e4d8c2;border-radius:20px;overflow:hidden;">' +\n        '<div style="background:#faf6ee;padding:24px;border-bottom:1px solid #e4d8c2;">' +\n          '<div style="font-size:12px;letter-spacing:3px;color:#9b6b25;font-weight:700;">MINI PMS FIREBASE</div>' +\n          '<div style="font-size:28px;font-weight:700;margin-top:6px;">Gelone Lungomare</div>' +\n          '<div style="margin-top:8px;color:#6b6257;">Riepilogo operativo degli arrivi di oggi</div>' +\n        '</div>' +\n        '<div style="padding:24px;">' +\n          '<div style="background:#0a1d35;color:white;border-radius:14px;padding:16px 18px;margin-bottom:22px;">' +\n            '<div style="font-size:13px;opacity:.8;">DATA ARRIVI</div>' +\n            '<div style="font-size:24px;font-weight:700;margin-top:4px;">' + escapeHtml(arrivalDate) + '</div>' +\n            '<div style="margin-top:4px;">' + arrivals.length + (arrivals.length === 1 ? ' arrivo previsto' : ' arrivi previsti') + '</div>' +\n          '</div>' +\n          cardsHtml +\n          '<div style="margin-top:22px;padding-top:16px;border-top:1px solid #e4d8c2;color:#6b6257;font-size:13px;">Messaggio automatico riservato alla gestione interna della struttura.</div>' +\n        '</div>' +\n      '</div>' +\n    '</div>';`;

replaceCron(oldEmailBlock, newEmailBlock, "email professionale arrivi");

replaceCron(
  `  const tomorrow = getRomeDate(1);\n  const arrivals = await loadArrivalBookings(adminDb, tomorrow);`,
  `  const arrivalDate = today;\n  const arrivals = await loadArrivalBookings(adminDb, arrivalDate);`,
  "arrivi di oggi"
);

cronSource = cronSource
  .replaceAll("tomorrow,", "arrivalDate,")
  .replaceAll("tomorrow\n", "arrivalDate\n")
  .replaceAll('"Nessun arrivo domani."', '"Nessun arrivo oggi."')
  .replaceAll('"arrival_reminder_" + tomorrow', '"arrival_reminder_today_" + arrivalDate')
  .replaceAll("sendArrivalReminderEmail(adminDb, tomorrow, arrivals)", "sendArrivalReminderEmail(adminDb, arrivalDate, arrivals)");

fs.writeFileSync(cronPath, cronSource, "utf8");
console.log("Patch applicata: Admin globale e promemoria professionale per gli arrivi di oggi.");
