import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";

// Env must be set before any module reads it. NODE_ENV is intentionally NOT
// "production" so that assertOperatorOsSsoConfigOrThrow() (called at route
// module load) is a no-op.
process.env.NODE_ENV = "test";
process.env.APP_JWT_SECRET =
  process.env.APP_JWT_SECRET || "test-jwt-secret-do-not-use-in-prod";

const SSO_SECRET = "test-sso-secret-for-route-integration-tests";
const SSO_ISSUER = "https://operatoros.test";
const SSO_AUDIENCE = "torqueshed";
const SSO_ENV = "dev";
const SSO_API = "https://api.operatoros.test";

process.env.MODULE_SSO_SECRET = SSO_SECRET;
process.env.OPERATOROS_BASE_URL = SSO_ISSUER;
process.env.OPERATOROS_SSO_AUDIENCE = SSO_AUDIENCE;
process.env.OPERATOROS_SSO_ENV = SSO_ENV;
process.env.OPERATOROS_API_URL = SSO_API;

const { db } = await import("../server/db");
const { users } = await import("@shared/schema");
const { registerRoutes } = await import("../server/routes");
const { storage } = await import("../server/storage");

let app: express.Application;
const createdUserIds = new Set<string>();
const createdSubs = new Set<string>();

// Stub global fetch so the consume call inside verifyLaunchToken hits us,
// not the real OperatorOS service. The default behaviour is "consume ok";
// individual tests override `consumeResponder` to exercise reject branches.
const realFetch = globalThis.fetch;
type ConsumeResult = { status: number; body: unknown };
let consumeResponder: () => Promise<ConsumeResult> = async () => ({
  status: 200,
  body: null,
});
let consumeCalls = 0;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  await registerRoutes(app);

  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : (input as URL | Request).toString();
    if (url.startsWith(SSO_API) && url.endsWith("/v1/modules/sso/consume")) {
      consumeCalls += 1;
      const { status, body } = await consumeResponder();
      return new Response(body == null ? null : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(input as Parameters<typeof realFetch>[0], init);
  }) as typeof fetch;
});

afterAll(async () => {
  globalThis.fetch = realFetch;
  // Clean up all users we touched (by id or by operator_os_user_id sub).
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
});

beforeEach(() => {
  consumeResponder = async () => ({ status: 200, body: null });
  consumeCalls = 0;
});

function uniqueSub(label: string): string {
  const s = `sso_test_${label}_${Date.now().toString(36)}_${Math.random()
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
    organization_id: "org_test",
    jti: `jti_${Math.random().toString(36).slice(2, 12)}`,
    ...overrides,
  };
}

function sign(
  claims: Record<string, unknown>,
  opts: jwt.SignOptions = {},
  secret: string = SSO_SECRET,
): string {
  return jwt.sign(claims, secret, {
    algorithm: "HS256",
    expiresIn: "60s",
    ...opts,
  });
}

describe("GET /sso integration (real DB)", () => {
  it("happy path: 302 redirect to /sso/bridge?token=... and provisions a user", async () => {
    const sub = uniqueSub("happy");
    const claims = makeClaims({ sub });
    const token = sign(claims);

    const res = await request(app).get(`/sso?token=${encodeURIComponent(token)}`);

    expect(res.status).toBe(302);
    const location = res.headers["location"];
    expect(location).toMatch(/^\/sso\/bridge\?token=/);
    // The route must forward a sanitized redirect param to the bridge so the
    // bridge knows where to land the user after writing the session token.
    expect(location).toContain("&redirect=%2F");
    const locUrl = new URL(location, "https://test.local");
    const bridgeToken = locUrl.searchParams.get("token")!;
    expect(locUrl.searchParams.get("redirect")).toBe("/");
    // Bridge token must be a real signed TorqueShed JWT, not the SSO token.
    const decoded = jwt.verify(bridgeToken, process.env.APP_JWT_SECRET!) as {
      sub: string;
      role: string;
    };
    expect(typeof decoded.sub).toBe("string");
    expect(consumeCalls).toBe(1);

    const [created] = await db.select().from(users).where(eq(users.operatorOsUserId, sub));
    expect(created).toBeDefined();
    expect(created.id).toBe(decoded.sub);
    expect(created.operatorOsUserId).toBe(sub);
    expect(created.operatorOsRole).toBe("member");
    expect(created.operatorOsPlanSlug).toBe("garage_pro");
    expect(created.operatorOsOrganizationId).toBe("org_test");
    expect(created.operatorOsEmail).toBe(`${sub}@example.com`);
    expect(created.operatorOsLastSeenAt).toBeInstanceOf(Date);
    expect(created.passwordHash).toBe("!sso:operatoros");
  });

  it("second launch for the same sub updates last_seen_at and does not duplicate the user", async () => {
    const sub = uniqueSub("repeat");
    const claims1 = makeClaims({ sub });
    const r1 = await request(app).get(
      `/sso?token=${encodeURIComponent(sign(claims1))}`,
    );
    expect(r1.status).toBe(302);

    const [first] = await db.select().from(users).where(eq(users.operatorOsUserId, sub));
    expect(first).toBeDefined();
    const firstSeenAt = first.operatorOsLastSeenAt!;

    // Ensure a measurable gap between the two updates.
    await new Promise((r) => setTimeout(r, 25));

    const claims2 = makeClaims({ sub });
    const r2 = await request(app).get(
      `/sso?token=${encodeURIComponent(sign(claims2))}`,
    );
    expect(r2.status).toBe(302);

    const rows = await db.select().from(users).where(eq(users.operatorOsUserId, sub));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(first.id);
    expect(rows[0].operatorOsLastSeenAt!.getTime()).toBeGreaterThan(
      firstSeenAt.getTime(),
    );
  });

  it("resolves a username collision by retrying with a numeric suffix", async () => {
    // Pre-insert a user owning the username that lazy provisioning will try
    // first. baseHandle = email local-part; baseUsername = `${baseHandle}-${sub.slice(0,12)}`.
    const sub = uniqueSub("collide");
    const handle = `${sub}@example.com`.split("@")[0].toLowerCase().slice(0, 24);
    const baseUsername = `${handle}-${sub.slice(0, 12)}`;

    const [squatter] = await db
      .insert(users)
      .values({
        username: baseUsername,
        passwordHash: "!sso:squatter-not-real",
      })
      .returning();
    createdUserIds.add(squatter.id);

    const token = sign(makeClaims({ sub }));
    const res = await request(app).get(`/sso?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(302);

    const [provisioned] = await db
      .select()
      .from(users)
      .where(eq(users.operatorOsUserId, sub));
    expect(provisioned).toBeDefined();
    expect(provisioned.id).not.toBe(squatter.id);
    expect(provisioned.username).not.toBe(baseUsername);
    expect(provisioned.username.startsWith(`${baseUsername}-`)).toBe(true);
  });
});

