import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PayLaterSignatureVerificationError } from "../src/webhooks/errors.ts";

describe("PayLaterSignatureVerificationError", () => {
  it("is an instance of Error and exposes the reason", () => {
    const err = new PayLaterSignatureVerificationError("signature_mismatch");
    assert.ok(err instanceof Error);
    assert.ok(err instanceof PayLaterSignatureVerificationError);
    assert.equal(err.reason, "signature_mismatch");
    // Message is auto-built; must reference the reason so partner logs are useful.
    assert.match(err.message, /signature_mismatch/);
    assert.equal(err.name, "PayLaterSignatureVerificationError");
  });

  it("accepts each documented reason without typing complaint", () => {
    // Compile-time check that the union covers what the README documents.
    const reasons = [
      "invalid_header",
      "signature_mismatch",
      "timestamp_outside_tolerance",
    ] as const;
    for (const r of reasons) {
      const err = new PayLaterSignatureVerificationError(r);
      assert.equal(err.reason, r);
      assert.match(err.message, new RegExp(r));
    }
  });

  it("survives JSON.stringify (message + reason recoverable)", () => {
    const err = new PayLaterSignatureVerificationError("invalid_header");
    const serialized = JSON.stringify({
      reason: err.reason,
      message: err.message,
      name: err.name,
    });
    const parsed = JSON.parse(serialized) as {
      reason: string;
      message: string;
      name: string;
    };
    assert.equal(parsed.reason, "invalid_header");
    assert.equal(parsed.name, "PayLaterSignatureVerificationError");
  });
});
