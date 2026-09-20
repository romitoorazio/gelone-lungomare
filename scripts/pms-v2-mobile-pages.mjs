import fs from "node:fs";

const path = new URL("../src/Admin.jsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");
let changes = 0;

const tabs = [
  "dashboard",
  "structure",
  "availability",
  "calendar",
  "new",
  "economy",
  "checks",
  "backup",
  "checkin",
  "preparation",
  "quality",
  "internal",
  "block",
  "units",
  "settings",
  "maintenance",
  "logs",
  "visits",
];

for (const tab of tabs) {
  const marker = `{activeTab === "${tab}" && (`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`[pms-v2-mobile-pages] tab non trovata: ${tab}`);
  }

  const sectionToken = '<section className="';
  const sectionIndex = source.indexOf(sectionToken, markerIndex);
  if (sectionIndex < 0) {
    throw new Error(`[pms-v2-mobile-pages] section non trovata: ${tab}`);
  }

  const classStart = sectionIndex + sectionToken.length;
  const classEnd = source.indexOf('"', classStart);
  if (classEnd < 0) {
    throw new Error(`[pms-v2-mobile-pages] className non valida: ${tab}`);
  }

  const currentClass = source.slice(classStart, classEnd);
  const semanticClass = `pms-page pms-page-${tab}`;
  if (!currentClass.includes(`pms-page-${tab}`)) {
    const nextClass = `${semanticClass} ${currentClass}`;
    source = source.slice(0, classStart) + nextClass + source.slice(classEnd);
    changes += 1;
  }
}

const hookMarker = `  if (!authReady) {\n    return (`;
const hookCode = `  // Mobile table adapter: su iPhone trasforma automaticamente le tabelle operative\n  // in schede leggibili, usando le intestazioni reali come etichette delle celle.\n  useEffect(() => {\n    if (!isAdmin || typeof document === "undefined") return undefined;\n\n    const frame = window.requestAnimationFrame(() => {\n      document.querySelectorAll(".pms-admin .pms-page table").forEach((table) => {\n        table.classList.add("pms-responsive-table");\n        const headers = Array.from(table.querySelectorAll("thead th")).map((cell) =>\n          String(cell.textContent || "").replace(/\\s+/g, " ").trim()\n        );\n\n        table.querySelectorAll("tbody tr").forEach((row) => {\n          Array.from(row.children).forEach((cell, index) => {\n            if (cell.tagName !== "TD" || cell.hasAttribute("colspan")) return;\n            if (headers[index]) cell.setAttribute("data-label", headers[index]);\n          });\n        });\n      });\n    });\n\n    return () => window.cancelAnimationFrame(frame);\n  });\n\n`;

if (!source.includes("Mobile table adapter:")) {
  if (!source.includes(hookMarker)) {
    throw new Error("[pms-v2-mobile-pages] punto inserimento hook non trovato");
  }
  source = source.replace(hookMarker, hookCode + hookMarker);
  changes += 1;
}

fs.writeFileSync(path, source, "utf8");
console.log(`[pms-v2-mobile-pages] completato: ${changes} modifiche.`);
