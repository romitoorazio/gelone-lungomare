import { getFirebaseAdminDb } from "./_firebaseAdmin.js";
import { DEFAULT_UNIT_ID, bookingUnitId, getPublicUnitConfig } from "./_units.js";

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function getDateRange(start, end) {
  const days = [];

  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);

  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const last = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  while (cursor <= last) {
    days.push(toDateInputValue(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function getNightDates(checkIn, checkOut) {
  const nights = [];

  if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkOut <= checkIn) {
    return nights;
  }

  const [startYear, startMonth, startDay] = checkIn.split("-").map(Number);
  const [endYear, endMonth, endDay] = checkOut.split("-").map(Number);

  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const last = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  while (cursor < last) {
    nights.push(toDateInputValue(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return nights;
}

function getQuery(req, key) {
  const value = req.query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return null;
}

function isExpiredPending(data) {
  const status = String(data?.status || "").toLowerCase();

  if (!["pending_direct", "pending", "pending_payment"].includes(status)) {
    return false;
  }

  const expiresAtMillis = toMillis(data?.expiresAt);

  return Boolean(expiresAtMillis && expiresAtMillis <= Date.now());
}

function publicStatusForData(data) {
  if (isExpiredPending(data)) return null;
  return publicStatusForData(data);
}

function publicStatusFromRaw(rawStatus, source) {
  const status = String(rawStatus || "").toLowerCase();
  const sourceValue = String(source || "").toLowerCase();

  if (["cancelled", "canceled", "deleted", "available", "rejected", "declined"].includes(status)) {
    return null;
  }

  if (status === "blocked" || sourceValue === "manual" || sourceValue === "manual_block") {
    return "blocked";
  }

  if (["pending", "pending_direct", "request", "requested"].includes(status)) {
    return "pending_direct";
  }

  return "occupied";
}

function getStatusPriority(status) {
  if (status === "blocked") return 3;
  if (status === "occupied") return 2;
  if (status === "pending_direct") return 1;
  return 0;
}

function setStatus(statusByDate, date, status) {
  if (!date || !status) return;
  const current = statusByDate.get(date);
  if (!current || getStatusPriority(status) >= getStatusPriority(current)) {
    statusByDate.set(date, status);
  }
}

function bookingBelongsToUnit(data, unitId) {
  return bookingUnitId(data) === unitId;
}

function isBookingActive(data) {
  return Boolean(publicStatusForData(data));
}

function getBookingNightsInsideRange(data, start, end) {
  const checkIn = String(data?.checkIn || "").trim();
  const checkOut = String(data?.checkOut || "").trim();

  if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkOut <= checkIn) {
    return [];
  }

  // Nessuna sovrapposizione con il mese richiesto.
  if (checkOut <= start || checkIn > end) {
    return [];
  }

  return getNightDates(checkIn, checkOut).filter((night) => night >= start && night <= end);
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      message: "Metodo non consentito.",
    });
  }

  try {
    const adminDb = getFirebaseAdminDb();
    const requestedUnitId = String(getQuery(req, "unitId") || DEFAULT_UNIT_ID).trim();
    const unit = await getPublicUnitConfig(adminDb, requestedUnitId);

    if (!unit) {
      return res.status(404).json({
        ok: false,
        message: "Unità non disponibile sul sito pubblico.",
      });
    }

    const unitId = unit.id;
    const start = String(getQuery(req, "start") || "").trim();
    const end = String(getQuery(req, "end") || "").trim();

    if (!isValidDate(start) || !isValidDate(end)) {
      return res.status(400).json({
        ok: false,
        message: "Intervallo date non valido.",
      });
    }

    if (end < start) {
      return res.status(400).json({
        ok: false,
        message: "La data finale deve essere successiva o uguale alla data iniziale.",
      });
    }

    const days = getDateRange(start, end);

    if (days.length > 93) {
      return res.status(400).json({
        ok: false,
        message: "Intervallo troppo lungo.",
      });
    }

    const statusByDate = new Map();

    // Fonte 1: nights. È la fonte principale usata dal PMS.
    const refs = days.map((day) => adminDb.collection("nights").doc(`${unitId}_${day}`));
    const snapshots = await adminDb.getAll(...refs);

    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists) return;

      const data = snapshot.data();
      const status = publicStatusForData(data);

      if (status) {
        setStatus(statusByDate, days[index], status);
      }
    });

    // Fonte 2 di sicurezza: bookings. Serve quando esiste una prenotazione/blocco,
    // ma per qualche motivo non sono stati creati tutti i documenti nights.
    const bookingsSnapshot = await adminDb.collection("bookings").get();

    bookingsSnapshot.forEach((doc) => {
      const data = doc.data();

      if (!bookingBelongsToUnit(data, unitId) || !isBookingActive(data)) {
        return;
      }

      const status = publicStatusForData(data);
      const bookingNights = getBookingNightsInsideRange(data, start, end);

      bookingNights.forEach((night) => {
        setStatus(statusByDate, night, status);
      });
    });

    const publicDays = [...statusByDate.entries()]
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, status]) => ({ date, status }));

    return res.status(200).json({
      ok: true,
      unitId,
      unitName: unit.publicName || unit.name,
      start,
      end,
      days: publicDays,
    });
  } catch (error) {
    console.error("Errore public-calendar:", error);

    return res.status(500).json({
      ok: false,
      message: error?.message || "Errore tecnico durante il caricamento calendario.",
    });
  }
}
