export type WebhookVerificationReason =
  | "invalid_header"
  | "signature_mismatch"
  | "timestamp_outside_tolerance";

export class PayLaterSignatureVerificationError extends Error {
  readonly reason: WebhookVerificationReason;

  constructor(reason: WebhookVerificationReason) {
    super(`PayLater webhook signature verification failed: ${reason}`);
    this.name = "PayLaterSignatureVerificationError";
    this.reason = reason;
  }
}
