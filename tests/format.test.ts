import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COUNTRIES, FALLBACK_USD_PER_UNIT } from "../src/lib/countries.ts";
import { convertAmount, formatCompact, formatMoney, toUsdt } from "../src/lib/format.ts";

const SE = COUNTRIES.SE;
const FR = COUNTRIES.FR;

describe("formatMoney", () => {
  it("formats with the country's locale + currency", () => {
    const out = formatMoney(SE, 5000);
    // Locale-dependent but must contain the currency symbol / code + the numeric content.
    assert.match(out, /5/);
    // SEK currency
    assert.match(out, /kr|SEK/);
  });

  it("drops fractional digits (maximumFractionDigits: 0)", () => {
    const out = formatMoney(FR, 1234);
    assert.equal(/[,.]\d/.test(out), false);
  });
});

describe("formatCompact", () => {
  it("returns the raw integer below 1000", () => {
    assert.equal(formatCompact(0), "0");
    assert.equal(formatCompact(1), "1");
    assert.equal(formatCompact(999), "999");
  });

  it("collapses to integer-k form on round thousands", () => {
    assert.equal(formatCompact(1000), "1k");
    assert.equal(formatCompact(2000), "2k");
    assert.equal(formatCompact(5000), "5k");
  });

  it("uses one decimal for non-round thousands", () => {
    assert.equal(formatCompact(2500), "2.5k");
    assert.equal(formatCompact(1500), "1.5k");
  });

  it("strips a trailing .0 (defensive)", () => {
    assert.equal(formatCompact(3000), "3k");
  });
});

describe("toUsdt", () => {
  it("uses the fallback table when no rates are provided", () => {
    const usd = toUsdt(SE, 1000);
    const expected = Math.round(1000 * FALLBACK_USD_PER_UNIT.SEK * 100) / 100;
    assert.equal(usd, expected);
  });

  it("override rates win over the fallback", () => {
    const usd = toUsdt(SE, 1000, { SEK: 0.5 });
    assert.equal(usd, 500);
  });

  it("rounds to 2 decimals", () => {
    const usd = toUsdt(SE, 333, { SEK: 0.333333 });
    assert.equal(usd, Math.round(333 * 0.333333 * 100) / 100);
  });

  it("handles zero amount", () => {
    assert.equal(toUsdt(SE, 0), 0);
  });
});

describe("convertAmount", () => {
  it("returns destination minAmount when either fallback rate is missing", () => {
    // Forcing both rates to 0 simulates the missing-rate path.
    const out = convertAmount(SE, FR, 1000, { SEK: 0, EUR: 0 });
    assert.equal(out, FR.minAmount);
  });

  it("preserves rough purchasing power across markets", () => {
    // SEK→EUR using known fallback rates should land somewhere in EUR range.
    const out = convertAmount(SE, FR, 1000);
    // Result is clamped to FR.minAmount..FR.maxAmount and snapped to FR.step.
    assert.ok(out >= FR.minAmount);
    assert.ok(out <= FR.maxAmount);
  });

  it("clamps to destination max when source amount exceeds capacity", () => {
    // A huge SEK amount must be clamped to FR.maxAmount, not blow past it.
    const out = convertAmount(SE, FR, 9_999_999);
    assert.equal(out, FR.maxAmount);
  });

  it("snaps to destination step", () => {
    const out = convertAmount(SE, FR, 1000);
    assert.equal(out % FR.step, 0);
  });

  it("converting to the same country is approximately the input (clamped + snapped)", () => {
    const out = convertAmount(SE, SE, 5000);
    assert.equal(out, 5000);
  });
});
