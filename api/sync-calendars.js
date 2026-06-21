import crypto from "node:crypto";
import {
  FieldValue,
  getFirebaseAdminAuth,
  getFirebaseAdminDb,
} from "./_firebaseAdmin.js";
import { DEFAULT_UNIT_ID, getUnitConfig, sanitizeUnitId } from "./_units.js";

const ADMIN_EMAILS = ["romitoorazio@gmail.com", "romitofrancesco1@gmail.com"];
const FETCH_TIMEOUT_MS = 15000;

// Protezione anti-cancellazioni di massa nella sync iCal.
// Se piu' del 30% delle prenotazioni esterne attive di una sorgente
// risulta "sparito" dal feed in una singola sync, blocchiamo tutte le
// cancellazioni di quella sorgente per evitare disastri quando
// Booking/Airbnb restituiscono un feed vuoto o parziale.
const MAX_STALE_EXTERNAL_DELETE_RATIO = 0.30;
// Soglia minima di prenotazioni esterne attive precedenti prima di
// applicare il controllo sul rapporto. Con prev < 2 la guard non scatta,
// cosi' una singola cancellazione legittima passa normalmente.
const MIN_PREVIOUS_FOR_RATIO_CHECK = 2;
const STALE_GUARD_MESSAGE =
  "Sync protetta: troppi eventi esterni risultano spariti dal feed. Nessuna cancellazione applicata.";

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

function daysBetweenDates(fromDateString, toDateString) {
  if (!isValidDate(fromDateString) || !isValidDate(toDateString)) return 0;

  const [fy, fm, fd] = fromDateString.split("-").map(Number);
  const [ty, tm, td] = toDateString.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);

  return Math.round((to - from) / 86400000);
}

function todayUtcDateString() {
  return new Date().toISOString().slice(0, 10);
}

