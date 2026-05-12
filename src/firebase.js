import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCdz5rPl--09OneuaVDUz36qfmcuvMYu0M",
  authDomain: "gelone-lungomare-pms.firebaseapp.com",
  projectId: "gelone-lungomare-pms",
  storageBucket: "gelone-lungomare-pms.firebasestorage.app",
  messagingSenderId: "397268023464",
  appId: "1:397268023464:web:e8bbf7342eac85b6bf2a9d",
  measurementId: "G-CPTBWHN86V",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const ADMIN_EMAILS = ["romitoorazio@gmail.com"];

/*
  IMPORTANTE:
  UNIT_ID resta lunarossa1 perchÃ© Ã¨ l'identificativo interno Firebase.
  Il nome pubblico mostrato nel sito/admin Ã¨ Gelone Lungomare.
*/
export const UNIT_ID = "lunarossa1";
export const UNIT_NAME = "Gelone Lungomare";
