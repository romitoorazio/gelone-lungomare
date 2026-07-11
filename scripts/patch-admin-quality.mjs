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

// Qualità dati: il consenso è obbligatorio solo per le prenotazioni nate dal sito.
replaceOnce(
  `    if (\n      (source === "direct_site" || ["pending_direct", "confirmed_direct"].includes(status)) &&\n      !(booking.privacyAccepted && booking.termsAccepted)\n    ) {\n      issues.push("Consenso privacy/termini non registrato");\n    }\n`,
  `    if (\n      source === "direct_site" &&\n      !(booking.privacyAccepted && booking.termsAccepted)\n    ) {\n      issues.push("Consenso privacy/termini non registrato");\n    }\n`,
  "privacy solo sito diretto"
);

// Le prenotazioni concluse restano nello storico, ma escono dai controlli operativi.
replaceOnce(
  `  const qualityStats = useMemo(() => {\n    const rows = bookings\n      .filter((booking) => booking.status !== "blocked" && booking.status !== "cancelled")\n      .map((booking) => ({\n`,
  `  const qualityStats = useMemo(() => {\n    const today = getToday();\n    const rows = bookings\n      .filter((booking) => booking.status !== "blocked" && booking.status !== "cancelled")\n      .filter((booking) => {\n        const checkOut = String(booking.checkOut || "");\n        return !checkOut || checkOut >= today;\n      })\n      .map((booking) => ({\n`,
  "archiviazione automatica qualità dati"
);

// Identificatore virtuale usato solo nell'Admin per la vista globale.
replaceOnce(
  `const CLOUDINARY_WIDGET_SCRIPT_URL = "https://upload-widget.cloudinary.com/latest/global/all.js";\n`,
  `const CLOUDINARY_WIDGET_SCRIPT_URL = "https://upload-widget.cloudinary.com/latest/global/all.js";\nconst ALL_UNITS_ID = "__all_units__";\n`,
  "costante tutte le unità"
);

// La voce TUTTE non è una vera unità e non viene mai salvata in Firestore.
replaceOnce(
  `  const selectedUnit =\n    units.find((unit) => unit.id === selectedUnitId) || DEFAULT_UNITS[0];\n`,
  `  const isAllUnits = selectedUnitId === ALL_UNITS_ID;\n  const selectedUnit = isAllUnits\n    ? { ...DEFAULT_UNIT, id: ALL_UNITS_ID, name: "TUTTE LE UNITÀ", publicName: "TUTTE LE UNITÀ" }\n    : units.find((unit) => unit.id === selectedUnitId) || DEFAULT_UNITS[0];\n`,
  "unità virtuale tutte"
);

// Mantiene la selezione globale quando l'elenco unità viene aggiornato.
replaceOnce(
  `        setSelectedUnitId((current) =>\n          nextUnits.some((unit) => unit.id === current) ? current : UNIT_ID\n        );\n`,
  `        setSelectedUnitId((current) =>\n          current === ALL_UNITS_ID || nextUnits.some((unit) => unit.id === current)\n            ? current\n            : UNIT_ID\n        );\n`,
  "mantenimento selezione tutte"
);

// Non carica la scheda modificabile di una singola unità quando è attiva la vista globale.
replaceOnce(
  `  useEffect(() => {\n    setUnitForm(createUnitForm(selectedUnit));\n  }, [selectedUnitId, units]);\n`,
  `  useEffect(() => {\n    if (isAllUnits) return;\n    setUnitForm(createUnitForm(selectedUnit));\n  }, [selectedUnitId, units, isAllUnits]);\n`,
  "protezione form unità"
);

// La raccolta prenotazioni diventa globale quando è selezionato TUTTE.
replaceOnce(
  `          }))\n          .filter((item) => (item.unitId || UNIT_ID) === selectedUnitId);\n`,
  `          }))\n          .filter(\n            (item) =>\n              selectedUnitId === ALL_UNITS_ID ||\n              (item.unitId || UNIT_ID) === selectedUnitId\n          );\n`,
  "filtro prenotazioni globale"
);

