import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

let cachedDb = null;

function normalizePrivateKey(value) {
  if (!value) return "";

  let key = String(value).trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  return key.replace(/\\n/g, "\n");
}

function getServiceAccountConfig() {
  const serviceAccountBase64 = String(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || ""
  ).trim();

  if (serviceAccountBase64) {
    const jsonText = Buffer.from(serviceAccountBase64, "base64").toString(
      "utf8"
    );

    const serviceAccount = JSON.parse(jsonText);

    if (
      !serviceAccount.project_id ||
      !serviceAccount.client_email ||
      !serviceAccount.private_key
    ) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_BASE64 non valida. Controlla il file JSON del service account Firebase."
      );
    }

    return {
      projectId: serviceAccount.project_id,
      serviceAccount,
    };
  }

  const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin non configurato. Inserisci FIREBASE_SERVICE_ACCOUNT_BASE64 su Vercel."
    );
  }

  return {
    projectId,
    serviceAccount: {
      projectId,
      clientEmail,
      privateKey,
    },
  };
}

export function getFirebaseAdminDb() {
  if (cachedDb) {
    return cachedDb;
  }

  const { projectId, serviceAccount } = getServiceAccountConfig();

  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert(serviceAccount),
          projectId,
        });

  const databaseId = String(process.env.FIRESTORE_DATABASE_ID || "").trim();

  cachedDb =
    databaseId && databaseId !== "(default)"
      ? getFirestore(app, databaseId)
      : getFirestore(app);

  return cachedDb;
}

export { FieldValue };