import { getFirebaseAdminDb } from "./_firebaseAdmin.js";
import { DEFAULT_UNIT_ID, bookingUnitId } from "./_units.js";

const UNIT_ID = DEFAULT_UNIT_ID;
const TARGET_DATE = "2026-06-25";
const TARGET_DOC_ID = `${UNIT_ID}_${TARGET_DATE}`;

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isActiveStatus(status) {
  const value = String(status || "").toLowerCase();
  return !["cancelled", "canceled", "deleted", "available", "rejected", "declined"].includes(value);
}

function bookingOverlapsDate(data, date) {
  const checkIn = String(data?.checkIn || "").trim();
  const checkOut = String(data?.checkOut || "").trim();

  if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkOut <= checkIn) {
    return false;
  }

  return checkIn <= date && checkOut > date;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Metodo non consentito.",
    });
  }

  try {
    const adminDb = getFirebaseAdminDb();
    const nightRef = adminDb.collection("nights").doc(TARGET_DOC_ID);
    const nightSnapshot = await nightRef.get();
    const nightData = nightSnapshot.exists ? nightSnapshot.data() : null;

    const bookingsSnapshot = await adminDb.collection("bookings").get();
    const activeBookings = [];

    bookingsSnapshot.forEach((bookingDoc) => {
      const data = bookingDoc.data();
      if (
        bookingUnitId(data) === UNIT_ID &&
        isActiveStatus(data?.status) &&
        bookingOverlapsDate(data, TARGET_DATE)
      ) {
        activeBookings.push({
          id: bookingDoc.id,
          status: data?.status || "",
          source: data?.source || "",
          checkIn: data?.checkIn || "",
          checkOut: data?.checkOut || "",
          unitId: bookingUnitId(data),
        });
      }
    });

    if (activeBookings.length > 0) {
      return res.status(200).json({
        ok: false,
        deleted: false,
        date: TARGET_DATE,
        nightDocExists: nightSnapshot.exists,
        nightDoc: nightData
          ? {
              status: nightData.status || "",
              source: nightData.source || "",
              bookingId: nightData.bookingId || "",
              unitId: nightData.unitId || "",
              date: nightData.date || "",
            }
          : null,
        activeBookings,
        message:
          "Non ho cancellato nulla: esiste una prenotazione o un blocco attivo che copre il 25 giugno 2026.",
      });
    }

    if (!nightSnapshot.exists) {
      return res.status(200).json({
        ok: true,
        deleted: false,
        date: TARGET_DATE,
        nightDocExists: false,
        activeBookings: [],
        message: "Nessun documento notte fantasma trovato per il 25 giugno 2026.",
      });
    }

    await nightRef.delete();

    return res.status(200).json({
      ok: true,
      deleted: true,
      date: TARGET_DATE,
      deletedDocId: TARGET_DOC_ID,
      deletedNightDoc: {
        status: nightData?.status || "",
        source: nightData?.source || "",
        bookingId: nightData?.bookingId || "",
        unitId: nightData?.unitId || "",
        date: nightData?.date || "",
      },
      activeBookings: [],
      message:
        "Ho cancellato la notte fantasma del 25 giugno 2026 perché non esiste nessuna prenotazione attiva che la copre.",
    });
  } catch (error) {
    console.error("Errore fix-june25-2026:", error);
    return res.status(500).json({
      ok: false,
      deleted: false,
      message: error?.message || "Errore tecnico durante la correzione.",
    });
  }
}
