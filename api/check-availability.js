import { getFirebaseAdminDb } from "./_firebaseAdmin.js";

const UNIT_ID = "lunarossa1";
const PUBLIC_UNIT_NAME = "Gelone Lungomare";

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function getNightDates(checkIn, checkOut) {
  const nights = [];

  const [startYear, startMonth, startDay] = checkIn.split("-").map(Number);
  const [endYear, endMonth, endDay] = checkOut.split("-").map(Number);

  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  const cursor = new Date(start);

  while (cursor < end) {
    nights.push(toDateInputValue(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return nights;
}

function getBody(req) {
  if (!req.body) return {};

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Metodo non consentito.",
    });
  }

  try {
    const adminDb = getFirebaseAdminDb();
    const body = getBody(req);

    const { checkIn, checkOut } = body;

    if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
      return res.status(400).json({
        ok: false,
        message: "Inserisci date valide.",
      });
    }

    if (checkOut <= checkIn) {
      return res.status(400).json({
        ok: false,
        message: "La data di partenza deve essere successiva alla data di arrivo.",
      });
    }

    const nights = getNightDates(checkIn, checkOut);

    if (nights.length < 1) {
      return res.status(400).json({
        ok: false,
        message: "Devi selezionare almeno una notte.",
      });
    }

    if (nights.length > 60) {
      return res.status(400).json({
        ok: false,
        message: "Per soggiorni superiori a 60 notti contatta la struttura.",
      });
    }

    const nightRefs = nights.map((night) =>
      adminDb.collection("nights").doc(`${UNIT_ID}_${night}`)
    );

    const nightSnapshots = await adminDb.getAll(...nightRefs);

    const occupiedNights = nightSnapshots
      .filter((snapshot) => {
        if (!snapshot.exists) return false;
        const data = snapshot.data();
        return data?.status !== "cancelled";
      })
      .map((snapshot) => snapshot.data()?.date)
      .filter(Boolean);

    const available = occupiedNights.length === 0;

    return res.status(200).json({
      ok: true,
      unitId: UNIT_ID,
      unitName: PUBLIC_UNIT_NAME,
      checkIn,
      checkOut,
      nights,
      available,
      occupiedNights,
      message: available
        ? "Gelone Lungomare risulta disponibile per le date selezionate."
        : "Gelone Lungomare non risulta disponibile per le date selezionate.",
    });
  } catch (error) {
    console.error("Errore check-availability:", error);

    return res.status(500).json({
      ok: false,
      message:
        error?.message ||
        "Errore tecnico durante il controllo disponibilità. Riprova più tardi o contatta la struttura.",
    });
  }
}