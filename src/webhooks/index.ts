import { createHmac, timingSafeEqual } from "node:crypto";
import { PayLaterSignatureVerificationError } from "./errors.js";

export type { WebhookVerificationReason } from "./errors.js";
export { PayLaterSignatureVerificationError };

export interface WebhookEvent {
  type: string;
  [key: string]: unknown;
}

export interface ConstructEventOptions {
  tolerance?: number;
}

export function constructEvent(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  { tolerance = 300 }: ConstructEventOptions = {},
): WebhookEvent {
  const parts = signatureHeader.split(",");
  let t: number | undefined;
  const v1Signatures: string[] = [];

  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) throw new PayLaterSignatureVerificationError("invalid_header");
    const key = part.slice(0, eq);
    const val = part.slice(eq + 1);
    if (key === "t") {
      const parsed = Number(val);
      if (!Number.isInteger(parsed) || parsed <= 0)
        throw new PayLaterSignatureVerificationError("invalid_header");
      t = parsed;
    } else if (key === "v1") {
      if (val.length === 0) throw new PayLaterSignatureVerificationError("invalid_header");
      v1Signatures.push(val);
    }
  }

  if (t === undefined || v1Signatures.length === 0)
    throw new PayLaterSignatureVerificationError("invalid_header");

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > tolerance)
    throw new PayLaterSignatureVerificationError("timestamp_outside_tolerance");

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const matched = v1Signatures.some((sig) => {
    if (sig.length !== expected.length) return false;
    try {
      return timingSafeEqual(expectedBuf, Buffer.from(sig, "hex"));
    } catch {
      return false;
    }
  });

  if (!matched) throw new PayLaterSignatureVerificationError("signature_mismatch");

  return JSON.parse(rawBody) as WebhookEvent;
}
