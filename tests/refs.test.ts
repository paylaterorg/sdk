import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDate, generateReference, thirtyDaysFromNow } from "../src/lib/refs.ts";

describe("generateReference", () => {
  it("matches the USDT-XXXX-NNNN shape", () => {
    const ref = generateReference();
    assert.match(ref, /^USDT-[0-9A-Z]{1,4}-[0-9]{1,4}$/);
  });

  it("is non-deterministic across consecutive calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(generateReference());
    // Random base36 segment + millisecond suffix should give us plenty of unique values.
    assert.ok(seen.size >= 30, `expected mostly-unique refs but got ${seen.size}/50`);
  });
});

describe("thirtyDaysFromNow", () => {
  it("returns a Date roughly 30 days ahead", () => {
    const now = Date.now();
    const due = thirtyDaysFromNow();
    const deltaMs = due.getTime() - now;
    const days = deltaMs / (1000 * 60 * 60 * 24);
    // ±1 day tolerance to cover DST seam + clock drift between Date.now() and the spec call.
    assert.ok(days >= 29 && days <= 31, `expected ~30 days, got ${days}`);
  });

  it("returns a fresh Date instance on each call (not memoised)", () => {
    const a = thirtyDaysFromNow();
    const b = thirtyDaysFromNow();
    assert.notEqual(a, b);
  });
});

describe("formatDate", () => {
  it("renders 'DD MMM YYYY' in en-GB", () => {
    // Use mid-day mid-month so the rendering survives any host TZ without flipping into adjacent days.
    const out = formatDate(new Date(2026, 2, 5, 12, 0, 0));
    // en-GB short month: "5 Mar 2026". Some Node ICU variants may also produce "05 Mar 2026".
    assert.match(out, /^0?5 Mar 2026$/);
  });

  it("renders the month abbreviation in English regardless of host locale", () => {
    // Pin the locale-formatted output to be English (en-GB) and not host-locale dependent.
    const out = formatDate(new Date(2026, 11, 15, 12, 0, 0));
    assert.match(out, /Dec 2026$/);
  });
});
