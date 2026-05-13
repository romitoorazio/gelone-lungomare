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

function isActiveStatus(status) {
  const value = String(status || "").toLowerCase();
  return !["cancelled", "canceled", "deleted", "available", "rejected", "declined"].includes(value);
}

function bookingBelongsToUnit(data) {
  const bookingUnitId = String(data?.unitId || UNIT_ID).trim();
  return bookingUnitId === UNIT_ID;
}

function bookingOverlaps(data, checkIn, checkOut) {
  const bookingCheckIn = String(data?.checkIn || "").trim();
  const bookingCheckOut = String(data?.checkOut || "").trim();

  if (!isValidDate(bookingCheckIn) || !isValidDate(bookingCheckOut)) {
    return false;
  }

  return bookingCheckIn < checkOut && bookingCheckOut > checkIn;
}

async function getOccupiedNightsFromBookings(adminDb, checkIn, checkOut) {
  const occupied = new Set();
  const snapshot = await adminDb.collection("bookings").get();

  snapshot.forEach((doc) => {
    const data = doc.data();

    if (!bookingBelongsToUnit(data) || !isActiveStatus(data?.status) || !bookingOverlaps(data, checkIn, checkOut)) {
      return;
    }

    getNightDates(data.checkIn, data.checkOut)
      .filter((night) => night >= checkIn && night < checkOut)
      .forEach((night) => occupied.add(night));
  });

  return [...occupied].sort();
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, max-age=0");

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

    const occupiedFromNights = nightSnapshots
      .filter((snapshot) => {
        if (!snapshot.exists) return false;
        const data = snapshot.data();
        return isActiveStatus(data?.status);
      })
      .map((snapshot, index) => snapshot.data()?.date || nights[index])
      .filter(Boolean);

    const occupiedFromBookings = await getOccupiedNightsFromBookings(adminDb, checkIn, checkOut);

    const occupiedNights = [...new Set([...occupiedFromNights, ...occupiedFromBookings])].sort();
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
