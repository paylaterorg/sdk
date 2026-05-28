import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { validateApiKey } from "../src/lib/tokenClient.ts";

const BASE = "https://api.paylater.dev";

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

describe("validateApiKey", () => {
  it("returns the parsed body on a 2xx { valid: true } response", async () => {
    stubFetch(async (url) => {
      assert.equal(url, `${BASE}/v1/tokens/validate`);
      return new Response(JSON.stringify({ valid: true, mode: "test", signalNonce: "abc123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await validateApiKey("pk_test_xyz", BASE);
    assert.deepEqual(result, { valid: true, mode: "test", signalNonce: "abc123" });
  });

  it("captures signalNonce for the widget-success bridge", async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify({ valid: true, mode: "live", signalNonce: "nonce-hex" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const result = await validateApiKey("pk_live_xyz", BASE);
    assert.ok("valid" in result && result.valid);
    if ("valid" in result && result.valid) {
      assert.equal(result.signalNonce, "nonce-hex");
      assert.equal(result.mode, "live");
    }
  });

  it("forwards Authorization: Bearer <key>", async () => {
    let capturedAuth: string | null = null;
    stubFetch(async (_url, init) => {
      capturedAuth =
        (init.headers as Record<string, string> | undefined)?.["Authorization"] ?? null;
      return new Response(JSON.stringify({ valid: true, mode: "test" }), { status: 200 });
    });

    await validateApiKey("pk_test_xyz", BASE);
    assert.equal(capturedAuth, "Bearer pk_test_xyz");
  });

  it("trims a trailing slash from apiBaseUrl (single-slash path)", async () => {
    let capturedUrl: string | null = null;
    stubFetch(async (url) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ valid: true, mode: "test" }), { status: 200 });
    });

    await validateApiKey("pk_test_xyz", `${BASE}/`);
    assert.equal(capturedUrl, `${BASE}/v1/tokens/validate`);
  });

  it("trims multiple trailing slashes", async () => {
    let capturedUrl: string | null = null;
    stubFetch(async (url) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ valid: true, mode: "test" }), { status: 200 });
    });

    await validateApiKey("pk_test_xyz", `${BASE}///`);
    assert.equal(capturedUrl, `${BASE}/v1/tokens/validate`);
  });

  it("honours a 4xx { valid: false } as a definitive rejection", async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify({ valid: false, reason: "revoked" }), { status: 400 }),
    );

    const result = await validateApiKey("pk_test_revoked", BASE);
    assert.deepEqual(result, { valid: false, reason: "revoked" });
  });

  it("treats a bare 4xx without a valid-shaped body as unreachable", async () => {
    stubFetch(async () => new Response("not found", { status: 404 }));

    const result = await validateApiKey("pk_test_xyz", BASE);
    assert.deepEqual(result, { unreachable: true });
  });

  it("treats 5xx as unreachable (server-side trouble, not a verdict)", async () => {
    stubFetch(async () => new Response("server error", { status: 503 }));

    const result = await validateApiKey("pk_test_xyz", BASE);
    assert.deepEqual(result, { unreachable: true });
  });

  it("treats a network error as unreachable", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    const result = await validateApiKey("pk_test_xyz", BASE);
    assert.deepEqual(result, { unreachable: true });
  });

  it("treats a 2xx with malformed JSON as unreachable (fail open)", async () => {
    stubFetch(async () => new Response("{not-json", { status: 200 }));

    const result = await validateApiKey("pk_test_xyz", BASE);
    assert.deepEqual(result, { unreachable: true });
  });

  it("treats a 2xx without a `valid` key as unreachable", async () => {
    stubFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const result = await validateApiKey("pk_test_xyz", BASE);
    assert.deepEqual(result, { unreachable: true });
  });

  it("returns unreachable immediately when the caller's signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    let fetchCalled = false;
    stubFetch(async () => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    });

    const result = await validateApiKey("pk_test_xyz", BASE, ac.signal);
    assert.deepEqual(result, { unreachable: true });
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

    const p = validateApiKey("pk_test_xyz", BASE, ac.signal);
    // Give the listener attach a tick.
    await new Promise((r) => setImmediate(r));
    ac.abort();

    const result = await p;
    assert.equal(aborted, true);
    assert.deepEqual(result, { unreachable: true });
  });
});
