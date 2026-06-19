import { sendIcal } from "../_icalExport.js";

function normalizeIcalUnitId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || "").replace(/\.ics$/i, "");
}

export default async function handler(req, res) {
  const unitId = normalizeIcalUnitId(req?.query?.unitId);
  return sendIcal(req, res, unitId);
}
