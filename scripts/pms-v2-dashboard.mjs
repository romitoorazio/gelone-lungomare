import fs from "node:fs";

const path = new URL("../src/Admin.jsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");
let changes = 0;

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) {
    console.warn(`[pms-v2-dashboard] blocco non trovato: ${label}`);
    return;
  }
  source = source.replace(before, after);
  changes += 1;
  console.log(`[pms-v2-dashboard] ${label}`);
}

replaceOnce(
  `  const latestAutomaticSyncLog = useMemo(() => {\n    return visibleSyncLogs.find((item) => item.source === "vercel_cron") || null;\n  }, [visibleSyncLogs]);\n`,
  `  const latestAutomaticSyncLog = useMemo(() => {\n    return visibleSyncLogs.find((item) => item.source === "vercel_cron") || null;\n  }, [visibleSyncLogs]);\n\n  const syncHealth = useMemo(() => {\n    if (!latestAutomaticSyncLog) {\n      return { state: "missing", label: "Da verificare", subtitle: "Nessun log automatico" };\n    }\n\n    if (latestAutomaticSyncLog.ok === false) {\n      return { state: "error", label: "ERRORE", subtitle: formatDateTime(latestAutomaticSyncLog.createdAt) };\n    }\n\n    try {\n      const raw = latestAutomaticSyncLog.createdAt;\n      const date = raw && typeof raw.toDate === "function" ? raw.toDate() : new Date(raw);\n      const ageMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));\n      if (Number.isFinite(ageMinutes) && ageMinutes > 45) {\n        return { state: "stale", label: "IN RITARDO", subtitle: ageMinutes + " min fa" };\n      }\n      return { state: "ok", label: "OK", subtitle: formatDateTime(raw) };\n    } catch {\n      return { state: "unknown", label: "Da verificare", subtitle: formatDateTime(latestAutomaticSyncLog.createdAt) };\n    }\n  }, [latestAutomaticSyncLog]);\n`,
  "health monitor sincronizzazione"
);

replaceOnce(
  `                <StatCard\n                  title="Sync automatica"\n                  value={latestAutomaticSyncLog?.ok === false ? "Errore" : latestAutomaticSyncLog ? "OK" : "-"}\n                  icon={Wifi}\n                  subtitle={latestAutomaticSyncLog ? formatDateTime(latestAutomaticSyncLog.createdAt) : "Nessun log"}\n                />`,
  `                <StatCard\n                  title="Sync automatica"\n                  value={syncHealth.label}\n                  icon={Wifi}\n                  subtitle={syncHealth.subtitle}\n                />`,
  "stato sync nella dashboard"
);

replaceOnce(
  `<StatCard title="Media/notte" value={formatEuro(economyStats.averageNight)} icon={Star} subtitle="Valore medio per notte" />`,
  `<StatCard title="ADR / media notte" value={formatEuro(economyStats.averageNight)} icon={Star} subtitle="Ricavo medio per notte venduta" />`,
  "KPI ADR"
);

replaceOnce(
  `<div className="mt-6 grid gap-4 md:grid-cols-5">\n                  <StatCard title="Liberi" value={availabilityCalendar.stats.freeSlots} icon={ShieldCheck} subtitle="Notti/alloggi" />\n                  <StatCard title="Occupati" value={availabilityCalendar.stats.occupiedSlots} icon={CalendarDays} subtitle="Notti vendute" />\n                  <StatCard title="Richieste" value={availabilityCalendar.stats.requestSlots} icon={RefreshCcw} subtitle="Da confermare" />\n                  <StatCard title="Blocchi" value={availabilityCalendar.stats.blockedSlots} icon={Lock} subtitle="Non vendibili" />\n                  <StatCard title="Alloggi" value={availabilityCalendar.units.length} icon={Building2} subtitle="Nel planning" />\n                </div>`,
  `<div className="mt-6 grid gap-4 md:grid-cols-6">\n                  <StatCard title="Liberi" value={availabilityCalendar.stats.freeSlots} icon={ShieldCheck} subtitle="Notti/alloggi" />\n                  <StatCard title="Occupati" value={availabilityCalendar.stats.occupiedSlots} icon={CalendarDays} subtitle="Notti vendute" />\n                  <StatCard title="Occupazione" value={availabilityCalendar.stats.totalSlots > 0 ? ((availabilityCalendar.stats.occupiedSlots / availabilityCalendar.stats.totalSlots) * 100).toFixed(1) + "%" : "-"} icon={Star} subtitle="Sul mese visualizzato" />\n                  <StatCard title="Richieste" value={availabilityCalendar.stats.requestSlots} icon={RefreshCcw} subtitle="Da confermare" />\n                  <StatCard title="Blocchi" value={availabilityCalendar.stats.blockedSlots} icon={Lock} subtitle="Non vendibili" />\n                  <StatCard title="Alloggi" value={availabilityCalendar.units.length} icon={Building2} subtitle="Nel planning" />\n                </div>`,
  "KPI occupazione nel planning"
);

fs.writeFileSync(path, source, "utf8");
console.log(`[pms-v2-dashboard] completato: ${changes} modifiche.`);
