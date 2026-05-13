import { getFirebaseAdminDb } from "./_firebaseAdmin.js";

const DEFAULT_UNIT_ID = "lunarossa1";
const ALLOWED_UNIT_IDS = new Set(["lunarossa1"]);

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

function getQuery(req, key) {
  const value = req.query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function publicStatus(status) {
  if (!status || status === "cancelled") return null;
  if (status === "blocked") return "blocked";
  if (["pending", "pending_direct"].includes(status)) return "pending_direct";
  return "occupied";
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      message: "Metodo non consentito.",
    });
  }

  try {
    const requestedUnitId = String(getQuery(req, "unitId") || DEFAULT_UNIT_ID).trim();
    const unitId = ALLOWED_UNIT_IDS.has(requestedUnitId)
      ? requestedUnitId
      : DEFAULT_UNIT_ID;
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

    const adminDb = getFirebaseAdminDb();
    const refs = days.map((day) => adminDb.collection("nights").doc(`${unitId}_${day}`));
    const snapshots = await adminDb.getAll(...refs);

    const publicDays = snapshots
      .map((snapshot, index) => {
        if (!snapshot.exists) return null;

        const data = snapshot.data();
        const status = publicStatus(data?.status);

        if (!status) return null;

        return {
          date: days[index],
          status,
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      ok: true,
      unitId,
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
