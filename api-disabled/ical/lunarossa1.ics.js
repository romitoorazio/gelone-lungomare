import { sendIcal } from "../_icalExport.js";

export default async function handler(req, res) {
  return sendIcal(req, res, "lunarossa1");
}
