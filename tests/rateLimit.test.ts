import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  isRedisRateLimitEnabled,
  _resetRateLimits,
  _checkRateLimitWithClient,
  _setRedisForTesting,
} from "../server/lib/rateLimit";

// Simulates a single Redis backend shared by multiple backend processes.
// Each "instance" gets its own client wrapper, but both read/write the same
// counters — exactly the deployment shape REDIS_URL produces in production.
function makeSharedRedis() {
  const store = new Map<string, { value: number; expiresAt: number }>();
  function now() { return Date.now(); }
  function getEntry(key: string) {
    const e = store.get(key);
    if (e && e.expiresAt <= now()) { store.delete(key); return undefined; }
    return e;
  }
  function makeClient() {
    return {
      async incr(key: string) {
        const existing = getEntry(key);
        if (!existing) {
          store.set(key, { value: 1, expiresAt: now() + 60_000 });
          return 1;
        }
        existing.value += 1;
        return existing.value;
      },
      async expire(key: string, seconds: number) {
        const e = store.get(key);
        if (!e) return 0;
        e.expiresAt = now() + seconds * 1000;
        return 1;
      },
      on() {},
    };
  }
  return { makeClient };
}

describe("checkRateLimit", () => {
  beforeEach(() => _resetRateLimits());

  it("allows requests up to the max in the window", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit({ key: "k", max: 3, windowMs: 60_000 });
      expect(r.allowed).toBe(true);
    }
  });

  it("blocks the (max+1)th request with retryAfterSeconds > 0", async () => {
    for (let i = 0; i < 3; i++) {
      await checkRateLimit({ key: "k", max: 3, windowMs: 60_000 });
    }
    const r = await checkRateLimit({ key: "k", max: 3, windowMs: 60_000 });
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
    expect(r.remaining).toBe(0);
  });

  it("resets after the window elapses", async () => {
    for (let i = 0; i < 3; i++) {
      await checkRateLimit({ key: "k", max: 3, windowMs: 10 });
    }
    await new Promise((r) => setTimeout(r, 25));
    const r = await checkRateLimit({ key: "k", max: 3, windowMs: 10 });
    expect(r.allowed).toBe(true);
  });

  it("isolates buckets per key", async () => {
    for (let i = 0; i < 3; i++) {
      await checkRateLimit({ key: "a", max: 3, windowMs: 60_000 });
    }
    const r = await checkRateLimit({ key: "b", max: 3, windowMs: 60_000 });
    expect(r.allowed).toBe(true);
  });
});

describe("checkRateLimit (multi-instance via shared Redis)", () => {
  it("enforces the limit jointly across two backend instances sharing one Redis bucket", async () => {
    const { makeClient } = makeSharedRedis();
    // Two distinct clients = two distinct backend processes, both pointing at
    // the same Redis. An attacker hopping between them must still be capped.
    const instanceA = makeClient();
    const instanceB = makeClient();
    const opts = { key: "shared:1.2.3.4", max: 5, windowMs: 60_000 };

    const results = [];
    // Interleave calls across the two "servers".
    for (let i = 0; i < 6; i++) {
      const client = i % 2 === 0 ? instanceA : instanceB;
      results.push(await _checkRateLimitWithClient(client, opts));
    }

    const allowed = results.filter((r) => r.allowed).length;
    const blocked = results.filter((r) => !r.allowed).length;
    expect(allowed).toBe(5);
    expect(blocked).toBe(1);
    expect(results[5].allowed).toBe(false);
    expect(results[5].retryAfterSeconds).toBeGreaterThan(0);
  });

  it("does not double-count when only one instance is hit", async () => {
    const { makeClient } = makeSharedRedis();
    const instanceA = makeClient();
    const instanceB = makeClient();
    const opts = { key: "shared:5.6.7.8", max: 3, windowMs: 60_000 };

    for (let i = 0; i < 3; i++) {
      const r = await _checkRateLimitWithClient(instanceA, opts);
      expect(r.allowed).toBe(true);
    }
    // The 4th request — even from a different instance — is blocked.
    const blocked = await _checkRateLimitWithClient(instanceB, opts);
    expect(blocked.allowed).toBe(false);
  });
});

describe("checkRateLimit (production wiring with REDIS_URL)", () => {
  it("public checkRateLimit() routes through Redis when a client is configured", async () => {
    const { makeClient } = makeSharedRedis();
    const sharedClient = makeClient();
    _setRedisForTesting(sharedClient, true);
    try {
      expect(isRedisRateLimitEnabled()).toBe(true);

      const opts = { key: "wired:9.9.9.9", max: 2, windowMs: 60_000 };
      const r1 = await checkRateLimit(opts);
      const r2 = await checkRateLimit(opts);
      const r3 = await checkRateLimit(opts);
      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
      expect(r3.allowed).toBe(false);
      expect(r3.retryAfterSeconds).toBeGreaterThan(0);

      // And the in-memory bucket map was NOT used — proves the Redis path
      // actually ran. _resetRateLimits() only clears in-memory; if Redis
      // wasn't used we'd see the in-memory counter reset on each call below.
      _resetRateLimits();
      const r4 = await checkRateLimit(opts);
      expect(r4.allowed).toBe(false);
    } finally {
      _setRedisForTesting(null, false);
    }
  });

  it("falls back to in-memory when Redis is not enabled", async () => {
    _setRedisForTesting(null, false);
    expect(isRedisRateLimitEnabled()).toBe(false);
    _resetRateLimits();
    const opts = { key: "fallback:1.1.1.1", max: 1, windowMs: 60_000 };
    expect((await checkRateLimit(opts)).allowed).toBe(true);
    expect((await checkRateLimit(opts)).allowed).toBe(false);
  });
});
