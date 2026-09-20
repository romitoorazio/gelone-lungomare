import fs from "node:fs";

const filePath = new URL("../api/cron-sync-calendars.js", import.meta.url);
let source = fs.readFileSync(filePath, "utf8");

const marker = `async function saveCronSyncLog(req, entry) {\n  const adminDb = getFirebaseAdminDb();`;

const migration = `const PMS_SENSITIVE_SETTINGS_FIELDS = [\n  "wifiName",\n  "wifiPassword",\n  "accessCode",\n  "doorCode",\n  "keyboxCode",\n  "lockboxCode",\n  "selfCheckInCode",\n  "accessInstructions",\n];\n\nasync function migrateSensitivePmsSettings(adminDb) {\n  const settingsSnapshot = await adminDb.collection("settings").get();\n  let affectedDocuments = 0;\n\n  for (const document of settingsSnapshot.docs) {\n    const settingsId = String(document.id || "");\n    const privateSettingsId = settingsId === "pms"\n      ? "pms"\n      : settingsId.startsWith("pms_")\n        ? settingsId.slice(4)\n        : "";\n\n    if (!privateSettingsId) continue;\n\n    const data = document.data() || {};\n    const privatePayload = {};\n    const cleanupPayload = {};\n\n    PMS_SENSITIVE_SETTINGS_FIELDS.forEach((field) => {\n      if (!Object.prototype.hasOwnProperty.call(data, field)) return;\n      const value = data[field];\n      if (value !== undefined && value !== null && String(value).trim() !== "") {\n        privatePayload[field] = value;\n      }\n      cleanupPayload[field] = FieldValue.delete();\n    });\n\n    if (Object.keys(cleanupPayload).length === 0) continue;\n\n    const batch = adminDb.batch();\n    batch.set(\n      adminDb.collection("privateSettings").doc(privateSettingsId),\n      {\n        ...privatePayload,\n        migratedSensitiveSettingsAt: FieldValue.serverTimestamp(),\n        updatedAt: FieldValue.serverTimestamp(),\n      },\n      { merge: true }\n    );\n    batch.update(document.ref, {\n      ...cleanupPayload,\n      sensitiveSettingsMigratedAt: FieldValue.serverTimestamp(),\n    });\n    await batch.commit();\n    affectedDocuments += 1;\n  }\n\n  if (affectedDocuments > 0) {\n    await adminDb.collection("maintenanceLogs").add({\n      type: "security_maintenance",\n      action: "migrate_sensitive_settings",\n      ok: true,\n      affectedDocuments,\n      createdAt: FieldValue.serverTimestamp(),\n    });\n  }\n\n  return affectedDocuments;\n}\n\nasync function saveCronSyncLog(req, entry) {\n  const adminDb = getFirebaseAdminDb();\n  try {\n    await migrateSensitivePmsSettings(adminDb);\n  } catch (error) {\n    console.warn("Migrazione impostazioni sensibili non completata:", error);\n  }`;

if (source.includes("async function migrateSensitivePmsSettings(adminDb)")) {
  console.log("[pms-v2-security] migrazione già presente.");
} else if (!source.includes(marker)) {
  throw new Error("Blocco saveCronSyncLog non trovato: impossibile integrare migrazione sicurezza.");
} else {
  source = source.replace(marker, migration);
  fs.writeFileSync(filePath, source, "utf8");
  console.log("[pms-v2-security] migrazione credenziali integrata nel cron esistente.");
}
