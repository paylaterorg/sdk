import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import {
  buildReturnUrl,
  hasSigningReturnMarker,
  runLiveSigningRedirect,
  SIGNING_RETURN_PARAM,
  SIGNING_RETURN_VALUE,
  startSigningSession,
  type StartSigningSessionInput,
} from "../src/lib/scriveClient.ts";

const BASE = "https://api.paylater.dev";

const AGREEMENT: StartSigningSessionInput = {
  ref: "PL-ABC123",
  amount: 1000,
  usdt: 92.5,
  country: "SE",
  network: "solana",
  custody: "self",
  recipient: "7xKXtg2C...rUq",
  returnUrl: "https://shop.example/checkout?paylater_signing=return",
};

// Save/restore fetch so per-test mocks don't leak.
const realFetch = globalThis.fetch;

beforeEach(() => {
  // Reset to a deliberately failing stub so a forgotten setup throws loudly.
  globalThis.fetch = (async () => {
    throw new Error("fetch was not stubbed by the test");
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(handler: (input: string, init: RequestInit) => Promise<Response> | Response) {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return handler(url, init ?? {});
  }) as typeof fetch;
}

describe("startSigningSession", () => {
  it("returns the signing URL on a 2xx { signingUrl } response", async () => {
    stubFetch(async (url, init) => {
      assert.equal(url, `${BASE}/v1/signing-sessions`);
      assert.equal(init.method, "POST");
      return new Response(
        JSON.stringify({ signingUrl: "https://scrive.com/d/abc", sessionRef: "ss_1" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const result = await startSigningSession(BASE, "pk_live_xyz", AGREEMENT);
    assert.deepEqual(result, { signingUrl: "https://scrive.com/d/abc" });
  });

  it("forwards Authorization: Bearer <key> and the agreement body", async () => {
    let capturedAuth: string | null = null;
    let capturedBody: unknown = null;
    stubFetch(async (_url, init) => {
      capturedAuth =
        (init.headers as Record<string, string> | undefined)?.["Authorization"] ?? null;
      capturedBody = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ signingUrl: "https://scrive.com/d/abc" }), {
        status: 200,
      });
    });

    await startSigningSession(BASE, "pk_live_xyz", AGREEMENT);
    assert.equal(capturedAuth, "Bearer pk_live_xyz");
    assert.deepEqual(capturedBody, AGREEMENT);
  });

  it("trims trailing slashes from apiBaseUrl (single-slash path)", async () => {
    let capturedUrl: string | null = null;
    stubFetch(async (url) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ signingUrl: "https://scrive.com/d/abc" }), {
        status: 200,
      });
    });

    await startSigningSession(`${BASE}///`, "pk_live_xyz", AGREEMENT);
    assert.equal(capturedUrl, `${BASE}/v1/signing-sessions`);
  });

  it("returns an http_<status> error on a non-2xx response", async () => {
    stubFetch(async () => new Response("nope", { status: 429 }));

    const result = await startSigningSession(BASE, "pk_live_xyz", AGREEMENT);
    assert.deepEqual(result, { error: "http_429" });
  });

  it("returns bad_response on a 2xx without a string signingUrl", async () => {
    stubFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const result = await startSigningSession(BASE, "pk_live_xyz", AGREEMENT);
    assert.deepEqual(result, { error: "bad_response" });
  });

  it("returns bad_response on malformed JSON", async () => {
    stubFetch(async () => new Response("{not-json", { status: 200 }));

    const result = await startSigningSession(BASE, "pk_live_xyz", AGREEMENT);
    assert.deepEqual(result, { error: "bad_response" });
  });

  it("returns an unreachable error on a network failure", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    const result = await startSigningSession(BASE, "pk_live_xyz", AGREEMENT);
    assert.deepEqual(result, { error: "unreachable" });
  });

  it("returns an aborted error immediately when the caller signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    let fetchCalled = false;
    stubFetch(async () => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    });

    const result = await startSigningSession(BASE, "pk_live_xyz", AGREEMENT, ac.signal);
    assert.deepEqual(result, { error: "aborted" });
    assert.equal(fetchCalled, false);
  });

  it("aborts the in-flight fetch when the caller aborts mid-request", async () => {
    const ac = new AbortController();
    let aborted = false;

    stubFetch(async (_url, init) => {
      const signal = init.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });

    const p = startSigningSession(BASE, "pk_live_xyz", AGREEMENT, ac.signal);
    // Yield a tick so the request attaches its abort listener before we abort.
    await setImmediate();
    ac.abort();

    const result = await p;
    assert.equal(aborted, true);
    assert.deepEqual(result, { error: "unreachable" });
  });
});

describe("buildReturnUrl", () => {
  it("appends the signing return marker to a plain URL", () => {
    const url = buildReturnUrl("https://shop.example/checkout");
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get(SIGNING_RETURN_PARAM), SIGNING_RETURN_VALUE);
  });

  it("preserves existing query params", () => {
    const url = buildReturnUrl("https://shop.example/checkout?cart=42");
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("cart"), "42");
    assert.equal(parsed.searchParams.get(SIGNING_RETURN_PARAM), SIGNING_RETURN_VALUE);
  });

  it("does not stack duplicate markers when called on an already-marked URL", () => {
    const once = buildReturnUrl("https://shop.example/checkout");
    const twice = buildReturnUrl(once);
    const params = new URL(twice).searchParams.getAll(SIGNING_RETURN_PARAM);
    assert.deepEqual(params, [SIGNING_RETURN_VALUE]);
  });
});

describe("hasSigningReturnMarker", () => {
  it("detects the marker in a search string", () => {
    assert.equal(hasSigningReturnMarker("?paylater_signing=return"), true);
    assert.equal(hasSigningReturnMarker("?cart=42&paylater_signing=return"), true);
  });

  it("returns false when the marker is absent or has a different value", () => {
    assert.equal(hasSigningReturnMarker(""), false);
    assert.equal(hasSigningReturnMarker("?cart=42"), false);
    assert.equal(hasSigningReturnMarker("?paylater_signing=other"), false);
  });
});

describe("runLiveSigningRedirect", () => {
  it("clears client state strictly before navigating, on success", async () => {
    const order: string[] = [];
    const redirected = await runLiveSigningRedirect({
      startSession: async () => ({ signingUrl: "https://scrive.com/d/abc" }),
      clearClientState: () => order.push("clear"),
      navigate: (url) => order.push(`navigate:${url}`),
      onFailed: () => order.push("failed"),
    });

    assert.equal(redirected, true);
    assert.deepEqual(order, ["clear", "navigate:https://scrive.com/d/abc"]);
  });

  it("does not navigate or clear state on a failed session; runs onFailed", async () => {
    let cleared = false;
    let navigated = false;
    let failed = false;

    const redirected = await runLiveSigningRedirect({
      startSession: async () => ({ error: "unreachable" }),
      clearClientState: () => {
        cleared = true;
      },
      navigate: () => {
        navigated = true;
      },
      onFailed: () => {
        failed = true;
      },
    });

    assert.equal(redirected, false);
    assert.equal(cleared, false);
    assert.equal(navigated, false);
    assert.equal(failed, true);
  });
});
