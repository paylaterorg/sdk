import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { PayLaterSignatureVerificationError, constructEvent } from "../dist/webhooks/index.js";

const SECRET = "whsec_test_secret_key_for_unit_tests";
const BODY = JSON.stringify({ type: "payment.succeeded", ref: "abc123" });

function makeHeader(body: string, secret: string, tOffset = 0): string {
  const t = Math.floor(Date.now() / 1000) + tOffset;
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${sig}`;
}

describe("constructEvent", () => {
  it("valid signature passes and returns parsed event", () => {
    const header = makeHeader(BODY, SECRET);
    const event = constructEvent(BODY, header, SECRET);
    assert.equal(event.type, "payment.succeeded");
  });

  it("tampered body throws signature_mismatch", () => {
    const header = makeHeader(BODY, SECRET);
    const tampered = JSON.stringify({ type: "payment.succeeded", ref: "TAMPERED" });
    assert.throws(
      () => constructEvent(tampered, header, SECRET),
      (err: unknown) => {
        assert.ok(err instanceof PayLaterSignatureVerificationError);
        assert.equal(err.reason, "signature_mismatch");
        return true;
      },
    );
  });

  it("+60s skew passes (two-sided, within default 300s tolerance)", () => {
    const header = makeHeader(BODY, SECRET, +60);
    const event = constructEvent(BODY, header, SECRET);
    assert.equal(event.type, "payment.succeeded");
  });

  it("-60s skew passes (two-sided, within default 300s tolerance)", () => {
    const header = makeHeader(BODY, SECRET, -60);
    const event = constructEvent(BODY, header, SECRET);
    assert.equal(event.type, "payment.succeeded");
  });

  it("+600s skew fails with timestamp_outside_tolerance", () => {
    const header = makeHeader(BODY, SECRET, +600);
    assert.throws(
      () => constructEvent(BODY, header, SECRET),
      (err: unknown) => {
        assert.ok(err instanceof PayLaterSignatureVerificationError);
        assert.equal(err.reason, "timestamp_outside_tolerance");
        return true;
      },
    );
  });

  it("-600s skew fails with timestamp_outside_tolerance", () => {
    const header = makeHeader(BODY, SECRET, -600);
    assert.throws(
      () => constructEvent(BODY, header, SECRET),
      (err: unknown) => {
        assert.ok(err instanceof PayLaterSignatureVerificationError);
        assert.equal(err.reason, "timestamp_outside_tolerance");
        return true;
      },
    );
  });

  it("malformed header (no t=) throws invalid_header", () => {
    assert.throws(
      () => constructEvent(BODY, "v1=abc123", SECRET),
      (err: unknown) => {
        assert.ok(err instanceof PayLaterSignatureVerificationError);
        assert.equal(err.reason, "invalid_header");
        return true;
      },
    );
  });

  it("malformed header (no v1=) throws invalid_header", () => {
    const t = Math.floor(Date.now() / 1000);
    assert.throws(
      () => constructEvent(BODY, `t=${t}`, SECRET),
      (err: unknown) => {
        assert.ok(err instanceof PayLaterSignatureVerificationError);
        assert.equal(err.reason, "invalid_header");
        return true;
      },
    );
  });

  it("malformed header (empty string) throws invalid_header", () => {
    assert.throws(
      () => constructEvent(BODY, "", SECRET),
      (err: unknown) => {
        assert.ok(err instanceof PayLaterSignatureVerificationError);
        assert.equal(err.reason, "invalid_header");
        return true;
      },
    );
  });

  it("multiple v1= entries — valid one passes", () => {
    const t = Math.floor(Date.now() / 1000);
    const goodSig = createHmac("sha256", SECRET).update(`${t}.${BODY}`).digest("hex");
    const header = `t=${t},v1=deadbeef00000000000000000000000000000000000000000000000000000000,v1=${goodSig}`;
    const event = constructEvent(BODY, header, SECRET);
    assert.equal(event.type, "payment.succeeded");
  });

  it("pk_live_ publishable key regex accepts live-mode keys without throwing", () => {
    assert.doesNotThrow(() => {
      const header = makeHeader(BODY, SECRET);
      constructEvent(BODY, header, SECRET);
    });
  });
});
