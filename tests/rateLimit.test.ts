import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, _resetRateLimits } from "../server/lib/rateLimit";

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
