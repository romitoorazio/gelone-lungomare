import crypto from "node:crypto";
import {
  FieldValue,
  getFirebaseAdminAuth,
  getFirebaseAdminDb,
} from "./_firebaseAdmin.js";

const UNIT_ID = "lunarossa1";
const UNIT_NAME = "Gelone Lungomare";
const ADMIN_EMAILS = ["romitoorazio@gmail.com"];

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

function getTodayUtcDateString() {
  return new Date().toISOString().slice(0, 10);
}

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(dateString, amount) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
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

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const compactDateTimeMatch = raw.match(/^(\d{4})(\d{2})(\d{2})T/);
  if (compactDateTimeMatch) {
    return `${compactDateTimeMatch[1]}-${compactDateTimeMatch[2]}-${compactDateTimeMatch[3]}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return toDateInputValue(parsed);
  }

  return "";
}

function getNightDates(checkIn, checkOut) {
  const nights = [];

  if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkOut <= checkIn) {
    return nights;
  }

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

function cleanText(value) {
  return String(value || "").trim();
}

function escapeSingleLine(value) {
  return cleanText(value).replace(/\s+/g, " ").slice(0, 500);
}

function sha1(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex");
}

function getBookingDocId(sourceKey, externalKey) {
  return `sync_${sourceKey}_${sha1(externalKey).slice(0, 32)}`;
}

function unfoldIcsLines(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const unfolded = [];

  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  return unfolded;
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
  const separatorIndex = line.indexOf(":");

  if (separatorIndex < 0) {
    return null;
  }

  const left = line.slice(0, separatorIndex);
  const value = line.slice(separatorIndex + 1);
  const [name, ...params] = left.split(";");

  return {
    name: String(name || "").trim().toUpperCase(),
    params,
    value,
  };
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
      if (current) {
        events.push(current);
      }
      current = null;
      continue;
    }

    if (!current) continue;

    const parsed = splitIcsLine(line);
    if (!parsed?.name) continue;

    if (!current[parsed.name]) {
      current[parsed.name] = [];
    }

    current[parsed.name].push({
      value: parsed.value,
      params: parsed.params,
    });
  }

  return events;
}

function getFirstIcsValue(event, fieldName) {
  return event?.[fieldName]?.[0]?.value || "";
}

function isCancelledOrTransparent(event) {
  const status = cleanText(getFirstIcsValue(event, "STATUS")).toUpperCase();
  const transp = cleanText(getFirstIcsValue(event, "TRANSP")).toUpperCase();

  return status === "CANCELLED" || transp === "TRANSPARENT";
}

function normalizeExternalEvent(event, sourceConfig) {
  if (isCancelledOrTransparent(event)) {
    return null;
  }

  const rawStart = getFirstIcsValue(event, "DTSTART");
  const rawEnd = getFirstIcsValue(event, "DTEND");

  const checkIn = normalizeDateValue(rawStart);
  const checkOut = normalizeDateValue(rawEnd) || addDays(checkIn, 1);

  if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkOut <= checkIn) {
    return null;
  }

  const nights = getNightDates(checkIn, checkOut);

  if (nights.length < 1 || nights.length > 370) {
    return null;
  }

  const uid = cleanText(getFirstIcsValue(event, "UID"));
  const summary = escapeSingleLine(unescapeIcsText(getFirstIcsValue(event, "SUMMARY")));
  const description = escapeSingleLine(
    unescapeIcsText(getFirstIcsValue(event, "DESCRIPTION"))
  );

  const stableSourceValue = uid || `${sourceConfig.key}_${checkIn}_${checkOut}_${summary}`;
  const externalKey = `${sourceConfig.key}:${stableSourceValue}`;

  return {
    externalKey,
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

function isSyncedExternalSource(source) {
  return SOURCE_CONFIGS.some((config) => config.key === source);
}

function isActiveNight(data) {
  const status = String(data?.status || "").toLowerCase();

  return (
    data?.unitId === UNIT_ID &&
    status !== "cancelled" &&
    status !== "canceled" &&
    status !== "deleted" &&
    status !== "available"
  );
}

async function verifyRequest(req) {
  const configuredSecret = cleanText(process.env.SYNC_SECRET);
  const requestSecret = cleanText(getHeader(req, "x-sync-secret"));

  if (configuredSecret && requestSecret && requestSecret === configuredSecret) {
    return {
      ok: true,
      mode: "secret",
    };
  }

  const authorization = getHeader(req, "authorization");
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return {
      ok: false,
      status: 401,
      message: "Accesso non autorizzato. Effettua il login admin e riprova.",
    };
  }

  try {
    const decodedToken = await getFirebaseAdminAuth().verifyIdToken(match[1]);
    const email = cleanText(decodedToken.email).toLowerCase();
    const allowed = ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === email);

    if (!allowed) {
      return {
        ok: false,
        status: 403,
        message: "Email non autorizzata alla sincronizzazione calendari.",
      };
    }

    return {
      ok: true,
      mode: "firebase_auth",
      email,
    };
  } catch {
    return {
      ok: false,
      status: 401,
      message: "Sessione admin scaduta. Esci, rientra e riprova.",
    };
  }
}

async function readCalendarSettings(adminDb) {
  const [privateSnapshot, publicSnapshot] = await Promise.all([
    adminDb.collection("privateSettings").doc("pms").get(),
    adminDb.collection("settings").doc("pms").get(),
  ]);

  const privateSettings = privateSnapshot.exists ? privateSnapshot.data() : {};
  const publicSettings = publicSnapshot.exists ? publicSnapshot.data() : {};

  return {
    bookingIcalUrl: cleanText(
      privateSettings.bookingIcalUrl || publicSettings.bookingIcalUrl || ""
    ),
    airbnbIcalUrl: cleanText(privateSettings.airbnbIcalUrl || ""),
  };
}

async function fetchCalendar(url, label) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/calendar,text/plain,*/*",
      "User-Agent": "Gelone-Lungomare-PMS/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`${label}: calendario non leggibile (${response.status}).`);
  }

  const text = await response.text();

  if (!text.includes("BEGIN:VCALENDAR")) {
    throw new Error(`${label}: il link non sembra un calendario iCal valido.`);
  }

  return text;
}

async function cleanupOldNightsForBooking(adminDb, bookingId, sourceKey, currentNights) {
  const currentNightSet = new Set(currentNights);
  const snapshot = await adminDb
    .collection("nights")
    .where("bookingId", "==", bookingId)
    .get();

  const batch = adminDb.batch();
  let deleted = 0;

  snapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data();

    if (data?.source === sourceKey && !currentNightSet.has(data?.date)) {
      batch.delete(docSnapshot.ref);
      deleted += 1;
    }
  });

  if (deleted > 0) {
    await batch.commit();
  }

  return deleted;
}

async function upsertExternalBooking(adminDb, externalEvent) {
  const bookingId = getBookingDocId(externalEvent.source, externalEvent.externalKey);
  const bookingRef = adminDb.collection("bookings").doc(bookingId);
  const nightRefs = externalEvent.nights.map((night) =>
    adminDb.collection("nights").doc(`${UNIT_ID}_${night}`)
  );

  let wasExisting = false;

  await adminDb.runTransaction(async (transaction) => {
    const bookingSnapshot = await transaction.get(bookingRef);
    wasExisting = bookingSnapshot.exists;

    const nightSnapshots = [];

    for (const nightRef of nightRefs) {
      const nightSnapshot = await transaction.get(nightRef);
      nightSnapshots.push(nightSnapshot);
    }

    const blockers = nightSnapshots
      .filter((nightSnapshot) => {
        if (!nightSnapshot.exists) return false;
        const data = nightSnapshot.data();
        if (!isActiveNight(data)) return false;
        if (data?.bookingId === bookingId) return false;
        return true;
      })
      .map((nightSnapshot) => nightSnapshot.data());

    if (blockers.length > 0) {
      const manualBlockers = blockers.filter(
        (item) => !isSyncedExternalSource(item?.source)
      );

      const duplicateBlockers = blockers.filter((item) =>
        isSyncedExternalSource(item?.source)
      );

      const error = new Error(manualBlockers.length > 0 ? "CONFLICT" : "DUPLICATE");
      error.blockers = blockers;
      error.manualBlockers = manualBlockers;
      error.duplicateBlockers = duplicateBlockers;
      throw error;
    }

    const bookingData = {
      unitId: UNIT_ID,
      unitName: UNIT_NAME,
      guestName: externalEvent.guestName,
      guestEmail: "",
      guestPhone: "",
      checkIn: externalEvent.checkIn,
      checkOut: externalEvent.checkOut,
      guests: 2,
      source: externalEvent.source,
      sourceLabel: externalEvent.sourceLabel,
      status: "confirmed_external",
      totalPrice: null,
      notes: externalEvent.sourceSummary || externalEvent.sourceLabel,
      externalKey: externalEvent.externalKey,
      externalUid: externalEvent.externalUid || "",
      externalSummary: externalEvent.sourceSummary || "",
      externalDescription: externalEvent.sourceDescription || "",
      importedBy: "sync-calendars",
      syncedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!bookingSnapshot.exists) {
      bookingData.createdAt = FieldValue.serverTimestamp();
    }

    transaction.set(bookingRef, bookingData, { merge: true });

    externalEvent.nights.forEach((night) => {
      const nightRef = adminDb.collection("nights").doc(`${UNIT_ID}_${night}`);

      transaction.set(
        nightRef,
        {
          unitId: UNIT_ID,
          date: night,
          bookingId,
          status: "confirmed_external",
          source: externalEvent.source,
          sourceLabel: externalEvent.sourceLabel,
          guestName: externalEvent.guestName,
          externalKey: externalEvent.externalKey,
          externalUid: externalEvent.externalUid || "",
          importedBy: "sync-calendars",
          syncedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  });

  const oldNightsDeleted = await cleanupOldNightsForBooking(
    adminDb,
    bookingId,
    externalEvent.source,
    externalEvent.nights
  );

  return {
    bookingId,
    created: !wasExisting,
    updated: wasExisting,
    oldNightsDeleted,
  };
}

async function cleanupStaleExternalBookings(adminDb, sourceKey, seenExternalKeys) {
  const snapshot = await adminDb
    .collection("bookings")
    .where("source", "==", sourceKey)
    .get();

  let cancelledBookings = 0;
  let deletedNights = 0;

  for (const bookingSnapshot of snapshot.docs) {
    const booking = bookingSnapshot.data();

    if (booking?.unitId !== UNIT_ID) continue;
    if (!booking?.externalKey) continue;
    if (String(booking?.status || "").toLowerCase() === "cancelled") continue;
    if (seenExternalKeys.has(booking.externalKey)) continue;

    const batch = adminDb.batch();

    batch.set(
      bookingSnapshot.ref,
      {
        status: "cancelled",
        cancelledBySync: true,
        cancelledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const nightsSnapshot = await adminDb
      .collection("nights")
      .where("bookingId", "==", bookingSnapshot.id)
      .get();

    nightsSnapshot.forEach((nightSnapshot) => {
      const night = nightSnapshot.data();

      if (night?.source === sourceKey && night?.bookingId === bookingSnapshot.id) {
        batch.delete(nightSnapshot.ref);
        deletedNights += 1;
      }
    });

    await batch.commit();
    cancelledBookings += 1;
  }

  return {
    cancelledBookings,
    deletedNights,
  };
}

async function syncSource(adminDb, sourceConfig, calendarUrl) {
  const result = {
    source: sourceConfig.key,
    label: sourceConfig.label,
    configured: Boolean(calendarUrl),
    imported: 0,
    created: 0,
    updated: 0,
    skippedPast: 0,
    skippedInvalid: 0,
    skippedDuplicate: 0,
    skippedConflict: 0,
    staleCancelled: 0,
    staleNightsDeleted: 0,
    oldNightsDeleted: 0,
    errors: [],
  };

  const seenExternalKeys = new Set();

  if (!calendarUrl) {
    const cleanup = await cleanupStaleExternalBookings(
      adminDb,
      sourceConfig.key,
      seenExternalKeys
    );
    result.staleCancelled = cleanup.cancelledBookings;
    result.staleNightsDeleted = cleanup.deletedNights;
    return result;
  }

  const icsText = await fetchCalendar(calendarUrl, sourceConfig.label);
  const rawEvents = parseIcsEvents(icsText);
  const today = getTodayUtcDateString();

  const normalizedEvents = rawEvents
    .map((event) => normalizeExternalEvent(event, sourceConfig))
    .filter((event) => {
      if (!event) {
        result.skippedInvalid += 1;
        return false;
      }

      if (event.checkOut <= today) {
        result.skippedPast += 1;
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (a.checkIn === b.checkIn) return a.checkOut.localeCompare(b.checkOut);
      return a.checkIn.localeCompare(b.checkIn);
    });

  for (const event of normalizedEvents) {
    try {
      const writeResult = await upsertExternalBooking(adminDb, event);
      seenExternalKeys.add(event.externalKey);
      result.imported += 1;
      result.created += writeResult.created ? 1 : 0;
      result.updated += writeResult.updated ? 1 : 0;
      result.oldNightsDeleted += writeResult.oldNightsDeleted || 0;
    } catch (error) {
      if (error?.message === "DUPLICATE") {
        result.skippedDuplicate += 1;
        continue;
      }

      if (error?.message === "CONFLICT") {
        result.skippedConflict += 1;
        result.errors.push({
          type: "conflict",
          checkIn: event.checkIn,
          checkOut: event.checkOut,
          source: event.sourceLabel,
          message:
            "Evento esterno non importato perché le date sono già occupate da una prenotazione manuale o dal sito.",
        });
        continue;
      }

      result.errors.push({
        type: "error",
        checkIn: event.checkIn,
        checkOut: event.checkOut,
        source: event.sourceLabel,
        message: error?.message || "Errore sconosciuto durante import calendario.",
      });
    }
  }

  const cleanup = await cleanupStaleExternalBookings(
    adminDb,
    sourceConfig.key,
    seenExternalKeys
  );

  result.staleCancelled = cleanup.cancelledBookings;
  result.staleNightsDeleted = cleanup.deletedNights;

  return result;
}

async function writeSyncLog(adminDb, payload) {
  await adminDb.collection("adminLogs").add({
    unitId: UNIT_ID,
    type: "sync_calendars",
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    return json(res, 405, {
      ok: false,
      message: "Metodo non consentito.",
    });
  }

  const requestAuth = await verifyRequest(req);

  if (!requestAuth.ok) {
    return json(res, requestAuth.status || 401, {
      ok: false,
      message: requestAuth.message || "Accesso non autorizzato.",
    });
  }

  const startedAt = new Date();

  try {
    const adminDb = getFirebaseAdminDb();
    const settings = await readCalendarSettings(adminDb);

    const results = [];

    for (const sourceConfig of SOURCE_CONFIGS) {
      const calendarUrl = settings[sourceConfig.settingsField] || "";
      const sourceResult = await syncSource(adminDb, sourceConfig, calendarUrl);
      results.push(sourceResult);
    }

    const totals = results.reduce(
      (accumulator, item) => ({
        imported: accumulator.imported + item.imported,
        created: accumulator.created + item.created,
        updated: accumulator.updated + item.updated,
        skippedDuplicate: accumulator.skippedDuplicate + item.skippedDuplicate,
        skippedConflict: accumulator.skippedConflict + item.skippedConflict,
        staleCancelled: accumulator.staleCancelled + item.staleCancelled,
        staleNightsDeleted: accumulator.staleNightsDeleted + item.staleNightsDeleted,
        oldNightsDeleted: accumulator.oldNightsDeleted + item.oldNightsDeleted,
        errors: accumulator.errors + item.errors.length,
      }),
      {
        imported: 0,
        created: 0,
        updated: 0,
        skippedDuplicate: 0,
        skippedConflict: 0,
        staleCancelled: 0,
        staleNightsDeleted: 0,
        oldNightsDeleted: 0,
        errors: 0,
      }
    );

    await writeSyncLog(adminDb, {
      ok: totals.errors === 0,
      authMode: requestAuth.mode,
      authEmail: requestAuth.email || "",
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      totals,
      results,
    });

    return json(res, 200, {
      ok: true,
      unitId: UNIT_ID,
      unitName: UNIT_NAME,
      message: "Sincronizzazione calendari completata.",
      totals,
      results,
    });
  } catch (error) {
    console.error("Errore sync-calendars:", error);

    try {
      const adminDb = getFirebaseAdminDb();
      await writeSyncLog(adminDb, {
        ok: false,
        authMode: requestAuth.mode,
        authEmail: requestAuth.email || "",
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        error: error?.message || "Errore sconosciuto.",
      });
    } catch (logError) {
      console.error("Errore scrittura log sync-calendars:", logError);
    }

    return json(res, 500, {
      ok: false,
      message:
        error?.message ||
        "Errore tecnico durante la sincronizzazione calendari. Riprova più tardi.",
    });
  }
}
