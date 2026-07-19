import { sendIcal } from "../_icalExport.js";

export default async function handler(req, res) {
  const value = req?.query?.unitId;
  const rawUnitId = Array.isArray(value) ? value[0] : value;

  // Compatibilità con i collegamenti già configurati nei portali esterni
  // (es. /api/ical/lunarossa1.ics) oltre al nuovo URL senza estensione.
  const unitId = String(rawUnitId || "").replace(/\.ics$/i, "");

  return sendIcal(req, res, unitId);
}
