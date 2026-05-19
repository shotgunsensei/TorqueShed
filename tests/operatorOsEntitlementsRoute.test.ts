// Integration tests for task #68:
//   - POST /api/operatoros/entitlements/sync auth + module_key enforcement
//   - GET  /api/entitlements/me reflects pushed snapshot
//   - moduleEnabledGate returns 403 on every /api/* route once a user is
//     module-disabled, while /api/entitlements/me + /api/operatoros/* stay
//     reachable so the client can render the AccessDeniedScreen
//   - The legacy `subscriptions` table is NOT authoritative — an active
//     subscription row cannot grant access to a module-disabled user.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { eq } from "drizzle-orm";

process.env.NODE_ENV = "test";
process.env.APP_JWT_SECRET =
  process.env.APP_JWT_SECRET || "test-jwt-secret-do-not-use-in-prod";
process.env.MODULE_SSO_SECRET = "test-sso-secret-entitlements-route-tests";
process.env.OPERATOROS_BASE_URL = "https://operatoros.test";
process.env.OPERATOROS_SSO_AUDIENCE = "torqueshed";
process.env.OPERATOROS_SSO_ENV = "dev";
process.env.OPERATOROS_API_URL = "https://api.operatoros.test";
process.env.OPERATOROS_SERVICE_TOKEN = "test-svc-token-entitlements-route";

const { db } = await import("../server/db");
const { users, subscriptions } = await import("@shared/schema");
const { registerRoutes } = await import("../server/routes");
const { storage } = await import("../server/storage");
const { signJWT } = await import("../server/middleware/auth");
const { moduleEnabledGate } = await import("../server/entitlements");
const { optionalAuth } = await import("../server/middleware/auth");

let app: express.Application;
const createdUserIds = new Set<string>();

function uniq(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

async function seedSsoUser(sub: string) {
  const username = uniq("entroute");
  const u = await storage.findOrCreateUserByOperatorOsId({
    sub,
    email: `${username}@example.com`,
    role: "user",
    planSlug: null,
    organizationId: null,
    tenantId: null,
    name: username,
    localRole: "user",
    snapshot: {
      operatoros_user_id: sub,
      operatoros_tenant_id: null,
      module_key: "torqueshed",
      enabled: true,
      access_level: "user",
      features: [],
      featuresExplicit: true,
      role: null,
      module_role: null,
      plan_slug: null,
      subscription_status: "active",
      email: `${username}@example.com`,
      name: username,
      updated_at: new Date().toISOString(),
    },
  });
  createdUserIds.add(u.id);
  return u;
}

function bearer(userId: string) {
  const t = signJWT({ sub: userId, role: "user" });
  return { Authorization: `Bearer ${t}` };
}

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  await registerRoutes(app);

  // Mount the gate EXACTLY the way the real server does in server/index.ts.
  // Mounting under "/api" means req.path is RELATIVE — must match
  // "/entitlements/me" and "/operatoros/...". Anything else (including a
  // bug that uses the absolute "/api/..." prefix) would cause the gate to
  // block /me for disabled users and is regressed by these tests.
  const MODULE_GATE_SKIP = (p: string) =>
    p === "/entitlements/me" || p.startsWith("/operatoros/");
  app.use("/api", (req, res, next) => {
    if (MODULE_GATE_SKIP(req.path)) return next();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    optionalAuth(req as any, res, () => moduleEnabledGate(req, res, next));
  });

  // A trivial protected route to prove the gate blocks /api/* once the user
  // is module-disabled. Defined AFTER the gate is mounted so the gate runs.
  app.get("/api/_test/echo", (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uid = (req as any).userId;
    if (!uid) return res.status(401).json({ error: "unauth" });
    res.json({ ok: true, uid });
  });
});

afterAll(async () => {
  for (const id of createdUserIds) {
    try {
      await db.delete(subscriptions).where(eq(subscriptions.userId, id));
      await db.delete(users).where(eq(users.id, id));
    } catch {
      // best-effort
    }
  }
});

