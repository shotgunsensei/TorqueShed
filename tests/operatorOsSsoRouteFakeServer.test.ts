import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import type { AddressInfo } from "net";
import type { Server } from "http";

// Env must be set before any module is imported so that the SSO route's
// load-time `assertOperatorOsSsoConfigOrThrow()` succeeds and the verifier
// picks up the right secret / issuer / audience / env.
process.env.NODE_ENV = "test";
process.env.APP_JWT_SECRET =
  process.env.APP_JWT_SECRET || "test-jwt-secret-do-not-use-in-prod";

const SSO_SECRET = "test-sso-secret-for-fake-server-integration";
const SSO_ISSUER = "https://operatoros.fake";
const SSO_AUDIENCE = "torqueshed";
const SSO_ENV = "dev";

process.env.MODULE_SSO_SECRET = SSO_SECRET;
process.env.OPERATOROS_BASE_URL = SSO_ISSUER;
process.env.OPERATOROS_SSO_AUDIENCE = SSO_AUDIENCE;
process.env.OPERATOROS_SSO_ENV = SSO_ENV;

// Stand up a fake OperatorOS HTTP server on a random local port BEFORE the
// route module is imported, then point OPERATOROS_API_URL at it. This way the
// real `defaultConsume` fetch path is exercised end-to-end — no fetch stub,
// no `opts.consume` override.
let fakeServer: Server;
let fakeBaseUrl: string;
let lastConsumeBody: unknown = null;
let consumeCallCount = 0;
type FakeResponder = (
  req: express.Request,
  res: express.Response,
) => void;
let consumeResponder: FakeResponder = (_req, res) => res.status(200).json({});

await new Promise<void>((resolve) => {
  const fake = express();
  fake.use(express.json());
  fake.post("/v1/modules/sso/consume", (req, res) => {
    consumeCallCount += 1;
    lastConsumeBody = req.body;
    consumeResponder(req, res);
  });
  fakeServer = fake.listen(0, "127.0.0.1", () => resolve());
});
{
  const { port } = fakeServer!.address() as AddressInfo;
  fakeBaseUrl = `http://127.0.0.1:${port}`;
  process.env.OPERATOROS_API_URL = fakeBaseUrl;
}

const { db } = await import("../server/db");
const { users } = await import("@shared/schema");
const { registerRoutes } = await import("../server/routes");

let app: express.Application;
const createdSubs = new Set<string>();
const createdUserIds = new Set<string>();

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  await registerRoutes(app);
});

afterAll(async () => {
  for (const sub of createdSubs) {
    const rows = await db.select().from(users).where(eq(users.operatorOsUserId, sub));
    for (const r of rows) createdUserIds.add(r.id);
  }
  for (const id of createdUserIds) {
    try {
      await db.delete(users).where(eq(users.id, id));
    } catch {
      // best-effort
    }
  }
  await new Promise<void>((resolve, reject) =>
    fakeServer.close((e) => (e ? reject(e) : resolve())),
  );
});

beforeEach(() => {
  consumeResponder = (_req, res) => res.status(200).json({});
  lastConsumeBody = null;
  consumeCallCount = 0;
});

function uniqueSub(label: string): string {
  const s = `sso_fakesrv_${label}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  createdSubs.add(s);
  return s;
}

function makeClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const sub = (overrides.sub as string) ?? uniqueSub("happy");
  return {
    iss: SSO_ISSUER,
    aud: SSO_AUDIENCE,
    env: SSO_ENV,
    sub,
    user_id: sub,
    email: `${sub}@example.com`,
    role: "member",
    module_slug: SSO_AUDIENCE,
    plan_slug: "garage_pro",
    organization_id: "org_fakesrv",
    jti: `jti_${Math.random().toString(36).slice(2, 12)}`,
    ...overrides,
  };
}

function sign(claims: Record<string, unknown>, opts: jwt.SignOptions = {}): string {
  return jwt.sign(claims, SSO_SECRET, {
    algorithm: "HS256",
    expiresIn: "60s",
    ...opts,
  });
}

describe("GET /sso end-to-end against a fake OperatorOS server", () => {
  it("hits the real consume endpoint, provisions the user, mints a JWT, and 302s to /sso/bridge", async () => {
    const sub = uniqueSub("happy");
    const claims = makeClaims({ sub });
    const token = sign(claims);

    const res = await request(app).get(`/sso?token=${encodeURIComponent(token)}`);

    expect(res.status).toBe(302);
    const location = res.headers["location"];
    expect(location).toMatch(/^\/sso\/bridge\?token=/);

    // Verify the consume call really hit our fake server with the right body.
    expect(consumeCallCount).toBe(1);
    expect(lastConsumeBody).toEqual({
      jti: claims.jti,
      aud: SSO_AUDIENCE,
      env: SSO_ENV,
    });

    // The bridge token must be a freshly signed TorqueShed JWT, not the
    // original SSO launch token.
    const locUrl = new URL(location, "https://test.local");
    const bridgeToken = locUrl.searchParams.get("token")!;
    expect(bridgeToken).not.toBe(token);
    const decoded = jwt.verify(bridgeToken, process.env.APP_JWT_SECRET!) as {
      sub: string;
      role: string;
    };
    expect(typeof decoded.sub).toBe("string");

    // The user must have been lazily provisioned in the real DB.
    const [created] = await db
      .select()
      .from(users)
      .where(eq(users.operatorOsUserId, sub));
    expect(created).toBeDefined();
    expect(created.id).toBe(decoded.sub);
    expect(created.operatorOsUserId).toBe(sub);
    expect(created.operatorOsPlanSlug).toBe("garage_pro");
    expect(created.passwordHash).toBe("!sso:operatoros");
  });

  it("surfaces consume_failed (401) when the fake server returns 409 TOKEN_REPLAYED", async () => {
    consumeResponder = (_req, res) =>
      res.status(409).json({ code: "TOKEN_REPLAYED" });

    const token = sign(makeClaims({ sub: uniqueSub("replayed") }));
    const res = await request(app).get(`/sso?token=${encodeURIComponent(token)}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: "consume_failed" });
    expect(consumeCallCount).toBe(1);
  });
});
