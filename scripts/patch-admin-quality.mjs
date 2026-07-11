import fs from "node:fs";

const filePath = new URL("../src/Admin.jsx", import.meta.url);
let source = fs.readFileSync(filePath, "utf8");

const privacyBefore = `    if (\n      (source === "direct_site" || ["pending_direct", "confirmed_direct"].includes(status)) &&\n      !(booking.privacyAccepted && booking.termsAccepted)\n    ) {\n      issues.push("Consenso privacy/termini non registrato");\n    }\n`;
const privacyAfter = `    if (\n      source === "direct_site" &&\n      !(booking.privacyAccepted && booking.termsAccepted)\n    ) {\n      issues.push("Consenso privacy/termini non registrato");\n    }\n`;

const qualityBefore = `  const qualityStats = useMemo(() => {\n    const rows = bookings\n      .filter((booking) => booking.status !== "blocked" && booking.status !== "cancelled")\n      .map((booking) => ({\n`;
const qualityAfter = `  const qualityStats = useMemo(() => {\n    const today = getToday();\n    const rows = bookings\n      .filter((booking) => booking.status !== "blocked" && booking.status !== "cancelled")\n      .filter((booking) => {\n        const checkOut = String(booking.checkOut || "");\n        return !checkOut || checkOut >= today;\n      })\n      .map((booking) => ({\n`;

if (source.includes(privacyBefore)) {
  source = source.replace(privacyBefore, privacyAfter);
} else if (!source.includes(privacyAfter)) {
  throw new Error("Blocco privacy atteso non trovato in Admin.jsx");
}

if (source.includes(qualityBefore)) {
  source = source.replace(qualityBefore, qualityAfter);
} else if (!source.includes(qualityAfter)) {
  throw new Error("Blocco qualità dati atteso non trovato in Admin.jsx");
}

fs.writeFileSync(filePath, source, "utf8");
console.log("Patch qualità dati applicata: privacy solo sito diretto e soggiorni conclusi esclusi dai controlli operativi.");
