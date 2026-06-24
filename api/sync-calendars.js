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

function normalizeForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function getRawIcsEventText(event) {
  const parts = [];
  for (const values of Object.values(event || {})) {
    if (!Array.isArray(values)) continue;
    for (const item of values) {
      parts.push(unescapeIcsText(item?.value || ""));
    }
  }
  return parts.join(" \n ");
}

function isGeloneEchoEvent(event, sourceConfig) {
  // Evita il loop: Booking/Airbnb importano il nostro feed gelone.it e poi ce lo
  // rimandano indietro nel loro iCal. Quegli eventi non devono diventare
  // blocchi reali nel PMS.
  const uid = normalizeForMatch(getFirstIcsValue(event, "UID"));
  const summary = normalizeForMatch(unescapeIcsText(getFirstIcsValue(event, "SUMMARY")));
  const description = normalizeForMatch(unescapeIcsText(getFirstIcsValue(event, "DESCRIPTION")));
  const location = normalizeForMatch(unescapeIcsText(getFirstIcsValue(event, "LOCATION")));
  const rawText = normalizeForMatch(getRawIcsEventText(event));
  const text = `${uid} ${summary} ${description} ${location} ${rawText}`;

  if (uid.includes("gelone.it") || uid.includes("gelone-lungomare")) return true;
  if (text.includes("gelone.it") && text.includes("booking_ical")) return true;
  if (text.includes("gelone.it") && text.includes("airbnb_ical")) return true;
  if (text.includes("struttura: gelone lungomare") && text.includes("origine:")) return true;
  if (text.includes("gelone lungomare") && text.includes("importata ical")) return true;
  if (text.includes("occupato - gelone") || text.includes("bloccato - gelone")) return true;
  if (text.includes("richiesta sito - gelone")) return true;

  if (sourceConfig?.key === "booking_ical" && text.includes("gelone")) {
    const looksLikeOwnExport =
      text.includes("origine:") ||
      text.includes("source:") ||
      text.includes("site") ||
      text.includes("sito") ||
      text.includes("ical");
    if (looksLikeOwnExport) return true;
  }

  return false;
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

async function markMissingExternalBookingsForReview(adminDb, unitId, sourceConfig, activeExternalKeys, options = {}) {
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

  let markedForReview = 0;

  for (const candidate of candidates) {
    await candidate.ref.set(
      {
        staleExternal: true,
        staleExternalSource: sourceConfig.key,
        syncWarning: true,
        syncReviewRequired: true,
        syncReviewReason: `Evento non trovato nell'ultimo calendario ${sourceConfig.label}. Prenotazione mantenuta attiva per sicurezza.`,
        lastMissingFromIcalAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    markedForReview += 1;
  }

  if (markedForReview > 0) {
    try {
      await adminDb.collection("maintenanceLogs").add({
        type: "calendar_sync",
        action: mode === "manual" ? "manual_calendar_sync" : "automatic_calendar_sync",
        mode,
        source: mode === "manual" ? "admin_manual_sync" : "vercel_cron",
        triggerSource: mode === "manual" ? "admin_manual_sync" : "vercel_cron",
        icalSource: sourceConfig.key,
        sourceLabel: sourceConfig.label,
        unitId,
        ok: true,
        message: "Prenotazioni esterne mancanti mantenute attive e marcate da controllare.",
        previousActiveCount,
        staleCount: candidates.length,
        markedForReview,
        cancelledStale: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (logError) {
      console.error("Errore scrittura log sync calendars review:", logError);
    }
  }

  return {
    cancelled: 0,
    markedForReview,
    guardTriggered: false,
    previousActiveCount,
    staleCount: candidates.length,
    staleRatio: previousActiveCount > 0 ? candidates.length / previousActiveCount : 0,
    staleThreshold: 0,
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
      markedForReview: 0,
      movedNightsDeleted: 0,
      skippedIgnored: 0,
      skippedEcho: 0,
      sources: {},
    };

    for (const sourceConfig of SOURCE_CONFIGS) {
      const url = cleanText(settings[sourceConfig.settingsField]);
      totals.sources[sourceConfig.key] = {
        imported: 0,
        skippedConflict: 0,
        skippedInvalid: 0,
        cancelledStale: 0,
        markedForReview: 0,
        movedNightsDeleted: 0,
        skippedIgnored: 0,
        skippedEcho: 0,
        urlPresent: Boolean(url),
        previousActiveCount: 0,
        staleCount: 0,
        staleRatio: 0,
      };

      if (!url) {
        totals.skippedNoUrl += 1;
        continue;
      }

      const icsText = await fetchIcs(url);
      const rawEvents = parseIcsEvents(icsText);
      const echoEvents = rawEvents.filter((event) => isGeloneEchoEvent(event, sourceConfig));
      const importableRawEvents = rawEvents.filter((event) => !isGeloneEchoEvent(event, sourceConfig));
      const normalizedEvents = importableRawEvents
        .map((event) => normalizeExternalEvent(event, sourceConfig))
        .filter(Boolean);

      const ignoredRollingAvailabilityFence = normalizedEvents.filter((event) =>
        isAirbnbRollingAvailabilityFence(event)
      );

      const events = normalizedEvents.filter(
        (event) => !isAirbnbRollingAvailabilityFence(event)
      );

      const skippedInvalid = Math.max(0, importableRawEvents.length - normalizedEvents.length);
      totals.skippedInvalid += skippedInvalid;
      totals.sources[sourceConfig.key].skippedInvalid += skippedInvalid;

      if (echoEvents.length > 0) {
        totals.skippedEcho += echoEvents.length;
        totals.skippedIgnored += echoEvents.length;
        totals.sources[sourceConfig.key].skippedEcho += echoEvents.length;
        totals.sources[sourceConfig.key].skippedIgnored += echoEvents.length;
      }

      if (ignoredRollingAvailabilityFence.length > 0) {
        totals.skippedIgnored += ignoredRollingAvailabilityFence.length;
        totals.sources[sourceConfig.key].skippedIgnored += ignoredRollingAvailabilityFence.length;
      }

      const activeExternalKeys = new Set(events.map((event) => event.externalKey));

      if (rawEvents.length > 0) {
        const staleResult = await markMissingExternalBookingsForReview(
          adminDb,
          unit.id,
          sourceConfig,
          activeExternalKeys,
          { mode: callMode }
        );
        totals.cancelledStale += staleResult.cancelled;
        totals.markedForReview += staleResult.markedForReview;
        totals.sources[sourceConfig.key].cancelledStale += staleResult.cancelled;
        totals.sources[sourceConfig.key].markedForReview += staleResult.markedForReview;
        totals.sources[sourceConfig.key].previousActiveCount = staleResult.previousActiveCount;
        totals.sources[sourceConfig.key].staleCount = staleResult.staleCount;
        totals.sources[sourceConfig.key].staleRatio = staleResult.staleRatio;
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
            totals.movedNightsDeleted += deletedIgnoredNights;
            totals.sources[sourceConfig.key].movedNightsDeleted += deletedIgnoredNights;
          }

          continue;
        }

        const preservedStatus = getPreservedNightStatus(existingBookingData);
        const movedDeleted = existingBookingData
          ? await deleteMovedNightsForBooking(
              adminDb,
              unit.id,
              bookingId,
              existingBookingData.checkIn,
              existingBookingData.checkOut,
              event.nights,
              batch
            )
          : 0;

        batch.set(
          bookingRef,
          {
            ...(existingBookingData ? {} : getImportedBookingCreateDefaults(event, unit)),
            unitId: unit.id,
            checkIn: event.checkIn,
            checkOut: event.checkOut,
            nights: event.nights.length,
            status: preservedStatus,
            source: event.source,
            sourceLabel: event.sourceLabel,
            externalKey: event.externalKey,
            externalUid: event.externalUid,
            sourceSummary: event.sourceSummary,
            sourceDescription: event.sourceDescription,
            guestName: existingBookingData?.guestName && existingBookingData.guestName !== event.guestName
              ? existingBookingData.guestName
              : event.guestName,
            staleExternal: false,
            syncWarning: false,
            syncReviewRequired: false,
            lastSeenInIcalAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        for (const nightRef of nightRefs) {
          const night = nightRef.id.replace(`${unit.id}_`, "");
          batch.set(
            nightRef,
            {
              unitId: unit.id,
              date: night,
              bookingId,
              source: event.source,
              status: preservedStatus,
              checkIn: event.checkIn,
              checkOut: event.checkOut,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        await batch.commit();
        totals.imported += 1;
        totals.sources[sourceConfig.key].imported += 1;
        totals.movedNightsDeleted += movedDeleted;
        totals.sources[sourceConfig.key].movedNightsDeleted += movedDeleted;
      }
    }

    return json(res, 200, {
      ok: true,
      message: `Sincronizzazione completata. Importate/aggiornate ${totals.imported} prenotazioni.`,
      totals,
    });
  } catch (error) {
    console.error("Errore sync calendars:", error);
    return json(res, 500, {
      ok: false,
      message: error?.message || "Errore durante la sincronizzazione calendari.",
    });
  }
}