describe("POST /api/operatoros/entitlements/sync — auth + module_key", () => {
  it("401 without the service token header", async () => {
    const u = await seedSsoUser(uniq("sub_noauth"));
    const res = await request(app)
      .post("/api/operatoros/entitlements/sync")
      .send({
        operatoros_user_id: u.operatorOsUserId,
        module_key: "torqueshed",
        enabled: true,
        access_level: "user",
      });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("unauthorized");
  });

  it("401 with the wrong service token", async () => {
    const u = await seedSsoUser(uniq("sub_badtok"));
    const res = await request(app)
      .post("/api/operatoros/entitlements/sync")
      .set("X-OperatorOS-Service-Token", "not-the-right-token")
      .send({
        operatoros_user_id: u.operatorOsUserId,
        module_key: "torqueshed",
        enabled: true,
        access_level: "user",
      });
    expect(res.status).toBe(401);
  });

  it("400 module_key_mismatch when payload targets another module", async () => {
    const u = await seedSsoUser(uniq("sub_wrongmod"));
    const res = await request(app)
      .post("/api/operatoros/entitlements/sync")
      .set("X-OperatorOS-Service-Token", "test-svc-token-entitlements-route")
      .send({
        operatoros_user_id: u.operatorOsUserId,
        module_key: "not-torqueshed",
        enabled: true,
        access_level: "owner",
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("module_key_mismatch");
  });

  it("404 user_not_found when the OperatorOS sub is unknown locally", async () => {
    const res = await request(app)
      .post("/api/operatoros/entitlements/sync")
      .set("X-OperatorOS-Service-Token", "test-svc-token-entitlements-route")
      .send({
        operatoros_user_id: "sub_does_not_exist_xyz",
        module_key: "torqueshed",
        enabled: true,
        access_level: "user",
      });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("user_not_found");
  });
});

describe("POST /api/operatoros/entitlements/sync — access flip", () => {
  it("flips access in real time: enabled→disabled is reflected on the next /api request", async () => {
    const u = await seedSsoUser(uniq("sub_flip"));
    const auth = bearer(u.id);

    // Sanity: enabled user can reach a normal API route.
    const before = await request(app).get("/api/_test/echo").set(auth);
    expect(before.status).toBe(200);

    // Push enabled=false from OperatorOS.
    const push = await request(app)
      .post("/api/operatoros/entitlements/sync")
      .set("X-OperatorOS-Service-Token", "test-svc-token-entitlements-route")
      .send({
        operatoros_user_id: u.operatorOsUserId,
        module_key: "torqueshed",
        enabled: false,
        access_level: "none",
      });
    expect(push.status).toBe(200);
    expect(push.body.enabled).toBe(false);
    expect(push.body.tier).toBe("free");

    // Same /api route now returns 403 module_disabled.
    const after = await request(app).get("/api/_test/echo").set(auth);
    expect(after.status).toBe(403);
    expect(after.body.code).toBe("module_disabled");
    expect(after.body.managedBy).toBe("operatoros");

    // /api/entitlements/me is still reachable so the client can render the
    // access-denied screen.
    const me = await request(app).get("/api/entitlements/me").set(auth);
    expect(me.status).toBe(200);
    expect(me.body.moduleDisabled).toBe(true);
    expect(me.body.managedBy).toBe("operatoros");
    expect(me.body.manageBillingUrl).toBe("https://operatoros.test");
  });

  it("local subscriptions table is NOT authoritative — an active sub cannot override module_disabled", async () => {
    const u = await seedSsoUser(uniq("sub_legacy"));
    const auth = bearer(u.id);

    // Insert a directly-active local subscription as if legacy Stripe code
    // had run. OperatorOS is now the source of truth — this row must NOT
    // grant access once OperatorOS pushes enabled=false.
    await db.insert(subscriptions).values({
      userId: u.id,
      tier: "shop_pro",
      status: "active",
    });

    const push = await request(app)
      .post("/api/operatoros/entitlements/sync")
      .set("X-OperatorOS-Service-Token", "test-svc-token-entitlements-route")
      .send({
        operatoros_user_id: u.operatorOsUserId,
        module_key: "torqueshed",
        enabled: false,
        access_level: "none",
      });
    expect(push.status).toBe(200);

    const after = await request(app).get("/api/_test/echo").set(auth);
    expect(after.status).toBe(403);
    expect(after.body.code).toBe("module_disabled");

    // /api/entitlements/me reports the OperatorOS view, ignoring the local
    // active subscription row.
    const me = await request(app).get("/api/entitlements/me").set(auth);
    expect(me.status).toBe(200);
    expect(me.body.tier).toBe("free");
    expect(me.body.moduleDisabled).toBe(true);
  });
});

describe("Feature gating from snapshot only — legacy `subscriptions` never grants features", () => {
  it("returns 402 when snapshot omits a feature even if an active legacy subscription row exists", async () => {
    // Use the real requireFeature gate, mounted on a fresh route, to prove
    // that feature evaluation runs ENTIRELY off the OperatorOS snapshot.
    // Even with an `active` row in the legacy `subscriptions` table claiming
    // shop_pro, a snapshot whose features array does not include
    // `shop_profile` MUST 402 — the local subscription row is non-authoritative.
    const { requireFeature } = await import("../server/entitlements");
    const local = express();
    local.use(express.json());
    local.use((req, _res, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      optionalAuth(req as any, _res, next);
    });
    local.get(
      "/feat/shop-profile",
      requireFeature("shop_profile"),
      (_req, res) => res.json({ ok: true }),
    );

    const u = await seedSsoUser(uniq("sub_featgate"));
    const auth = bearer(u.id);

    // Legacy active subscription that USED to grant shop_pro features.
    await db.insert(subscriptions).values({
      userId: u.id,
      tier: "shop_pro",
      status: "active",
    });

    // Push a snapshot that is enabled but only lists DIY features — note
    // featuresExplicit so the gate doesn't fall back to deriving from tier.
    const push = await request(app)
      .post("/api/operatoros/entitlements/sync")
      .set("X-OperatorOS-Service-Token", "test-svc-token-entitlements-route")
      .send({
        operatoros_user_id: u.operatorOsUserId,
        module_key: "torqueshed",
        enabled: true,
        access_level: "user",
        features: ["unlimited_saved_cases"], // intentionally NO shop_profile
      });
    expect(push.status).toBe(200);

    const denied = await request(local).get("/feat/shop-profile").set(auth);
    expect(denied.status).toBe(402);
    expect(denied.body.managedBy).toBe("operatoros");
  });
});

describe("snapshotLocalRole is applied on sync", () => {
  it("module_admin role string → local users.role = admin", async () => {
    const u = await seedSsoUser(uniq("sub_admin"));
    const res = await request(app)
      .post("/api/operatoros/entitlements/sync")
      .set("X-OperatorOS-Service-Token", "test-svc-token-entitlements-route")
      .send({
        operatoros_user_id: u.operatorOsUserId,
        module_key: "torqueshed",
        enabled: true,
        access_level: "user",
        module_role: "module_admin",
      });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("admin");
    const fresh = await storage.getUser(u.id);
    expect(fresh?.role).toBe("admin");
  });

  it("tenant_admin alone does NOT grant local admin (no privilege escalation)", async () => {
    const u = await seedSsoUser(uniq("sub_tenantadmin"));
    const res = await request(app)
      .post("/api/operatoros/entitlements/sync")
      .set("X-OperatorOS-Service-Token", "test-svc-token-entitlements-route")
      .send({
        operatoros_user_id: u.operatorOsUserId,
        module_key: "torqueshed",
        enabled: true,
        access_level: "admin",
        module_role: "tenant_admin",
      });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("user");
    const fresh = await storage.getUser(u.id);
    expect(fresh?.role).toBe("user");
  });
});
