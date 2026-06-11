import crypto from "crypto";
import { getFirebaseAdminDb, FieldValue } from "./_firebaseAdmin.js";
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

function safeDecode(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function getHeader(req, key) {
  const value = req.headers?.[String(key).toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || "").trim();
}

function getClientIp(req) {
  const forwarded = getHeader(req, "x-forwarded-for").split(",")[0].trim();
  return forwarded || getHeader(req, "x-real-ip") || String(req.socket?.remoteAddress || "").trim();
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 32);
}

function maskIp(ip) {
  const value = String(ip || "").trim();

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    const parts = value.split(".");
    return parts[0] + "." + parts[1] + "." + parts[2] + ".0";
  }

  if (value.includes(":")) {
    return value.split(":").slice(0, 4).join(":") + "::";
  }

  return "";
}

function getVisitorDevice(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (/bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegram/.test(ua)) return "bot/preview";
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobile|iphone|android/.test(ua)) return "telefono";
  return "pc";
}

function getVisitorBrowser(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("chrome/") && !ua.includes("edg/")) return "Chrome";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  if (ua.includes("firefox/")) return "Firefox";
  return "Altro";
}

function getVisitorOs(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS";
  if (ua.includes("android")) return "Android";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  return "Altro";
}

function getReferrerCategory(referrer) {
  const value = String(referrer || "").toLowerCase();
  if (!value) return "diretto";
  if (value.includes("google.")) return "Google";
  if (value.includes("booking.")) return "Booking";
  if (value.includes("airbnb.")) return "Airbnb";
  if (value.includes("whatsapp")) return "WhatsApp";
  if (value.includes("facebook") || value.includes("instagram")) return "Social";
  if (value.includes("gelone.it")) return "interno";
  return "altro";
}

async function logPublicVisit(adminDb, req, { unitId, unitName, start, end }) {
  try {
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const hourKey = now.toISOString().slice(0, 13);
    const userAgent = getHeader(req, "user-agent").slice(0, 500);
    const ip = getClientIp(req);
 now.toISOString().slice(0, 10);
    const hourKey = now.toISOString().slice(0, 13);
    const userAgent =    const referrer = getHeader(req, "referer").slice(0, 500);
    const country = getHeader(req, "x-vercel-ip-country") || getHeader(req, "cf-ipcountry") || "";
    const region = getHeader(req, "x-vercel-ip-country-region") || "";
    const city = safeDecode(getHeader(req, "x-vercel-ip-city"));
    const visitKey = hashValue(dateKey + "|" + hourKey + "|" + unitId + "|" + ip + "|" + userAgent);

    await adminDb.collection("maintenanceLogs").doc("site_visit_" + dateKey + "_" + visitKey).set(
      {
        type: "site_visit",
        source: "public_calendar",
        unitId,
        unitName,
        dateKey,
        hourKey,
        lastSeenAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        timesSeen: FieldValue.increment(1),
        ipMasked: maskIp(ip),
        ipHash: hashValue(ip),
        country,
        region,
        city,
        device: getVisitorDevice(userAgent),
        browser: getVisitorBrowser(userAgent),
        os: getVisitorOs(userAgent),
        referrer,
        referrerCategory: getReferrerCategory(referrer),
        userAgent,
        calendarRange: { start, end },
      },
      { merge: true }
    );
  } catch (error) {
    console.warn("Log visita sito non salvato:", error?.message || error);
  }
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
  return publicStatusFromRaw(data?.status, data?.source);
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

    await logPublicVisit(adminDb, req, {
      unitId,
      unitName: unit.publicName || unit.name,
      start,
      end,
    });

    const statusByDate = new Map();

    const bookingsSnapshot = await adminDb.collection("bookings").get();
    const expiredPendingBookingIds = new Set();
    const activeBookingRows = [];

    bookingsSnapshot.forEach((doc) => {
      const data = doc.data();

      if (isExpiredPending(data)) {
        expiredPendingBookingIds.add(doc.id);
      }

      if (!bookingBelongsToUnit(data, unitId) || !isBookingActive(data)) {
        return;
      }

      activeBookingRows.push(data);
    });

    // Fonte 1: nights. È la fonte principale usata dal PMS.
    const refs = days.map((day) => adminDb.collection("nights").doc(`${unitId}_${day}`));
    const snapshots = await adminDb.getAll(...refs);

    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists) return;

      const data = snapshot.data();

      if (expiredPendingBookingIds.has(String(data?.bookingId || "").trim())) {
        return;
      }

      const status = publicStatusForData(data);

      if (status) {
        setStatus(statusByDate, days[index], status);
      }
    });

    // Fonte 2 di sicurezza: bookings. Serve quando esiste una prenotazione/blocco,
    // ma per qualche motivo non sono stati creati tutti i documenti nights.
    activeBookingRows.forEach((data) => {
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
