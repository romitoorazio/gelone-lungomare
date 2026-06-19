import { sendIcal } from "../_icalExport.js";

export default async function handler(req, res) {
  const value = req?.query?.unitId;
  const unitId = Array.isArray(value) ? value[0] : value;
  return sendIcal(req, res, unitId);
}
