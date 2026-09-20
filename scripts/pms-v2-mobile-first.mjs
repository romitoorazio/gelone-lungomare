import fs from "node:fs";

const path = new URL("../src/Admin.jsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");
let changes = 0;

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) {
    throw new Error(`[pms-v2-mobile] blocco non trovato: ${label}`);
  }
  source = source.replace(before, after);
  changes += 1;
  console.log(`[pms-v2-mobile] ${label}`);
}

replaceOnce(
  '<main className="min-h-screen bg-[#faf6ee] text-[#0a1d35]">',
  '<main className="pms-admin min-h-screen bg-[#faf6ee] text-[#0a1d35]">',
  "root admin semantica"
);

replaceOnce(
  '<header className="sticky top-0 z-40 border-b border-[#e4d8c2] bg-[#faf6ee]/95 backdrop-blur">',
  '<header className="pms-admin-header sticky top-0 z-40 border-b border-[#e4d8c2] bg-[#faf6ee]/95 backdrop-blur">',
  "header mobile"
);

replaceOnce(
  '<div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">',
  '<div className="pms-admin-header-inner mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">',
  "contenitore header responsive"
);

replaceOnce(
  '<section className="mx-auto max-w-7xl px-5 py-8">',
  '<section className="pms-admin-shell mx-auto max-w-7xl px-5 py-8">',
  "shell admin responsive"
);

replaceOnce(
  '<div className="grid gap-4 md:grid-cols-7">',
  '<div className="pms-top-stats grid gap-4 md:grid-cols-7">',
  "statistiche principali responsive"
);

replaceOnce(
  '<div className="mt-8 flex flex-wrap gap-3">\n                    <TabButton active={activeTab === "dashboard"}',
  '<div id="pms-more-tabs" className="pms-tab-strip mt-8 flex flex-wrap gap-3">\n                    <TabButton active={activeTab === "dashboard"}',
  "barra schede mobile"
);

replaceOnce(
  `          <TabButton active={activeTab === "visits"} onClick={() => setActiveTab("visits")}>
            Visite sito
          </TabButton>
        </div>`,
  `          <TabButton active={activeTab === "visits"} onClick={() => setActiveTab("visits")}>
            Visite sito
          </TabButton>
        </div>

        <nav className="pms-mobile-nav" aria-label="Navigazione rapida PMS">
          <button
            type="button"
            className={activeTab === "dashboard" ? "is-active" : ""}
            aria-current={activeTab === "dashboard" ? "page" : undefined}
            onClick={() => setActiveTab("dashboard")}
          >
            Oggi
          </button>
          <button
            type="button"
            className={activeTab === "availability" ? "is-active" : ""}
            aria-current={activeTab === "availability" ? "page" : undefined}
            onClick={() => setActiveTab("availability")}
          >
            Calendario
          </button>
          <button
            type="button"
            className={activeTab === "calendar" ? "is-active" : ""}
            aria-current={activeTab === "calendar" ? "page" : undefined}
            onClick={() => setActiveTab("calendar")}
          >
            Prenotazioni
          </button>
          <button
            type="button"
            onClick={() => document.getElementById("pms-more-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Altro
          </button>
        </nav>`,
  "navigazione fissa per iPhone"
);

fs.writeFileSync(path, source, "utf8");
console.log(`[pms-v2-mobile] completato: ${changes} modifiche.`);
