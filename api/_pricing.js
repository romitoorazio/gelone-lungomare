import { DEFAULT_UNIT_ID } from "./_units.js";

export const DEFAULT_PRICING = {
  nightlyRate: 70,
  cleaningFee: 0,
  minimumNights: 1,
  depositPercent: 30,
  directRateText: "Miglior tariffa prenotando dal sito",
  directPaymentEnabled: false,
  weekendSurcharge: 0,
  lastMinuteDays: 3,
  lastMinuteDiscountPercent: 0,
  highSeasonStart: "",
  highSeasonEnd: "",
  highSeasonNightlyRate: 0,
  highSeasonMinimumNights: 0,
};

export function getPricingSettingsDocId(unitId = DEFAULT_UNIT_ID) {
  const cleanUnitId = String(unitId || DEFAULT_UNIT_ID).trim() || DEFAULT_UNIT_ID;
  return cleanUnitId === DEFAULT_UNIT_ID ? "pms" : `pms_${cleanUnitId}`;
}

function safeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function parseUtcDate(value) {
  if (!isIsoDate(value)) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function daysFromToday(dateString) {
  const date = parseUtcDate(dateString);
  if (!date) return Number.POSITIVE_INFINITY;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((date.getTime() - todayUtc) / 86400000);
}

function isWeekendNight(dateString) {
  const date = parseUtcDate(dateString);
  if (!date) return false;
  const day = date.getUTCDay();
  return day === 5 || day === 6;
}

function isHighSeasonNight(dateString, pricing) {
  if (!isIsoDate(dateString) || !isIsoDate(pricing.highSeasonStart) || !isIsoDate(pricing.highSeasonEnd)) {
    return false;
  }
  return dateString >= pricing.highSeasonStart && dateString <= pricing.highSeasonEnd;
}

export async function loadServerPricing(adminDb, unitId = DEFAULT_UNIT_ID) {
  const settingsDocId = getPricingSettingsDocId(unitId);
  const snapshot = await adminDb.collection("settings").doc(settingsDocId).get();
  const data = snapshot.exists ? snapshot.data() || {} : {};

  const nightlyRate = Math.max(0, safeNumber(data.nightlyRate, DEFAULT_PRICING.nightlyRate));
  const cleaningFee = Math.max(0, safeNumber(data.cleaningFee, DEFAULT_PRICING.cleaningFee));
  const minimumNights = Math.max(1, Math.round(safeNumber(data.minimumNights, DEFAULT_PRICING.minimumNights)));
  const depositPercent = Math.min(
    100,
    Math.max(0, safeNumber(data.depositPercent, DEFAULT_PRICING.depositPercent))
  );
  const weekendSurcharge = Math.max(0, safeNumber(data.weekendSurcharge, DEFAULT_PRICING.weekendSurcharge));
  const lastMinuteDays = Math.max(0, Math.round(safeNumber(data.lastMinuteDays, DEFAULT_PRICING.lastMinuteDays)));
  const lastMinuteDiscountPercent = Math.min(
    60,
    Math.max(0, safeNumber(data.lastMinuteDiscountPercent, DEFAULT_PRICING.lastMinuteDiscountPercent))
  );
  const highSeasonNightlyRate = Math.max(
    0,
    safeNumber(data.highSeasonNightlyRate, DEFAULT_PRICING.highSeasonNightlyRate)
  );
  const highSeasonMinimumNights = Math.max(
    0,
    Math.round(safeNumber(data.highSeasonMinimumNights, DEFAULT_PRICING.highSeasonMinimumNights))
  );

  return {
    nightlyRate: roundMoney(nightlyRate),
    cleaningFee: roundMoney(cleaningFee),
    minimumNights,
    depositPercent,
    directRateText: String(data.directRateText || DEFAULT_PRICING.directRateText).trim(),
    directPaymentEnabled: data.directPaymentEnabled === true,
    weekendSurcharge: roundMoney(weekendSurcharge),
    lastMinuteDays,
    lastMinuteDiscountPercent,
    highSeasonStart: isIsoDate(data.highSeasonStart) ? data.highSeasonStart : "",
    highSeasonEnd: isIsoDate(data.highSeasonEnd) ? data.highSeasonEnd : "",
    highSeasonNightlyRate: roundMoney(highSeasonNightlyRate),
    highSeasonMinimumNights,
    settingsDocId,
    source: snapshot.exists ? "firestore" : "fallback",
  };
}

export function calculateNightlyBreakdown(pricing, nightDates = []) {
  const dates = Array.isArray(nightDates) ? nightDates.filter(isIsoDate) : [];

  return dates.map((date) => {
    const highSeason = isHighSeasonNight(date, pricing) && pricing.highSeasonNightlyRate > 0;
    const weekend = isWeekendNight(date) && pricing.weekendSurcharge > 0;
    const lastMinute =
      pricing.lastMinuteDiscountPercent > 0 &&
      daysFromToday(date) >= 0 &&
      daysFromToday(date) <= pricing.lastMinuteDays;

    let rate = highSeason ? pricing.highSeasonNightlyRate : pricing.nightlyRate;
    if (weekend) rate += pricing.weekendSurcharge;
    const beforeDiscount = roundMoney(rate);
    if (lastMinute) {
      rate = rate * (1 - pricing.lastMinuteDiscountPercent / 100);
    }

    return {
      date,
      baseRate: pricing.nightlyRate,
      highSeason,
      weekend,
      lastMinute,
      beforeDiscount,
      rate: roundMoney(rate),
    };
  });
}

export async function calculateServerBookingPricing(adminDb, unitId, nightsOrCount) {
  const pricing = await loadServerPricing(adminDb, unitId);
  const nightDates = Array.isArray(nightsOrCount) ? nightsOrCount.filter(isIsoDate) : [];
  const nights = nightDates.length > 0
    ? nightDates.length
    : Math.max(0, Math.round(Number(nightsOrCount || 0)));

  const nightlyBreakdown = nightDates.length > 0 ? calculateNightlyBreakdown(pricing, nightDates) : [];
  const subtotal = nightlyBreakdown.length > 0
    ? roundMoney(nightlyBreakdown.reduce((sum, night) => sum + night.rate, 0))
    : roundMoney(nights * pricing.nightlyRate);
  const totalPrice = nights > 0 ? roundMoney(subtotal + pricing.cleaningFee) : 0;
  const depositAmount = totalPrice > 0
    ? roundMoney((totalPrice * pricing.depositPercent) / 100)
    : 0;
  const touchesHighSeason = nightlyBreakdown.some((night) => night.highSeason);
  const effectiveMinimumNights = touchesHighSeason && pricing.highSeasonMinimumNights > 0
    ? Math.max(pricing.minimumNights, pricing.highSeasonMinimumNights)
    : pricing.minimumNights;
  const effectiveNightlyRate = nights > 0 ? roundMoney(subtotal / nights) : 0;

  return {
    ...pricing,
    minimumNights: effectiveMinimumNights,
    baseMinimumNights: pricing.minimumNights,
    nightsCount: nights,
    subtotal,
    totalPrice,
    depositAmount,
    effectiveNightlyRate,
    nightlyBreakdown,
    pricingCalculatedBy: "server_v2",
  };
}
