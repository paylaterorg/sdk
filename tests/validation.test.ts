import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  API_KEY_RE,
  EMAIL_RE,
  EVM_RE,
  SOLANA_RE,
  TRON_RE,
  isValidApiKey,
  validateAddress,
} from "../src/lib/validation.ts";

describe("address regexes", () => {
  it("EVM_RE accepts a valid 0x-prefixed 40-hex address", () => {
    assert.ok(EVM_RE.test("0x" + "a".repeat(40)));
    assert.ok(EVM_RE.test("0x" + "F".repeat(40)));
    assert.ok(EVM_RE.test("0x1234567890aBcDeF1234567890AbCdEf12345678"));
  });

  it("EVM_RE rejects wrong length / non-hex / missing prefix", () => {
    assert.equal(EVM_RE.test("0x" + "a".repeat(39)), false);
    assert.equal(EVM_RE.test("0x" + "a".repeat(41)), false);
    assert.equal(EVM_RE.test("0x" + "z".repeat(40)), false);
    assert.equal(EVM_RE.test("a".repeat(40)), false);
    assert.equal(EVM_RE.test(""), false);
  });

  it("SOLANA_RE accepts base58 32–44 alphabet but rejects 0/O/I/l", () => {
    assert.ok(SOLANA_RE.test("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"));
    // 32 chars (lower bound) — should pass
    assert.ok(SOLANA_RE.test("a".repeat(32)));
    // Contains forbidden char "0"
    assert.equal(SOLANA_RE.test("0" + "a".repeat(31)), false);
    // 31 chars (below lower bound)
    assert.equal(SOLANA_RE.test("a".repeat(31)), false);
    // 45 chars (above upper bound)
    assert.equal(SOLANA_RE.test("a".repeat(45)), false);
  });

  it("TRON_RE requires T-prefix + 33 base58 chars", () => {
    assert.ok(TRON_RE.test("TLPpXqMzVE5HqLNVbktTLpWmXFP6QgKQ4y"));
    assert.equal(TRON_RE.test("BLPpXqMzVE5HqLNVbktTLpWmXFP6QgKQ4y"), false);
    assert.equal(TRON_RE.test("T" + "a".repeat(32)), false);
  });

  it("EMAIL_RE is permissive but rejects whitespace + missing @", () => {
    assert.ok(EMAIL_RE.test("jane@example.com"));
    assert.ok(EMAIL_RE.test("a+b@x.y.z"));
    assert.equal(EMAIL_RE.test("not-an-email"), false);
    assert.equal(EMAIL_RE.test("jane @example.com"), false);
    assert.equal(EMAIL_RE.test("jane@@example.com"), false);
  });

  it("API_KEY_RE matches pk_test_ + pk_live_ shapes only", () => {
    assert.ok(API_KEY_RE.test("pk_test_abc123XYZ"));
    assert.ok(API_KEY_RE.test("pk_live_abc123XYZ"));
    assert.equal(API_KEY_RE.test("pk_other_abc"), false);
    assert.equal(API_KEY_RE.test("sk_test_abc"), false);
    assert.equal(API_KEY_RE.test("pk_test_"), false);
    assert.equal(API_KEY_RE.test(""), false);
  });
});

describe("validateAddress", () => {
  it("trims whitespace before checking", () => {
    assert.equal(validateAddress("ethereum", "   0x" + "a".repeat(40) + "  "), true);
  });

  it("rejects empty / whitespace-only input", () => {
    assert.equal(validateAddress("ethereum", ""), false);
    assert.equal(validateAddress("ethereum", "    "), false);
  });

  it("routes EVM family networks (ethereum/polygon/arbitrum/base) to EVM_RE", () => {
    const evm = "0x" + "a".repeat(40);
    assert.equal(validateAddress("ethereum", evm), true);
    assert.equal(validateAddress("polygon", evm), true);
    assert.equal(validateAddress("arbitrum", evm), true);
    assert.equal(validateAddress("base", evm), true);
  });

  it("routes solana to SOLANA_RE", () => {
    assert.equal(validateAddress("solana", "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"), true);
    assert.equal(validateAddress("solana", "0x" + "a".repeat(40)), false);
  });

  it("routes tron to TRON_RE", () => {
    assert.equal(validateAddress("tron", "TLPpXqMzVE5HqLNVbktTLpWmXFP6QgKQ4y"), true);
    assert.equal(validateAddress("tron", "TLPpXqMzVE5HqLNVbktTLpWmXFP6QgKQ4"), false);
  });
});

describe("isValidApiKey", () => {
  it("accepts well-formed pk_test_ + pk_live_ keys", () => {
    assert.equal(isValidApiKey("pk_test_abcdefghijklmnop"), true);
    assert.equal(isValidApiKey("pk_live_abcdefghijklmnop"), true);
  });

  it("rejects undefined, empty, malformed, or wrong-prefix", () => {
    assert.equal(isValidApiKey(undefined), false);
    assert.equal(isValidApiKey(""), false);
    assert.equal(isValidApiKey("not-a-key"), false);
    assert.equal(isValidApiKey("sk_live_abc"), false);
    assert.equal(isValidApiKey("pk_test_"), false);
  });
});
