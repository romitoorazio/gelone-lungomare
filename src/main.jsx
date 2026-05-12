import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
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

export function getFirebaseAdminDb() {
  if (cachedDb) {
    return cachedDb;
  }

  const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  const databaseId = String(
    process.env.FIRESTORE_DATABASE_ID || "(default)"
  ).trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin non configurato. Controlla FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY su Vercel."
    );
  }

  const app = getApps().length
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });

  cachedDb = getFirestore(app, databaseId);

  return cachedDb;
}

export { FieldValue };