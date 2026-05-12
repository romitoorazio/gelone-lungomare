import { getFirebaseAdminDb } from "../_firebaseAdmin.js";

const UNIT_ID = "lunarossa1";
const UNIT_NAME = "Gelone Lungomare";

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

function isActiveNight(data) {
  const status = String(data?.status || "").toLowerCase();

  return (
    data?.unitId === UNIT_ID &&
    isValidDate(data?.date) &&
    status !== "cancelled" &&
    status !== "canceled" &&
    status !== "deleted" &&
    status !== "available"
  );
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

    if (
      lastGroup &&
      lastGroup.key === key &&
      addOneDay(lastGroup.endDate) === night.date
    ) {
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

function getSummary(group) {
  const source = String(group.source || "").toLowerCase();

  if (source === "manual_block") {
    return `Bloccato - ${UNIT_NAME}`;
  }

  if (source === "direct_site") {
    return `Richiesta sito - ${UNIT_NAME}`;
  }

  return `Occupato - ${UNIT_NAME}`;
}

export default async function handler(req, res) {
  try {
    const adminDb = getFirebaseAdminDb();

    const snapshot = await adminDb
      .collection("nights")
      .where("unitId", "==", UNIT_ID)
      .get();

    const activeNights = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      if (!isActiveNight(data)) {
        return;
      }

      activeNights.push({
        id: doc.id,
        date: data.date,
        bookingId: data.bookingId || "",
        status: data.status || "occupied",
        source: data.source || "pms",
        guestName: data.guestName || "",
      });
    });

    const groups = groupConsecutiveNights(activeNights);
    const now = formatDateTimeForIcs();

    const events = groups.map((group, index) => {
      const checkIn = formatDateForIcs(group.startDate);
      const checkOut = formatDateForIcs(addOneDay(group.endDate));

      const uidBase =
        group.bookingId ||
        `${UNIT_ID}-${group.startDate}-${group.endDate}-${index}`;

      const description = [
        `Struttura: ${UNIT_NAME}`,
        `Stato: ${group.status}`,
        `Origine: ${group.source}`,
        `Arrivo: ${group.startDate}`,
        `Partenza: ${addOneDay(group.endDate)}`,
      ].join("\n");

      return [
        "BEGIN:VEVENT",
        `UID:${escapeIcsText(uidBase)}@gelone.it`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${checkIn}`,
        `DTEND;VALUE=DATE:${checkOut}`,
        `SUMMARY:${escapeIcsText(getSummary(group))}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        "TRANSP:OPAQUE",
        "STATUS:CONFIRMED",
        "END:VEVENT",
      ].join("\r\n");
    });

    const calendar = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Gelone Lungomare//PMS Calendar//IT",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeIcsText(UNIT_NAME)}`,
      `X-WR-CALDESC:${escapeIcsText(`DisponibilitÃ  ${UNIT_NAME}`)}`,
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
