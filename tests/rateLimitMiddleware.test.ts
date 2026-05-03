import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { rateLimited, _resetRateLimits } from "../server/lib/rateLimit";

// Integration proxy for /api/auth/login: same middleware, same window.
describe("rateLimited middleware (auth:login window)", () => {
  beforeEach(() => _resetRateLimits());

  it("returns 429 with Retry-After header after threshold", async () => {
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.post(
      "/api/auth/login",
      rateLimited("auth:login", 3, 60_000),
      (_req, res) => res.json({ ok: true }),
    );

    const agent = request(app);
    for (let i = 0; i < 3; i++) {
      const ok = await agent.post("/api/auth/login").send({ username: "x", password: "y" });
      expect(ok.status).toBe(200);
    }

    const blocked = await agent.post("/api/auth/login").send({ username: "x", password: "y" });
    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(blocked.body).toMatchObject({
      error: "Too Many Requests",
      retryAfterSeconds: expect.any(Number),
    });
  });

  it("isolates by IP via trust proxy", async () => {
    const app = express();
    app.set("trust proxy", true);
    app.post(
      "/api/auth/login",
      rateLimited("auth:login", 2, 60_000),
      (_req, res) => res.json({ ok: true }),
    );

    const agent = request(app);
    // Burn through the limit for IP A
    await agent.post("/api/auth/login").set("X-Forwarded-For", "10.0.0.1");
    await agent.post("/api/auth/login").set("X-Forwarded-For", "10.0.0.1");
    const blockedA = await agent.post("/api/auth/login").set("X-Forwarded-For", "10.0.0.1");
    expect(blockedA.status).toBe(429);

    // IP B still allowed
    const okB = await agent.post("/api/auth/login").set("X-Forwarded-For", "10.0.0.2");
    expect(okB.status).toBe(200);
  });
});
