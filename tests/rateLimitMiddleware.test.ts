import { describe, it, expect } from "vitest";
import request from "supertest";

// Live integration: hits the actual /api/auth/login route registered by
// server/routes.ts on the running backend. This catches wiring regressions
// (someone removing rateLimited from the production route) — pure-middleware
// tests can't.
const BASE_URL = process.env.TEST_BACKEND_URL || "http://localhost:5000";

let backendUp = false;
try {
  const r = await fetch(`${BASE_URL}/healthz`);
  backendUp = r.ok;
} catch {
  backendUp = false;
}

const describeIfLive = backendUp ? describe : describe.skip;

describeIfLive("/api/auth/login rate limiting (live backend)", () => {
  it("returns 401 for the first 10 attempts then 429 with Retry-After", async () => {
    // Each test run uses a unique synthetic IP so we get a fresh bucket and
    // don't pollute real users / interfere with concurrent tests.
    const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
    const agent = request(BASE_URL);

    for (let i = 1; i <= 10; i++) {
      const r = await agent
        .post("/api/auth/login")
        .set("X-Forwarded-For", ip)
        .send({ username: `does-not-exist-${ip}-${i}`, password: "nope" });
      expect(r.status).toBe(401);
    }

    const blocked = await agent
      .post("/api/auth/login")
      .set("X-Forwarded-For", ip)
      .send({ username: `does-not-exist-${ip}-final`, password: "nope" });

    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(blocked.body).toMatchObject({
      error: "Too Many Requests",
      retryAfterSeconds: expect.any(Number),
    });
  }, 30_000);

  it("isolates buckets per IP", async () => {
    const ipA = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
    const ipB = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
    const agent = request(BASE_URL);

    // Burn IP A's bucket
    for (let i = 0; i < 11; i++) {
      await agent
        .post("/api/auth/login")
        .set("X-Forwarded-For", ipA)
        .send({ username: `nope-${i}`, password: "nope" });
    }
    const blockedA = await agent
      .post("/api/auth/login")
      .set("X-Forwarded-For", ipA)
      .send({ username: "nope", password: "nope" });
    expect(blockedA.status).toBe(429);

    // IP B is unaffected
    const okB = await agent
      .post("/api/auth/login")
      .set("X-Forwarded-For", ipB)
      .send({ username: "nope", password: "nope" });
    expect(okB.status).toBe(401);
  }, 30_000);
});