// In vista globale usa le impostazioni generali, senza creare documenti fittizi.
replaceOnce(
  `    const publicSettingsDocId = selectedUnitId === UNIT_ID ? "pms" : \`pms_\${selectedUnitId}\`;\n    const privateSettingsDocId = selectedUnitId === UNIT_ID ? "pms" : selectedUnitId;\n`,
  `    const useGeneralSettings = selectedUnitId === UNIT_ID || selectedUnitId === ALL_UNITS_ID;\n    const publicSettingsDocId = useGeneralSettings ? "pms" : \`pms_\${selectedUnitId}\`;\n    const privateSettingsDocId = useGeneralSettings ? "pms" : selectedUnitId;\n`,
  "impostazioni generali vista globale"
);

// Log e registro operativo mostrano tutte le unità nella vista globale.
replaceEvery(
  `.filter((item) => !item.unitId || item.unitId === selectedUnitId)`,
  `.filter(\n        (item) =>\n          selectedUnitId === ALL_UNITS_ID ||\n          !item.unitId ||\n          item.unitId === selectedUnitId\n      )`
);

// Le sezioni che creano o modificano una singola unità tornano automaticamente all'unità principale.
replaceOnce(
  `  function openBookingFromDashboard(booking, targetTab = "calendar") {\n`,
  `  function openAdminTab(tab) {\n    const requiresSpecificUnit = ["new", "block", "units", "settings"].includes(tab);\n\n    if (isAllUnits && requiresSpecificUnit) {\n      setSelectedUnitId(UNIT_ID);\n      setMessage("Per questa operazione ho selezionato Gelone Lungomare. Puoi scegliere un altro alloggio dal menu in alto.");\n    }\n\n    setActiveTab(tab);\n  }\n\n  function openBookingFromDashboard(booking, targetTab = "calendar") {\n`,
  "navigazione protetta"
);

replaceEvery(`onClick={() => setActiveTab("new")}`, `onClick={() => openAdminTab("new")}`);
replaceEvery(`onClick={() => setActiveTab("block")}`, `onClick={() => openAdminTab("block")}`);
replaceEvery(`onClick={() => setActiveTab("units")}`, `onClick={() => openAdminTab("units")}`);
replaceEvery(`onClick={() => setActiveTab("settings")}`, `onClick={() => openAdminTab("settings")}`);

// Aggiunge TUTTE come prima scelta del selettore e apre automaticamente la Dashboard.
replaceOnce(
  `            <select\n              value={selectedUnitId}\n              onChange={(event) => setSelectedUnitId(event.target.value)}\n              className="rounded-full border border-[#d7c49f] bg-white px-5 py-3 font-semibold text-[#0a1d35]"\n            >\n              {units.map((unit) => (\n`,
  `            <select\n              value={selectedUnitId}\n              onChange={(event) => {\n                const nextUnitId = event.target.value;\n                setSelectedUnitId(nextUnitId);\n                if (nextUnitId === ALL_UNITS_ID) {\n                  setSelectedBookingId("");\n                  setActiveTab("dashboard");\n                }\n              }}\n              className="rounded-full border border-[#d7c49f] bg-white px-5 py-3 font-semibold text-[#0a1d35]"\n            >\n              <option value={ALL_UNITS_ID}>TUTTE LE UNITÀ</option>\n              {units.map((unit) => (\n`,
  "opzione tutte nel selettore"
);

// Messaggio visibile per evitare dubbi sulla modalità attiva.
replaceOnce(
  `      <section className="mx-auto max-w-7xl px-5 py-8">\n        <div className="grid gap-4 md:grid-cols-7">\n`,
  `      <section className="mx-auto max-w-7xl px-5 py-8">\n        {isAllUnits && (\n          <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 font-semibold text-blue-950">\n            Vista globale attiva: Dashboard, prenotazioni, economia, check-in, pulizie e controlli comprendono tutte le unità abitative.\n          </div>\n        )}\n        <div className="grid gap-4 md:grid-cols-7">\n`,
  "avviso vista globale"
);

fs.writeFileSync(filePath, source, "utf8");
console.log("Patch Admin applicata: qualità dati corretta e vista TUTTE LE UNITÀ attiva.");
