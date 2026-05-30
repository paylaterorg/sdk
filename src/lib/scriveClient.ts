/**
 * @dev Tiny client for the PayLater start-signing-session endpoint.
 *
 * Used only in live mode. The widget posts the chosen agreement details to the
 * API, which creates the Scrive document and returns the per-party hosted
 * signing URL the customer is redirected to. No Scrive credentials ever live in
 * the browser — the API holds the OAuth2 secret and is the sole caller of
 * Scrive.
 *
 * Like `tokenClient`, this leans only on the global `fetch` available in every
 * browser the SDK targets (es2022) and never throws: a failure resolves to a
 * discriminated `{ error }` arm the caller turns into a graceful "couldn't
 * start signing" UX rather than a thrown exception that would break the widget.
 */

/**
 * @dev Agreement details posted to the start-session endpoint. The server
 * treats these as informational merge fields for the Scrive document — they
 * describe what is being signed but never authorize money. Mirrors the
 * test-mode `AgreementSnapshot` so both paths carry the same shape.
 */
export interface StartSigningSessionInput {
  ref: string;
  amount: number;
  usdt: number;
  country: string;
  network: string;
  custody: "self" | "merchant";
  recipient: string | null;
  merchantUserId?: string;
  description?: string;
  /**
   * @dev URL Scrive should send the customer back to after signing. The widget
   * supplies its own page so the customer lands back where they started; the
   * authoritative credit still arrives asynchronously via the webhook.
   */
  returnUrl: string;
}

/**
 * @dev Outcome of a start-session request. `signingUrl` is the hosted Scrive
 * page to redirect to; the `error` arm covers every non-definitive result
 * (rejection, network failure, timeout, bad body) so the caller can degrade
 * gracefully without distinguishing causes.
 */
export type StartSigningSessionResult = { signingUrl: string } | { error: string };

// How long to wait for the start-session endpoint before giving up. A little
// more generous than the on-mount key check since this call creates a document
// at Scrive, but still short enough that a stuck request doesn't strand the
// customer on a spinner.
const TIMEOUT_MS = 10000;

/**
 * @title startSigningSession
 * @description Ask the PayLater API to create a live Scrive signing session and return the customer's hosted signing URL. Resolves `{ error }` for any non-success result (rejection, network error, timeout, malformed body) so the caller can show a graceful failure; resolves `{ signingUrl }` only when the API returns a usable URL. Never rejects.
 * @param {string} apiBaseUrl - Base URL of the PayLater API (no trailing slash needed).
 * @param {string} apiKey - The publishable key (`pk_live_*`) sent as a Bearer token.
 * @param {StartSigningSessionInput} agreement - Agreement merge fields + the return URL.
 * @param {AbortSignal} [signal] - Optional caller signal; aborting it cancels the in-flight request. Combined with an internal ~10s timeout.
 * @returns {Promise<StartSigningSessionResult>} The session outcome — never rejects.
 */
export async function startSigningSession(
  apiBaseUrl: string,
  apiKey: string,
  agreement: StartSigningSessionInput,
  signal?: AbortSignal,
): Promise<StartSigningSessionResult> {
  if (signal?.aborted) return { error: "aborted" };

  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener("abort", onCallerAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const url = `${apiBaseUrl.replace(/\/+$/, "")}/v1/signing-sessions`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(agreement),
      signal: controller.signal,
    });
    if (!res.ok) return { error: `http_${res.status}` };

    const body = (await res.json().catch(() => null)) as unknown;
    if (
      body &&
      typeof body === "object" &&
      "signingUrl" in body &&
      typeof (body as { signingUrl: unknown }).signingUrl === "string"
    )
      return { signingUrl: (body as { signingUrl: string }).signingUrl };

    return { error: "bad_response" };
  } catch {
    // Network failure, DNS, CORS, abort (caller or timeout), JSON blowup — the
    // caller can't start signing, but the widget must not crash.
    return { error: "unreachable" };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}

/**
 * @dev Marker the widget appends to its return URL so that, on the redirect
 * back from Scrive, it can tell it returned from a live signing flow and show
 * the pending state instead of restarting the sign step.
 */
export const SIGNING_RETURN_PARAM = "paylater_signing";
export const SIGNING_RETURN_VALUE = "return";

/**
 * @title buildReturnUrl
 * @description Produce the URL Scrive redirects the customer back to: the current page with a `paylater_signing=return` marker so the widget recognizes the round-trip. Strips any pre-existing marker first so repeated flows don't stack duplicates.
 * @param {string} href - The page URL to return to (typically `window.location.href`).
 * @returns {string} The return URL carrying the signing marker.
 */
export function buildReturnUrl(href: string): string {
  try {
    const u = new URL(href);
    u.searchParams.set(SIGNING_RETURN_PARAM, SIGNING_RETURN_VALUE);
    return u.toString();
  } catch {
    // Non-absolute / exotic href — fall back to a plain append.
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}${SIGNING_RETURN_PARAM}=${SIGNING_RETURN_VALUE}`;
  }
}

/**
 * @title hasSigningReturnMarker
 * @description Detect whether the current location carries the signing return marker, meaning the customer just came back from the Scrive hosted page.
 * @param {string} search - The location search string (e.g. `window.location.search`).
 * @returns {boolean} True when the `paylater_signing=return` marker is present.
 */
export function hasSigningReturnMarker(search: string): boolean {
  try {
    return new URLSearchParams(search).get(SIGNING_RETURN_PARAM) === SIGNING_RETURN_VALUE;
  } catch {
    return false;
  }
}

/**
 * @dev Side effects the live-redirect orchestration needs, injected so the
 * ordering (clear client state strictly before navigating away) is testable
 * without a DOM. The component wires these to `sessionStorage` / state setters /
 * `window.location.assign`.
 */
export interface LiveSigningRedirectEffects {
  startSession: () => Promise<StartSigningSessionResult>;
  clearClientState: () => void;
  navigate: (url: string) => void;
  onFailed: () => void;
}

/**
 * @title runLiveSigningRedirect
 * @description Orchestrate the live-mode signing redirect: request a Scrive session, and on success clear any lingering test-mode client state BEFORE navigating to the hosted signing page. On failure, run the failure handler and do not navigate. Returns whether the customer was redirected.
 * @param {LiveSigningRedirectEffects} effects - Injected side effects (start session, clear state, navigate, fail).
 * @returns {Promise<boolean>} True if a redirect was performed.
 */
export async function runLiveSigningRedirect(
  effects: LiveSigningRedirectEffects,
): Promise<boolean> {
  const result = await effects.startSession();
  if ("signingUrl" in result) {
    // Clear test-mode client state before leaving the page so a stale nonce
    // isn't left behind for the return trip.
    effects.clearClientState();
    effects.navigate(result.signingUrl);
    return true;
  }
  effects.onFailed();
  return false;
}
