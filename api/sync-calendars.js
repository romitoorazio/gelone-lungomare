import crypto from "node:crypto";
import {
  FieldValue,
  getFirebaseAdminAuth,
  getFirebaseAdminDb,
} from "./_firebaseAdmin.js";
import { DEFAULT_UNIT_ID, getUnitConfig, sanitizeUnitId } from "./_units.js";

const ADMIN_EMAILS = ["romitoorazio@gmail.com", "romitofrancesco1@gmail.com"];
const FETCH_TIMEOUT_MS = 15000;

const SOURCE_CONFIGS = [
  {
    key: "booking_ical",
    label: "Booking",
    settingsField: "bookingIcalUrl",
    guestName: "Prenotazione Booking",
  },
  {
    key: "airbnb_ical",
    label: "Airbnb",
    settingsField: "airbnbIcalUrl",
    guestName: "Prenotazione Airbnb",
  },
];

function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(payload);
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()] || req.headers?.[name];
  if (Array.isArray(value)) return value[0] || "";
  return String(value || "");
}

function cleanText(value) {
  return String(value || "").trim();
}

function escapeSingleLine(value) {
  return cleanText(value).replace(/\s+/g, " ").slice(0, 500);
}

function sha1(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex");
}

function getBookingDocId(unitId, sourceKey, externalKey) {
  return `sync_${unitId}_${sourceKey}_${sha1(externalKey).slice(0, 24)}`;
}

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(dateString, amount) {
  const [y, m, d] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeDateValue(value) {
  const raw = String(value || "").trim();
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return toDateInputValue(parsed);
  return "";
}

function getNightDates(checkIn, checkOut) {
  const nights = [];
  if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkOut <= checkIn) {
    return nights;
  }
  const [sy, sm, sd] = checkIn.split("-").map(Number);
  const [ey, em, ed] = checkOut.split("-").map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  const cursor = new Date(start);
  while (cursor < end) {
    nights.push(toDateInputValue(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

function unfoldIcsLines(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const out = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescapeIcsText(value) {
  return String(value || "")
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function splitIcsLine(line) {
  const i = line.indexOf(":");
  if (i < 0) return null;
  const left = line.slice(0, i);
  const value = line.slice(i + 1);
  const [name, ...params] = left.split(";");
  return { name: String(name || "").trim().toUpperCase(), params, value };
}

function parseIcsEvents(icsText) {
  const lines = unfoldIcsLines(icsText);
  const events = [];
  let current = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const parsed = splitIcsLine(line);
    if (!parsed?.name) continue;
    if (!current[parsed.name]) current[parsed.name] = [];
    current[parsed.name].push({ value: parsed.value, params: parsed.params });
  }
  return events;
}

function getFirstIcsValue(event, name) {
  return event?.[name]?.[0]?.value || "";
}

function isCancelledOrTransparent(event) {
  const status = cleanText(getFirstIcsValue(event, "STATUS")).toUpperCase();
  const transp = cleanText(getFirstIcsValue(event, "TRANSP")).toUpperCase();
  return status === "CANCELLED" || transp === "TRANSPARENT";
}

function normalizeExternalEvent(event, sourceConfig) {
  if (isCancelledOrTransparent(event)) return null;

  const rawStart = getFirstIcsValue(event, "DTSTART");
  const rawEnd = getFirstIcsValue(event, "DTEND");
  const checkIn = normalizeDateValue(rawStart);
  const checkOut = normalizeDateValue(rawEnd) || addDays(checkIn, 1);

  if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkOut <= checkIn) {
    return null;
  }

  const nights = getNightDates(checkIn, checkOut);
  if (nights.length < 1 || nights.length > 370) return null;

  const uid = cleanText(getFirstIcsValue(event, "UID"));
  const summary = escapeSingleLine(unescapeIcsText(getFirstIcsValue(event, "SUMMARY")));
  const description = escapeSingleLine(unescapeIcsText(getFirstIcsValue(event, "DESCRIPTION")));
  const stable = uid || `${sourceConfig.key}_${checkIn}_${checkOut}_${summary}`;

  return {
    externalKey: `${sourceConfig.key}:${stable}`,
    externalUid: uid,
    source: sourceConfig.key,
    sourceLabel: sourceConfig.label,
    sourceSummary: summary,
    sourceDescription: description,
    guestName: sourceConfig.guestName,
    checkIn,
    checkOut,
    nights,
  };
}

function isActiveStatus(status) {
  const value = String(status || "").toLowerCase();
  return !["cancelled", "canceled", "deleted", "available", "rejected", "declined"].includes(value);
}

async function verifyRequest(req) {
  const configuredSecret = cleanText(process.env.SYNC_SECRET);
  const requestSecret = cleanText(getHeader(req, "x-sync-secret"));

  if (configuredSecret && requestSecret && requestSecret === configuredSecret) {
    return { ok: true, mode: "secret" };
  }

  const authorization = getHeader(req, "authorization");
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return { ok: false, status: 401, message: "Accesso non autorizzato. Effettua il login admin e riprova." };
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(match[1]);
    const email = cleanText(decoded.email).toLowerCase();
    const allowed = ADMIN_EMAILS.some((a) => a.toLowerCase() === email);
    if (!allowed) {
      return { ok: false, status: 403, message: "Email non autorizzata alla sincronizzazione calendari." };
    }
    return { ok: true, mode: "firebase", email };
  } catch (error) {
    return { ok: false, status: 401, message: "Sessione admin non valida. Rieffettua il login." };
  }
}

async function fetchIcs(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "GelonePMS/1.0" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function readPrivateSettings(adminDb, unitId) {
  const unitSpecific = await adminDb.collection("privateSettings").doc(unitId).get();
  if (unitSpecific.exists) return unitSpecific.data();

  const legacy = await adminDb.collection("privateSettings").doc("pms").get();
  return legacy.exists ? legacy.data() : {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, message: "Metodo non consentito." });
  }

  const authResult = await verifyRequest(req);
  if (!authResult.ok) {
    return json(res, authResult.status, { ok: false, message: authResult.message });
  }

  try {
    const adminDb = getFirebaseAdminDb();
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const requestedUnitId = sanitizeUnitId(body.unitId || DEFAULT_UNIT_ID) || DEFAULT_UNIT_ID;
    const unit = await getUnitConfig(adminDb, requestedUnitId);

    if (!unit) {
      return json(res, 404, { ok: false, message: "Unità non trovata." });
    }

    const settings = await readPrivateSettings(adminDb, unit.id);
    const totals = {
      imported: 0,
      skippedNoUrl: 0,
      skippedInvalid: 0,
      skippedConflict: 0,
      sources: {},
    };

    for (const sourceConfig of SOURCE_CONFIGS) {
      const url = cleanText(settings[sourceConfig.settingsField]);
      totals.sources[sourceConfig.key] = { imported: 0, skippedConflict: 0, skippedInvalid: 0, urlPresent: Boolean(url) };

      if (!url) {
        totals.skippedNoUrl += 1;
        continue;
      }

      const icsText = await fetchIcs(url);
      const events = parseIcsEvents(icsText)
        .map((event) => normalizeExternalEvent(event, sourceConfig))
        .filter(Boolean);

      for (const event of events) {
        const bookingId = getBookingDocId(unit.id, sourceConfig.key, event.externalKey);
        const nightRefs = event.nights.map((night) => adminDb.collection("nights").doc(`${unit.id}_${night}`));
        const nightSnapshots = await adminDb.getAll(...nightRefs);
        const hasConflict = nightSnapshots.some((snapshot) => {
          if (!snapshot.exists) return false;
          const data = snapshot.data();
          return isActiveStatus(data?.status) && data?.bookingId && data.bookingId !== bookingId;
        });

        if (hasConflict) {
          totals.skippedConflict += 1;
          totals.sources[sourceConfig.key].skippedConflict += 1;
          continue;
        }

        const batch = adminDb.batch();
        const bookingRef = adminDb.collection("bookings").doc(bookingId);

        batch.set(
          bookingRef,
          {
            unitId: unit.id,
            unitName: unit.publicName || unit.name,
            guestName: event.guestName,
            guestEmail: "",
            guestPhone: "",
            checkIn: event.checkIn,
            checkOut: event.checkOut,
            guests: Number(unit.maxGuests || 2),
            source: event.source,
            status: "imported_ical",
            paymentStatus: "unpaid",
            welcomateStatus: "not_needed",
            notes: event.sourceSummary || event.sourceDescription || "Importata da calendario esterno",
            internalNotes: event.sourceDescription || "",
            externalKey: event.externalKey,
            externalUid: event.externalUid || "",
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        event.nights.forEach((night) => {
          batch.set(
            adminDb.collection("nights").doc(`${unit.id}_${night}`),
            {
              unitId: unit.id,
              date: night,
              bookingId,
              status: "imported_ical",
              source: event.source,
              guestName: event.guestName,
              updatedAt: FieldValue.serverTimestamp(),
              createdAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        });

        await batch.commit();
        totals.imported += 1;
        totals.sources[sourceConfig.key].imported += 1;
      }
    }

    return json(res, 200, {
      ok: true,
      unitId: unit.id,
      unitName: unit.publicName || unit.name,
      totals,
      importedBookings: totals.imported,
      skippedNights: totals.skippedConflict,
    });
  } catch (error) {
    console.error("Errore sync-calendars:", error);
    return json(res, 500, {
      ok: false,
      message: error?.message || "Errore tecnico durante la sincronizzazione calendari.",
    });
  }
}
