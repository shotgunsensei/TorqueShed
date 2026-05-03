import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

// After the routes split (task #51), individual endpoints live in per-feature
// modules under server/routes/. The static wiring guards below scan the
// orchestrator + every per-feature module so the regression coverage survives
// the refactor.
function readRoutesSource(): string {
  const root = path.resolve(__dirname, "..", "server");
  const parts: string[] = [readFileSync(path.join(root, "routes.ts"), "utf8")];
  const dir = path.join(root, "routes");
  if (existsSync(dir)) {
    for (const entry of readdirSync(dir)) {
      if (entry.endsWith(".ts")) parts.push(readFileSync(path.join(dir, entry), "utf8"));
    }
  }
  return parts.join("\n");
}
import express from "express";
import request from "supertest";
import { rateLimited, _resetRateLimits } from "../server/lib/rateLimit";

// In-process integration test: boots a tiny Express app with the SAME
// production middleware (rateLimited) on /api/auth/login. Always runs in
// `npm test` — no dependency on a separately-running backend.
describe("/api/auth/login rate limiting (in-process)", () => {
  beforeEach(() => _resetRateLimits());

  function buildApp() {
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    // Mirror production: same bucket name + same thresholds as routes.ts.
    app.post(
      "/api/auth/login",
      rateLimited("auth:login", 10, 15 * 60 * 1000),
      (_req, res) => res.status(401).json({ error: "Unauthorized" }),
    );
    return app;
  }

  it("returns 401 for the first 10 attempts then 429 + Retry-After on the 11th", async () => {
    const app = buildApp();
    const ip = "203.0.113.10";
    const agent = request(app);

    for (let i = 1; i <= 10; i++) {
      const r = await agent
        .post("/api/auth/login")
        .set("X-Forwarded-For", ip)
        .send({ username: `nope-${i}`, password: "nope" });
      expect(r.status).toBe(401);
    }

    const blocked = await agent
      .post("/api/auth/login")
      .set("X-Forwarded-For", ip)
      .send({ username: "nope", password: "nope" });

    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(blocked.body).toMatchObject({
      error: "Too Many Requests",
      retryAfterSeconds: expect.any(Number),
    });
  });

  it("isolates buckets per client IP", async () => {
    const app = buildApp();
    const agent = request(app);
    const ipA = "198.51.100.1";
    const ipB = "198.51.100.2";

    // Burn IP A's bucket
    for (let i = 0; i < 10; i++) {
      await agent.post("/api/auth/login").set("X-Forwarded-For", ipA).send({});
    }
    const blockedA = await agent.post("/api/auth/login").set("X-Forwarded-For", ipA).send({});
    expect(blockedA.status).toBe(429);

    // IP B is unaffected
    const okB = await agent.post("/api/auth/login").set("X-Forwarded-For", ipB).send({});
    expect(okB.status).toBe(401);
  });
});

// Static wiring guard: ensures the production route in routes.ts actually
// has `rateLimited("auth:login", ...)` attached. If someone removes the
// middleware, this test fails — covering the regression scenario the
// in-process test alone can't.
describe("/api/auth/login route wiring (static)", () => {
  it("registers rateLimited('auth:login', ...) on the login route in server/routes.ts", () => {
    const src = readRoutesSource();
    expect(src).toMatch(
      /app\.post\(\s*["']\/api\/auth\/login["']\s*,\s*rateLimited\(\s*["']auth:login["']/,
    );
  });

  it("registers rateLimited on every unauthenticated mutating endpoint in the sweep", () => {
    const src = readRoutesSource();
    const expectations: Array<[string, RegExp]> = [
      ["/api/auth/signup", /\/api\/auth\/signup["']\s*,\s*rateLimited\(/],
      ["/api/auth/forgot-password", /\/api\/auth\/forgot-password["']\s*,\s*rateLimited\(/],
      ["/api/auth/reset-password", /\/api\/auth\/reset-password["']\s*,\s*rateLimited\(/],
      ["/api/products/:id/click", /\/api\/products\/:id\/click["']\s*,\s*rateLimited\(/],
    ];
    for (const [name, pattern] of expectations) {
      expect(src, `expected rateLimited middleware on ${name}`).toMatch(pattern);
    }
  });
});
