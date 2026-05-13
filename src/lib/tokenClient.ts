/**
 * @dev Tiny client for the PayLater token-validation endpoint.
 *
 * The widget calls this once on mount to confirm the partner's publishable
 * key is one the API recognises. The endpoint is deliberately permissive on
 * the wire — it always answers `200 { valid: boolean, ... }` for a
 * well-formed key — so the only outcomes here are:
 *
 *   - `{ valid: true, ... }`   — key is known and active.
 *   - `{ valid: false, ... }`  — key is unknown / revoked / malformed.
 *   - `{ unreachable: true }`  — anything that isn't a definitive answer
 *                                 (network failure, timeout, 5xx, parse
 *                                 error). The caller fails open on this.
 *
 * No new runtime deps: this uses the global `fetch` / `AbortController`
 * available in every browser the SDK targets (es2022).
 */

/**
 * @dev Outcome of a remote key check. The `unreachable` arm is intentionally
 * distinct from `{ valid: false }` so the caller can fail open on transport
 * problems while still failing closed on a definitive rejection.
 */
export type ValidateApiKeyResult =
  | { valid: true; mode: "test" | "live"; merchant?: { name?: string } }
  | { valid: false; reason: string }
  | { unreachable: true };

// How long to wait for the validate endpoint before giving up and treating
// the key as unverified (fail-open). Kept short — this gates progression past
// the amount phase, not first paint.
const TIMEOUT_MS = 5000;

/**
 * @title validateApiKey
 * @description Ask the PayLater API whether `apiKey` is a recognised publishable key. Resolves `{ unreachable: true }` for any non-definitive result (network error, timeout, 5xx, bad body) so the caller can fail open; resolves `{ valid: ... }` only when the API gives a clear answer.
 * @param {string} apiKey - The publishable key to check (`pk_test_*` / `pk_live_*`).
 * @param {string} apiBaseUrl - Base URL of the PayLater API (no trailing slash needed).
 * @param {AbortSignal} [signal] - Optional caller signal; aborting it (e.g. on widget unmount) cancels the in-flight request. Combined with an internal ~5s timeout.
 * @returns {Promise<ValidateApiKeyResult>} The validation outcome — never rejects.
 */
export async function validateApiKey(
  apiKey: string,
  apiBaseUrl: string,
  signal?: AbortSignal,
): Promise<ValidateApiKeyResult> {
  // If the caller already aborted (e.g. unmounted before the effect ran),
  // there's nothing to learn — treat it as unreachable.
  if (signal?.aborted) return { unreachable: true };

  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener("abort", onCallerAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Trim a trailing slash so `https://api.paylater.dev/` and the bare host
  // both produce a single-slash path.
  const url = `${apiBaseUrl.replace(/\/+$/, "")}/v1/tokens/validate`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (res.ok) {
      // 2xx — expect `{ valid: boolean, ... }`. Anything else is "we don't
      // actually know", so fail open.
      const body = (await res.json().catch(() => null)) as unknown;
      if (body && typeof body === "object" && "valid" in body) return body as ValidateApiKeyResult;

      return { unreachable: true };
    }
    if (res.status >= 400 && res.status < 500) {
      // A 4xx with a JSON `{ valid: false, ... }` body is still a definitive
      // rejection — honour it. A 4xx without that shape (e.g. a bare 404 from
      // a misconfigured base URL) is treated as unreachable.
      const body = (await res.json().catch(() => null)) as unknown;
      if (body && typeof body === "object" && "valid" in body) return body as ValidateApiKeyResult;

      return { unreachable: true };
    }

    // 5xx and anything else non-2xx/non-4xx — server-side trouble, not a
    // verdict on the key.
    return { unreachable: true };
  } catch {
    // Network failure, DNS, CORS, abort (caller or timeout), JSON parse
    // blowup — none of these tell us the key is bad.
    return { unreachable: true };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}