describe("GET /sso reject branches", () => {
  it("missing_token (400) when no token query param", async () => {
    const res = await request(app).get("/sso");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ code: "missing_token" });
  });

  it("bad_request (400) for a structurally valid JWT missing required claims", async () => {
    const token = jwt.sign(
      { iss: SSO_ISSUER, aud: SSO_AUDIENCE, env: SSO_ENV },
      SSO_SECRET,
      { algorithm: "HS256", noTimestamp: true },
    );
    const res = await request(app).get(`/sso?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ code: "bad_request" });
  });

  it("signature_invalid (401) for a token signed with the wrong secret", async () => {
    const token = sign(makeClaims(), {}, "totally-wrong-secret-value");
    const res = await request(app).get(`/sso?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: "signature_invalid" });
  });

  it("issuer_mismatch (401)", async () => {
    const token = sign(makeClaims({ iss: "https://evil.example" }));
    const res = await request(app).get(`/sso?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: "issuer_mismatch" });
  });

  it("audience_mismatch (401)", async () => {
    const token = sign(makeClaims({ aud: "another-app", module_slug: "another-app" }));
    const res = await request(app).get(`/sso?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: "audience_mismatch" });
  });

  it("env_mismatch (401)", async () => {
    const token = sign(makeClaims({ env: "prod" }));
    const res = await request(app).get(`/sso?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: "env_mismatch" });
  });

  it("expired (401) for a token past the skew tolerance", async () => {
    const token = sign(makeClaims(), { expiresIn: "-30s" });
    const res = await request(app).get(`/sso?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: "expired" });
  });

  it("clock_skew (401) when iat is too far in the future", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      { ...makeClaims(), iat: nowSec + 60, exp: nowSec + 600 },
      SSO_SECRET,
      { algorithm: "HS256" },
    );
    const res = await request(app).get(`/sso?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: "clock_skew" });
  });

  it("consume_failed (401) when the consume endpoint reports TOKEN_REPLAYED", async () => {
    consumeResponder = async () => ({ status: 409, body: { code: "TOKEN_REPLAYED" } });
    const token = sign(makeClaims());
    const res = await request(app).get(`/sso?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: "consume_failed" });
  });

  it("sso_consume_unavailable (502) when the consume endpoint 5xxs", async () => {
    consumeResponder = async () => ({ status: 503, body: null });
    const token = sign(makeClaims());
    const res = await request(app).get(`/sso?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ code: "sso_consume_unavailable" });
  });
});

describe("GET /sso internal_error branch", () => {
  it("returns 500 {code:'internal_error'} when provisioning throws", async () => {
    const spy = vi
      .spyOn(storage, "findOrCreateUserByOperatorOsId")
      .mockRejectedValueOnce(new Error("boom: simulated db failure"));
    try {
      const token = sign(makeClaims({ sub: uniqueSub("internalerr") }));
      const res = await request(app).get(`/sso?token=${encodeURIComponent(token)}`);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ code: "internal_error" });
    } finally {
      spy.mockRestore();
    }
  });
});

describe("Local password login against an SSO-provisioned account", () => {
  it("returns 401 with the 'sign in via OperatorOS' short-circuit message", async () => {
    const sub = uniqueSub("loginshort");
    const token = sign(makeClaims({ sub }));
    const r = await request(app).get(`/sso?token=${encodeURIComponent(token)}`);
    expect(r.status).toBe(302);

    const [provisioned] = await db
      .select()
      .from(users)
      .where(eq(users.operatorOsUserId, sub));
    expect(provisioned).toBeDefined();
    expect(provisioned.passwordHash).toBe("!sso:operatoros");

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: provisioned.username, password: "anything-at-all" });

    expect(loginRes.status).toBe(401);
    expect(loginRes.body.error).toBe("Unauthorized");
    expect(loginRes.body.message).toMatch(/sign[s]? in via OperatorOS/i);
  });
});