function isAirbnbRollingAvailabilityFence(event) {
  if (!event || event.source !== "airbnb_ical") return false;
  if (!Array.isArray(event.nights) || event.nights.length !== 1) return false;

  const daysAhead = daysBetweenDates(todayUtcDateString(), event.checkIn);

  if (daysAhead < 360 || daysAhead > 370) return false;

  const text = String(
    (event.sourceSummary || "") + " " + (event.sourceDescription || "")
  ).toLowerCase();

  const looksLikeRealReservation =
    text.includes("reservation") ||
    text.includes("prenotazione") ||
    text.includes("confirmed") ||
    text.includes("confermata") ||
    text.includes("guest") ||
    text.includes("ospite") ||
    text.includes("phone") ||
    text.includes("telefono") ||
    text.includes("@");

  return !looksLikeRealReservation;
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

function getImportedBookingCreateDefaults(event, unit) {
  return {
    guestName: event.guestName,
    guestEmail: "",
    guestPhone: "",
    guests: Number(unit.maxGuests || 2),
    status: "imported_ical",
    paymentStatus: "unpaid",
    welcomateStatus: "not_needed",
    notes: event.sourceSummary || event.sourceDescription || "Importata da calendario esterno",
    internalNotes: event.sourceDescription || "",
    createdAt: FieldValue.serverTimestamp(),
  };
}

function getPreservedNightStatus(existingBookingData) {
  const status = cleanText(existingBookingData?.status);
  return status && isActiveStatus(status) ? status : "imported_ical";
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

async function deleteMovedNightsForBooking(adminDb, unitId, bookingId, previousCheckIn, previousCheckOut, currentNights, batch) {
  const previousNights = getNightDates(previousCheckIn, previousCheckOut);
  const currentNightSet = new Set(currentNights);

  const staleNights = previousNights.filter((night) => !currentNightSet.has(night));
  if (staleNights.length === 0) return 0;

  const nightRefs = staleNights.map((night) => adminDb.collection("nights").doc(`${unitId}_${night}`));
  const nightSnapshots = await adminDb.getAll(...nightRefs);

  let deleted = 0;

  nightSnapshots.forEach((snapshot, index) => {
    if (!snapshot.exists) return;
    const data = snapshot.data();

    if (data?.bookingId === bookingId) {
      batch.delete(nightRefs[index]);
      deleted += 1;
    }
  });

  return deleted;
}

async function cancelStaleExternalBookings(adminDb, unitId, sourceConfig, activeExternalKeys, options = {}) {
  const mode = options.mode || "automatic";
  const snapshot = await adminDb
    .collection("bookings")
    .where("source", "==", sourceConfig.key)
    .get();

  const candidates = [];
  let previousActiveCount = 0;

  for (const bookingSnapshot of snapshot.docs) {
    const data = bookingSnapshot.data();

    const bookingUnitId = sanitizeUnitId(data?.unitId || DEFAULT_UNIT_ID) || DEFAULT_UNIT_ID;
    if (bookingUnitId !== unitId) continue;
    if (!data?.externalKey) continue;
    if (!isActiveStatus(data?.status)) continue;

    previousActiveCount += 1;

    if (activeExternalKeys.has(data.externalKey)) continue;

    candidates.push({ ref: bookingSnapshot.ref, id: bookingSnapshot.id, data });
  }

  const staleCount = candidates.length;
  const staleRatio = previousActiveCount > 0 ? staleCount / previousActiveCount : 0;

  if (
    previousActiveCount >= MIN_PREVIOUS_FOR_RATIO_CHECK &&
    staleRatio > MAX_STALE_EXTERNAL_DELETE_RATIO
  ) {
    try {
      const isManual = mode === "manual";
      await adminDb.collection("maintenanceLogs").add({
        type: "calendar_sync",
        action: isManual ? "manual_calendar_sync" : "automatic_calendar_sync",
        mode: isManual ? "manual_guard" : "automatic_guard",
        source: isManual ? "admin_manual_sync" : "vercel_cron",
        triggerSource: isManual ? "admin_manual_sync" : "vercel_cron",
        icalSource: sourceConfig.key,
        sourceLabel: sourceConfig.label,
        unitId,
        ok: false,
        message: STALE_GUARD_MESSAGE,
        guardTriggered: true,
        previousActiveCount,
        staleCount,
        staleRatio,
        staleThreshold: MAX_STALE_EXTERNAL_DELETE_RATIO,
        cancelledStale: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (logError) {
      console.error("Errore scrittura log guard sync calendars:", logError);
    }

    return {
      cancelled: 0,
      guardTriggered: true,
      previousActiveCount,
      staleCount,
      staleRatio,
      staleThreshold: MAX_STALE_EXTERNAL_DELETE_RATIO,
    };
  }

  let cancelled = 0;

  for (const candidate of candidates) {
    const data = candidate.data;
    const nights = getNightDates(data.checkIn, data.checkOut);
    const nightRefs = nights.map((night) => adminDb.collection("nights").doc(`${unitId}_${night}`));
    const nightSnapshots = nightRefs.length > 0 ? await adminDb.getAll(...nightRefs) : [];

    const batch = adminDb.batch();

    nightSnapshots.forEach((nightSnapshot, index) => {
      if (!nightSnapshot.exists) return;
      const nightData = nightSnapshot.data();

      if (nightData?.bookingId === candidate.id) {
        batch.delete(nightRefs[index]);
      }
    });

    batch.set(
      candidate.ref,
      {
        status: "cancelled",
        staleExternal: true,
        staleExternalSource: sourceConfig.key,
        cancellationReason: `Evento non piu presente nel calendario ${sourceConfig.label}`,
        cancelledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();
    cancelled += 1;
  }

  return {
    cancelled,
    guardTriggered: false,
    previousActiveCount,
    staleCount,
    staleRatio,
    staleThreshold: MAX_STALE_EXTERNAL_DELETE_RATIO,
  };
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
      return json(res, 404, { ok: false, message: "Unita non trovata." });
    }

    const settings = await readPrivateSettings(adminDb, unit.id);
    const callMode = authResult.mode === "firebase" ? "manual" : "automatic";
    const totals = {
      imported: 0,
      skippedNoUrl: 0,
      skippedInvalid: 0,
      skippedConflict: 0,
      cancelledStale: 0,
      movedNightsDeleted: 0,
      skippedIgnored: 0,
      staleGuardTriggered: false,
      staleGuardSources: [],
      sources: {},
    };

    for (const sourceConfig of SOURCE_CONFIGS) {
      const url = cleanText(settings[sourceConfig.settingsField]);
      totals.sources[sourceConfig.key] = {
        imported: 0,
        skippedConflict: 0,
        skippedInvalid: 0,
        cancelledStale: 0,
        movedNightsDeleted: 0,
        skippedIgnored: 0,
        urlPresent: Boolean(url),
        guardTriggered: false,
        previousActiveCount: 0,
        staleCount: 0,
        staleRatio: 0,
        staleThreshold: MAX_STALE_EXTERNAL_DELETE_RATIO,
      };

      if (!url) {
        totals.skippedNoUrl += 1;
        continue;
      }

      const icsText = await fetchIcs(url);
      const rawEvents = parseIcsEvents(icsText);
      const normalizedEvents = rawEvents
        .map((event) => normalizeExternalEvent(event, sourceConfig))
        .filter(Boolean);

      const ignoredRollingAvailabilityFence = normalizedEvents.filter((event) =>
        isAirbnbRollingAvailabilityFence(event)
      );

      const events = normalizedEvents.filter(
        (event) => !isAirbnbRollingAvailabilityFence(event)
      );

      const skippedInvalid = Math.max(0, rawEvents.length - normalizedEvents.length);
      totals.skippedInvalid += skippedInvalid;
      totals.sources[sourceConfig.key].skippedInvalid += skippedInvalid;

      if (ignoredRollingAvailabilityFence.length > 0) {
        totals.skippedIgnored += ignoredRollingAvailabilityFence.length;
        totals.sources[sourceConfig.key].skippedIgnored += ignoredRollingAvailabilityFence.length;
      }

      const activeExternalKeys = new Set(events.map((event) => event.externalKey));

      if (rawEvents.length > 0) {
        const staleResult = await cancelStaleExternalBookings(
          adminDb,
          unit.id,
          sourceConfig,
          activeExternalKeys,
          { mode: callMode }
        );
        totals.cancelledStale += staleResult.cancelled;
        totals.sources[sourceConfig.key].cancelledStale += staleResult.cancelled;
        totals.sources[sourceConfig.key].guardTriggered = staleResult.guardTriggered;
        totals.sources[sourceConfig.key].previousActiveCount = staleResult.previousActiveCount;
        totals.sources[sourceConfig.key].staleCount = staleResult.staleCount;
        totals.sources[sourceConfig.key].staleRatio = staleResult.staleRatio;
        totals.sources[sourceConfig.key].staleThreshold = staleResult.staleThreshold;
        if (staleResult.guardTriggered) {
          totals.staleGuardTriggered = true;
          totals.staleGuardSources.push(sourceConfig.key);
        }
      }

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
        const existingBookingSnapshot = await bookingRef.get();
        const existingBookingData = existingBookingSnapshot.exists
          ? existingBookingSnapshot.data()
          : null;

        const wasManuallyCancelledExternal =
          existingBookingData &&
          existingBookingData.externalKey === event.externalKey &&
          existingBookingData.source === event.source &&
          String(existingBookingData.status || "").toLowerCase() === "cancelled" &&
          existingBookingData.staleExternal !== true;

        if (wasManuallyCancelledExternal) {
          totals.skippedIgnored += 1;
          totals.sources[sourceConfig.key].skippedIgnored += 1;

          const ignoredNightSnapshots =
            nightRefs.length > 0 ? await adminDb.getAll(...nightRefs) : [];
          const ignoreBatch = adminDb.batch();
          let deletedIgnoredNights = 0;

          ignoredNightSnapshots.forEach((snapshot, index) => {
            if (!snapshot.exists) return;
            const data = snapshot.data();

            if (data?.bookingId === bookingId) {
              ignoreBatch.delete(nightRefs[index]);
              deletedIgnoredNights += 1;
            }
          });

          if (deletedIgnoredNights > 0) {
            await ignoreBatch.commit();
          }

          continue;
        }

        const movedNightsDeleted = existingBookingSnapshot.exists
          ? await deleteMovedNightsForBooking(
              adminDb,
              unit.id,
              bookingId,
              existingBookingData?.checkIn,
              existingBookingData?.checkOut,
              event.nights,
              batch
            )
          : 0;

        totals.movedNightsDeleted += movedNightsDeleted;
        totals.sources[sourceConfig.key].movedNightsDeleted += movedNightsDeleted;

        const isExistingBooking = existingBookingSnapshot.exists;
        const preservedGuestName = cleanText(existingBookingData?.guestName) || event.guestName;
        const nightStatus = getPreservedNightStatus(existingBookingData);
        const bookingSyncData = {
          unitId: unit.id,
          unitName: unit.publicName || unit.name,
          checkIn: event.checkIn,
          checkOut: event.checkOut,
          source: event.source,
          sourceLabel: event.sourceLabel,
          sourceSummary: event.sourceSummary,
          sourceDescription: event.sourceDescription,
          externalKey: event.externalKey,
          externalUid: event.externalUid || "",
          lastIcalSyncAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          ...(isExistingBooking ? {} : getImportedBookingCreateDefaults(event, unit)),
        };

        batch.set(bookingRef, bookingSyncData, { merge: true });

        event.nights.forEach((night, index) => {
          const existingNightSnapshot = nightSnapshots[index];
          batch.set(
            adminDb.collection("nights").doc(`${unit.id}_${night}`),
            {
              unitId: unit.id,
              date: night,
              bookingId,
              status: nightStatus,
              source: event.source,
              guestName: preservedGuestName,
              updatedAt: FieldValue.serverTimestamp(),
              ...(existingNightSnapshot?.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
            },
            { merge: true }
          );
        });

        await batch.commit();
        totals.imported += 1;
        totals.sources[sourceConfig.key].imported += 1;
      }
    }

    const responsePayload = {
      ok: true,
      unitId: unit.id,
      unitName: unit.publicName || unit.name,
      totals,
      importedBookings: totals.imported,
      skippedNights: totals.skippedConflict,
    };

    if (totals.staleGuardTriggered) {
      responsePayload.warning = STALE_GUARD_MESSAGE;
    }

    return json(res, 200, responsePayload);
  } catch (error) {
    console.error("Errore sync-calendars:", error);
    return json(res, 500, {
      ok: false,
      message: error?.message || "Errore tecnico durante la sincronizzazione calendari.",
    });
  }
}
