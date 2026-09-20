import { FieldValue, getFirebaseAdminDb } from "./_firebaseAdmin.js";

const SENSITIVE_FIELDS = [
  "wifiName",
  "wifiPassword",
  "accessCode",
  "doorCode",
  "keyboxCode",
  "lockboxCode",
  "selfCheckInCode",
  "accessInstructions",
];

function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(payload);
}

function getBearer(req) {
  const value = String(req.headers?.authorization || "").trim();
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function isAuthorized(req) {
  const configured = String(process.env.CRON_SECRET || process.env.SYNC_SECRET || "").trim();
  if (!configured) return false;
  return getBearer(req) === configured;
}

function privateDocIdForPublicSettings(settingsId) {
  if (settingsId === "pms") return "pms";
  if (settingsId.startsWith("pms_")) return settingsId.slice(4);
  return "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, message: "Metodo non consentito." });
  }

  if (!isAuthorized(req)) {
    return json(res, 401, { ok: false, message: "Non autorizzato." });
  }

  try {
    const db = getFirebaseAdminDb();
    const snapshot = await db.collection("settings").get();
    const results = [];

    for (const document of snapshot.docs) {
      const privateDocId = privateDocIdForPublicSettings(document.id);
      if (!privateDocId) continue;

      const data = document.data() || {};
      const privatePayload = {};
      const publicCleanup = {};

      for (const field of SENSITIVE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(data, field)) {
          const value = data[field];
          if (value !== undefined && value !== null && String(value).trim() !== "") {
            privatePayload[field] = value;
          }
          publicCleanup[field] = FieldValue.delete();
        }
      }

      const movedFields = Object.keys(privatePayload);
      const removedFields = Object.keys(publicCleanup);
      if (removedFields.length === 0) continue;

      const batch = db.batch();
      batch.set(
        db.collection("privateSettings").doc(privateDocId),
        {
          ...privatePayload,
          migratedSensitiveSettingsAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      batch.update(document.ref, {
        ...publicCleanup,
        sensitiveSettingsMigratedAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();

      results.push({
        publicSettingsId: document.id,
        privateSettingsId: privateDocId,
        movedFields,
        removedFields,
      });
    }

    await db.collection("maintenanceLogs").add({
      type: "security_maintenance",
      action: "migrate_sensitive_settings",
      ok: true,
      affectedDocuments: results.length,
      createdAt: FieldValue.serverTimestamp(),
    });

    return json(res, 200, {
      ok: true,
      affectedDocuments: results.length,
      results,
      message:
        results.length > 0
          ? "Impostazioni sensibili spostate in privateSettings."
          : "Nessuna impostazione sensibile pubblica da migrare.",
    });
  } catch (error) {
    console.error("Migrazione private settings fallita:", error);
    return json(res, 500, {
      ok: false,
      message: "Migrazione impostazioni sensibili non completata.",
    });
  }
}
