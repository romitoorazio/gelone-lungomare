import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

let cachedDb = null;
let cachedAuth = null;

function getServiceAccountConfig() {
  const serviceAccountBase64 = String(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || ""
  ).trim();

  if (!serviceAccountBase64) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 non configurata su Vercel.");
  }

  const jsonText = Buffer.from(serviceAccountBase64, "base64").toString("utf8");
  const serviceAccount = JSON.parse(jsonText);

  if (
    !serviceAccount.project_id ||
    !serviceAccount.client_email ||
    !serviceAccount.private_key
  ) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_BASE64 non valida. Ricontrolla il file JSON Firebase."
    );
  }

  return {
    projectId: serviceAccount.project_id,
    serviceAccount,
  };
}

function getFirebaseAdminApp() {
  const { projectId, serviceAccount } = getServiceAccountConfig();

  return getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
}

export function getFirebaseAdminDb() {
  if (cachedDb) {
    return cachedDb;
  }

  cachedDb = getFirestore(getFirebaseAdminApp());

  return cachedDb;
}

export function getFirebaseAdminAuth() {
  if (cachedAuth) {
    return cachedAuth;
  }

  cachedAuth = getAuth(getFirebaseAdminApp());

  return cachedAuth;
}

export { FieldValue };

