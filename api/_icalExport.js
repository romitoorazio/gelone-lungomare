import { getFirebaseAdminDb } from "./_firebaseAdmin.js";
import { DEFAULT_UNIT_ID, bookingUnitId, getUnitConfig, sanitizeUnitId } from "./_units.js";

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDateForIcs(dateString) {
  return String(dateString || "").replaceAll("-", "");
}

function formatDateTimeForIcs(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function addOneDay(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
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
    nights.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return nights;
}

function isActiveStatus(status) {
  const value = String(status || "").toLowerCase();
  return !["cancelled", "canceled", "deleted", "available", "rejected", "declined"].includes(value);
}

function isActiveNight(data, unitId) {
  return bookingUnitId(data) === unitId && isValidDate(data?.date) && isActiveStatus(data?.status);
}

function getStatusPriority(status) {
  if (status === "blocked") return 3;
  if (["confirmed_direct", "booking", "airbnb", "imported_ical"].includes(status)) return 2;
  if (["pending", "pending_direct"].includes(status)) return 1;
  return 1;
}

function normalizeTarget(value) {
  const target = String(value || "").toLowerCase().trim().replace(/[^a-z0-9_/-]+/g, "_");

  if (target.includes("booking")) return "booking";
  if (target.includes("airbnb")) return "airbnb";

  return "";
}

function getRequestedTarget(req, explicitTarget = "") {
  const fromQuery =
    req?.query?.target ||
    req?.query?.channel ||
    req?.query?.destination ||
    req?.query?.for;
  const value = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery;

  return normalizeTarget(explicitTarget || value);
}

function getChannelText(data, relatedData = null) {
  return [
    data?.source,
    data?.sourceLabel,
    data?.channel,
    data?.origin,
    data?.importSource,
    data?.status,
    relatedData?.source,
    relatedData?.sourceLabel,
    relatedData?.channel,
    relatedData?.origin,
    relatedData?.importSource,
    relatedData?.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isSameChannel(data, target, relatedData = null) {
  if (!target) return false;
  const text = getChannelText(data, relatedData);

  if (target === "booking") return text.includes("booking");
  if (target === "airbnb") return text.includes("airbnb");

  return false;
}

function shouldExportToTarget(data, target, relatedData = null) {
  // Feed vecchio senza target: resta identico a prima per non rompere link esistenti.
  if (!target) return true;

  // Regola anti-loop:
  // - feed dato a Booking: esporta sito/manuale/Airbnb, ma NON Booking;
  // - feed dato ad Airbnb: esporta sito/manuale/Booking, ma NON Airbnb.
  return !isSameChannel(data, target, relatedData);
}

function isStandaloneManualNight(data) {
  const status = String(data?.status || "").toLowerCase();
  const source = String(data?.source || data?.origin || data?.channel || "").toLowerCase();

  return (
    status === "blocked" ||
    source === "manual" ||
    source === "manual_block" ||
    source === "pms_block"
  );
}

function shouldExportNightDocument(data, relatedBooking) {
  // Se la notte è collegata a una prenotazione/blocco ancora esistente, è valida.
  if (relatedBooking) return true;

  // Le notti manuali pure possono esistere anche senza documento bookings.
  if (isStandaloneManualNight(data)) return true;

  // Protezione: una night orfana legata a una vecchia richiesta sito/import iCal
  // non deve più bloccare Booking/Airbnb né ricomparire nei feed.
  return false;
}

function setNight(nightsByDate, night) {
  const current = nightsByDate.get(night.date);
  if (!current || getStatusPriority(night.status) >= getStatusPriority(current.status)) {
    nightsByDate.set(night.date, night);
  }
}

function getGroupKey(night) {
  return [
    night.bookingId || "manual",
    night.status || "occupied",
    night.source || "pms",
    night.guestName || "",
  ].join("|");
}

function groupConsecutiveNights(nights) {
  const sortedNights = [...nights].sort((a, b) => {
    if (a.date === b.date) return getGroupKey(a).localeCompare(getGroupKey(b));
    return a.date.localeCompare(b.date);
  });
  const groups = [];

  for (const night of sortedNights) {
    const key = getGroupKey(night);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.key === key && addOneDay(lastGroup.endDate) === night.date) {
      lastGroup.endDate = night.date;
      lastGroup.nights.push(night);
    } else {
      groups.push({
        key,
        startDate: night.date,
        endDate: night.date,
        nights: [night],
        bookingId: night.bookingId || "",
        status: night.status || "occupied",
        source: night.source || "pms",
        guestName: night.guestName || "",
      });
    }
  }

  return groups;
}

function getSummary(group, unitName, includeGuestDetails = false) {
  const source = String(group.source || "").toLowerCase();

  if (group.status === "blocked" || source === "manual_block" || source === "manual") {
    return `Bloccato - ${unitName}`;
  }

  if (source === "direct_site" || group.status === "pending_direct") {
    return `Richiesta sito - ${unitName}`;
  }

  const guestName = String(group.guestName || "").trim();
  if (includeGuestDetails && guestName) {
    return `${guestName} - ${unitName}`;
  }

  return `Occupato - ${unitName}`;
}

function getTargetLabel(target) {
  if (target === "booking") return "Booking";
  if (target === "airbnb") return "Airbnb";
  return "tutti i canali";
}

export async function sendIcal(req, res, requestedUnitId = DEFAULT_UNIT_ID, explicitTarget = "") {
  try {
    const adminDb = getFirebaseAdminDb();
    const unitId = sanitizeUnitId(requestedUnitId || req?.query?.unitId || DEFAULT_UNIT_ID) || DEFAULT_UNIT_ID;
    const target = getRequestedTarget(req, explicitTarget);
    const unit = await getUnitConfig(adminDb, unitId);

    if (!unit) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(404).send("Unità non trovata.");
    }

    const unitName = unit.publicName || unit.name;
    const nightsByDate = new Map();

    const bookingsSnapshot = await adminDb.collection("bookings").get();
    const bookingsById = new Map();

    bookingsSnapshot.forEach((doc) => {
      bookingsById.set(doc.id, { id: doc.id, ...doc.data() });
    });

    const nightsSnapshot = await adminDb
      .collection("nights")
      .where("unitId", "==", unit.id)
      .get();

    nightsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (!isActiveNight(data, unit.id)) return;

      const relatedBookingId = String(data.bookingId || "").trim();
      const relatedBooking = relatedBookingId ? bookingsById.get(relatedBookingId) : null;

      if (!shouldExportNightDocument(data, relatedBooking)) return;
      if (!shouldExportToTarget(data, target, relatedBooking)) return;

      setNight(nightsByDate, {
        id: doc.id,
        date: data.date,
        bookingId: data.bookingId || "",
        status: data.status || relatedBooking?.status || "occupied",
        source: data.source || relatedBooking?.source || "pms",
        guestName: data.guestName || relatedBooking?.guestName || "",
      });
    });

    // Sicurezza: se esiste una prenotazione in bookings ma mancano le nights,
    // il calendario esportato resta comunque occupato.
    bookingsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (bookingUnitId(data) !== unit.id || !isActiveStatus(data?.status)) return;
      if (!shouldExportToTarget(data, target)) return;

      getNightDates(data.checkIn, data.checkOut).forEach((date) => {
        setNight(nightsByDate, {
          id: `${doc.id}_${date}`,
          date,
          bookingId: doc.id,
          status: data.status || "occupied",
          source: data.source || "pms",
          guestName: data.guestName || "",
        });
      });
    });

    const groups = groupConsecutiveNights([...nightsByDate.values()]);
    const now = formatDateTimeForIcs();

    const events = groups.map((group, index) => {
      const checkIn = formatDateForIcs(group.startDate);
      const checkOut = formatDateForIcs(addOneDay(group.endDate));
      const uidBase = group.bookingId || `${unit.id}-${group.startDate}-${group.endDate}-${index}`;
      const includeGuestDetails = !target;

      const description = [
        `Struttura: ${unitName}`,
        `Unità: ${unit.name}`,
        includeGuestDetails && group.guestName ? `Ospite: ${group.guestName}` : "",
        `Stato: ${group.status}`,
        `Origine: ${group.source}`,
        target ? `Feed destinato a: ${getTargetLabel(target)}` : "Feed destinato a: tutti i canali",
        `Arrivo: ${group.startDate}`,
        `Partenza: ${addOneDay(group.endDate)}`,
      ]
        .filter(Boolean)
        .join("\n");

      return [
        "BEGIN:VEVENT",
        `UID:${escapeIcsText(uidBase)}@gelone.it`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${checkIn}`,
        `DTEND;VALUE=DATE:${checkOut}`,
        `SUMMARY:${escapeIcsText(getSummary(group, unitName, includeGuestDetails))}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        "TRANSP:OPAQUE",
        "STATUS:CONFIRMED",
        "END:VEVENT",
      ].join("\r\n");
    });

    const calendarName = target ? `${unitName} - blocchi per ${getTargetLabel(target)}` : unitName;
    const calendarDescription = target
      ? `Disponibilità ${unitName} filtrata per ${getTargetLabel(target)}`
      : `Disponibilità ${unitName}`;

    const calendar = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Gelone Lungomare//PMS Calendar//IT",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
      `X-WR-CALDESC:${escapeIcsText(calendarDescription)}`,
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, max-age=0");

    return res.status(200).send(calendar);
  } catch (error) {
    console.error("Errore calendario iCal Gelone:", error);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(500).send("Errore generazione calendario Gelone.");
  }
}
