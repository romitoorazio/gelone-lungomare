import test from "node:test";
import assert from "node:assert/strict";
import { calculateNightlyBreakdown } from "../api/_pricing.js";

const basePricing = {
  nightlyRate: 70,
  weekendSurcharge: 10,
  lastMinuteDays: 0,
  lastMinuteDiscountPercent: 0,
  highSeasonStart: "2026-08-01",
  highSeasonEnd: "2026-08-31",
  highSeasonNightlyRate: 100,
};

test("applica tariffa alta stagione", () => {
  const [night] = calculateNightlyBreakdown(basePricing, ["2026-08-03"]);
  assert.equal(night.highSeason, true);
  assert.equal(night.rate, 100);
});

test("applica supplemento weekend sopra la tariffa stagionale", () => {
  const [night] = calculateNightlyBreakdown(basePricing, ["2026-08-07"]); // venerdì
  assert.equal(night.highSeason, true);
  assert.equal(night.weekend, true);
  assert.equal(night.rate, 110);
});

test("mantiene tariffa base fuori stagione", () => {
  const [night] = calculateNightlyBreakdown(basePricing, ["2026-09-21"]); // lunedì
  assert.equal(night.highSeason, false);
  assert.equal(night.weekend, false);
  assert.equal(night.rate, 70);
});
