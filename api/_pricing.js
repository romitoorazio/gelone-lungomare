import { DEFAULT_UNIT_ID } from "./_units.js";

export const DEFAULT_PRICING = {
  nightlyRate: 70,
  cleaningFee: 0,
  minimumNights: 1,
  depositPercent: 30,
  directRateText: "Miglior tariffa prenotando dal sito",
  directPaymentEnabled: false,
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

  return {
    nightlyRate: roundMoney(nightlyRate),
    cleaningFee: roundMoney(cleaningFee),
    minimumNights,
    depositPercent,
    directRateText: String(data.directRateText || DEFAULT_PRICING.directRateText).trim(),
    directPaymentEnabled: data.directPaymentEnabled === true,
    settingsDocId,
    source: snapshot.exists ? "firestore" : "fallback",
  };
}

export async function calculateServerBookingPricing(adminDb, unitId, nightsCount) {
  const pricing = await loadServerPricing(adminDb, unitId);
  const nights = Math.max(0, Math.round(Number(nightsCount || 0)));
  const subtotal = roundMoney(nights * pricing.nightlyRate);
  const totalPrice = nights > 0 ? roundMoney(subtotal + pricing.cleaningFee) : 0;
  const depositAmount = totalPrice > 0 ? roundMoney(Math.round((totalPrice * pricing.depositPercent) / 100)) : 0;

  return {
    ...pricing,
    nightsCount: nights,
    subtotal,
    totalPrice,
    depositAmount,
    pricingCalculatedBy: "server",
  };
}
