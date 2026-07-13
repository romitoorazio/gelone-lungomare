import cronSyncCalendarsHandler from "./cron-sync-calendars.js";

export default async function handler(req, res) {
  req.query = {
    ...(req.query || {}),
    mode: "arrival-reminders",
    send: "1",
  };

  return cronSyncCalendarsHandler(req, res);
}
