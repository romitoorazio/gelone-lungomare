import fs from "node:fs";

const cronPath = new URL("../api/cron-sync-calendars.js", import.meta.url);
let source = fs.readFileSync(cronPath, "utf8");

const before = `  const authorizedByCron =
    Boolean(cronSecret) && authorization === \`Bearer \${cronSecret}\`;
  const authorizedBySync =
    Boolean(syncSecret) &&
    (authorization === \`Bearer \${syncSecret}\` ||
      xSyncSecret === syncSecret ||
      querySecret === syncSecret);

  if (!authorizedByCron && !authorizedBySync) {
    return json(res, 401, { ok: false, message: "Cron non autorizzato." });
  }
`;

const previousAfter = `  const vercelCronSchedule = getHeader(req, "x-vercel-cron-schedule");
  const userAgent = getHeader(req, "user-agent");
  const authorizedByCron =
    Boolean(cronSecret) && authorization === \`Bearer \${cronSecret}\`;
  const authorizedBySync =
    Boolean(syncSecret) &&
    (authorization === \`Bearer \${syncSecret}\` ||
      xSyncSecret === syncSecret ||
      querySecret === syncSecret);
  const authorizedByVercelCron =
    vercelCronSchedule === "0 5 * * *" &&
    userAgent.toLowerCase().includes("vercel-cron");

  if (!authorizedByCron && !authorizedBySync && !authorizedByVercelCron) {
    return json(res, 401, { ok: false, message: "Cron non autorizzato." });
  }
`;

const after = `  const vercelCronSchedule = getHeader(req, "x-vercel-cron-schedule");
  const userAgent = getHeader(req, "user-agent");
  const authorizedByCron =
    Boolean(cronSecret) && authorization === \`Bearer \${cronSecret}\`;
  const authorizedBySync =
    Boolean(syncSecret) &&
    (authorization === \`Bearer \${syncSecret}\` ||
      xSyncSecret === syncSecret ||
      querySecret === syncSecret);
  const authorizedByVercelCron =
    ["0 5 * * *", "5 5 * * *"].includes(vercelCronSchedule) &&
    userAgent.toLowerCase().includes("vercel-cron");

  if (!authorizedByCron && !authorizedBySync && !authorizedByVercelCron) {
    return json(res, 401, { ok: false, message: "Cron non autorizzato." });
  }
`;

if (source.includes(after)) {
  console.log("Autorizzazione cron Vercel già applicata.");
} else if (source.includes(previousAfter)) {
  source = source.replace(previousAfter, after);
  fs.writeFileSync(cronPath, source, "utf8");
  console.log("Autorizzazione cron Vercel aggiornata per sync ed email arrivi.");
} else if (source.includes(before)) {
  source = source.replace(before, after);
  fs.writeFileSync(cronPath, source, "utf8");
  console.log("Autorizzazione cron Vercel applicata per sync ed email arrivi.");
} else {
  throw new Error("Blocco autorizzazione cron non trovato.");
}
