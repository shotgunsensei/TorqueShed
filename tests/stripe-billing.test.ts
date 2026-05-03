import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import bcrypt from "bcrypt";
import Stripe from "stripe";
import { eq } from "drizzle-orm";

// Test env must be set before any module reads it.
process.env.NODE_ENV = "test";
process.env.APP_JWT_SECRET = process.env.APP_JWT_SECRET || "test-jwt-secret-do-not-use-in-prod";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret_for_billing_test";
// isStripeConfigured() returns true when these are present, so the upgrade
// route runs through Stripe instead of returning 503.
process.env.REPLIT_CONNECTORS_HOSTNAME =
  process.env.REPLIT_CONNECTORS_HOSTNAME || "fake-connector.invalid";
process.env.REPL_IDENTITY = process.env.REPL_IDENTITY || "test-identity";

const FAKE_CUSTOMER_ID = "cus_test_billing_unlock";
const FAKE_SUBSCRIPTION_ID = "sub_test_billing_unlock";
const FAKE_PRICE_ID = "price_test_diy_pro";
const FAKE_CHECKOUT_URL = "https://stripe.test/checkout/cs_test_unlock";

// Stripe SDK instance used to (a) generate a real signed webhook header and
// (b) verify that header inside the mocked sync engine. No network calls.
const signingStripe = new Stripe("sk_test_local_only");

// Fake Stripe client mimicking the surface used by stripeBilling + the upgrade
// route (customers.create, prices.search/retrieve, checkout.sessions.create,
// subscriptions.list).
function makeFakeStripeClient() {
  const sub = {
    id: FAKE_SUBSCRIPTION_ID,
    customer: FAKE_CUSTOMER_ID,
    status: "active",
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: { id: FAKE_PRICE_ID },
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        },
      ],
    },
  };
  return {
    customers: {
      create: vi.fn(async () => ({ id: FAKE_CUSTOMER_ID })),
    },
    prices: {
      retrieve: vi.fn(async (id: string) => ({
        id,
        active: true,
        metadata: { tier: "diy_pro" },
      })),
      search: vi.fn(async () => ({ data: [{ id: FAKE_PRICE_ID }] })),
    },
    subscriptions: {
      list: vi.fn(async () => ({ data: [sub] })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async () => ({
          id: "cs_test_unlock",
          url: FAKE_CHECKOUT_URL,
        })),
      },
    },
  };
}

const fakeStripeClient = makeFakeStripeClient();

// Mock the Stripe client + sync engine. The mocked processWebhook still
// performs real signature verification via stripe.webhooks.constructEvent so
// invalid signatures are rejected end-to-end.
vi.mock("../server/stripeClient", async () => {
  return {
    getUncachableStripeClient: vi.fn(async () => fakeStripeClient),
    getStripePublishableKey: vi.fn(async () => "pk_test_unused"),
    getStripeSecretKey: vi.fn(async () => "sk_test_unused"),
    getStripeSync: vi.fn(async () => ({
      processWebhook: vi.fn(async (buf: Buffer, sig: string) => {
        signingStripe.webhooks.constructEvent(
          buf,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET!,
        );
      }),
    })),
    isStripeConfigured: () => true,
  };
});

// Imports below run after the mock is registered.
const { db } = await import("../server/db");
const { users, subscriptions, vehicles, threads, garages } = await import("@shared/schema");
const { storage } = await import("../server/storage");
const { signJWT } = await import("../server/middleware/auth");
const { registerRoutes } = await import("../server/routes");
const { setupStripeWebhook } = await import("../server/stripeWebhookRoute");

const TEST_USERNAME = `billing_test_user_${Date.now()}`;
const TEST_GARAGE_ID = "ford";

let app: express.Application;
let userId: string;
let token: string;
let threadId: string;

async function ensureTestGarage() {
  const existing = await db.select().from(garages).where(eq(garages.id, TEST_GARAGE_ID)).limit(1);
  if (existing.length === 0) {
    await db.insert(garages).values({
      id: TEST_GARAGE_ID,
      name: "Ford Garage",
      description: "Test garage",
    } as typeof garages.$inferInsert);
  }
}

beforeAll(async () => {
  app = express();
  // Use the same wiring as production (raw body BEFORE express.json), so
  // route ordering regressions are caught here.
  setupStripeWebhook(app);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  await registerRoutes(app);

  await ensureTestGarage();

  const passwordHash = await bcrypt.hash("test-password-123", 10);
  const user = await storage.createUser({ username: TEST_USERNAME, passwordHash });
  userId = user.id;
  token = signJWT({ sub: userId, role: "user" }) as string;

  const thread = await storage.createThread(
    {
      garageId: TEST_GARAGE_ID,
      title: "Misfire on cyl 1 under load",
      content: "P0301 thrown after replacing plugs. Need a repair plan.",
      symptoms: ["misfire under load"],
      obdCodes: ["P0301"],
      systemCategory: "engine",
      urgency: "soon",
    },
    userId,
  );
  threadId = thread.id;
});

afterAll(async () => {
  if (userId) {
    try {
      await db.delete(threads).where(eq(threads.userId, userId));
      await db.delete(vehicles).where(eq(vehicles.userId, userId));
      await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
    } catch {
      // best-effort cleanup
    }
  }
});

function authHeader() {
  return { Authorization: `Bearer ${token}` } as Record<string, string>;
}

describe("Stripe upgrade -> webhook -> tier unlock", () => {
  it("upgrades a free user to diy_pro via webhook and unlocks gated endpoints", async () => {
    // 1. New user starts as free.
    const before = await request(app).get("/api/subscription").set(authHeader());
    expect(before.status).toBe(200);
    expect(before.body.tier).toBe("free");

    // 2. PDF repair plan is gated by pdf_repair_plan (diy_pro+). Free user
    //    must get HTTP 402 here BEFORE the webhook fires.
    const gatedBefore = await request(app)
      .post(`/api/cases/${threadId}/repair-plan`)
      .set(authHeader())
      .send({ exportType: "pdf" });
    expect(gatedBefore.status).toBe(402);
    expect(gatedBefore.body.feature).toBe("pdf_repair_plan");

    // 3. Kick off the upgrade flow. The mocked Stripe client returns a fake
    //    checkout URL; the route must succeed (200) and ensureStripeCustomer
    //    must persist FAKE_CUSTOMER_ID against this user, with no manual help.
    const upgrade = await request(app)
      .post("/api/subscription/upgrade")
      .set(authHeader())
      .send({ tier: "diy_pro" });
    expect(upgrade.status).toBe(200);
    expect(upgrade.body.mode).toBe("checkout");
    expect(upgrade.body.checkoutUrl).toBe(FAKE_CHECKOUT_URL);
    const persistedSub = await storage.getSubscription(userId);
    expect(persistedSub?.stripeCustomerId).toBe(FAKE_CUSTOMER_ID);

    // 4. Build a synthetic customer.subscription.created event and sign it
    //    with Stripe's official webhook signing helper.
    const eventPayload = {
      id: "evt_test_billing_unlock",
      object: "event",
      created: Math.floor(Date.now() / 1000),
      type: "customer.subscription.created",
      data: {
        object: {
          id: FAKE_SUBSCRIPTION_ID,
          object: "subscription",
          customer: FAKE_CUSTOMER_ID,
          status: "active",
          cancel_at_period_end: false,
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
          items: {
            object: "list",
            data: [
              {
                id: "si_test_unlock",
                price: { id: FAKE_PRICE_ID, metadata: { tier: "diy_pro" } },
              },
            ],
          },
          metadata: { userId, tier: "diy_pro" },
        },
      },
    };
    const rawBody = JSON.stringify(eventPayload);
    const signature = signingStripe.webhooks.generateTestHeaderString({
      payload: rawBody,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });

    // 4a. A bad signature must be rejected (proves the route + mocked sync
    //     are actually verifying signatures end-to-end).
    const badSig = await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", "t=1,v1=deadbeef")
      .set("content-type", "application/json")
      .send(rawBody);
    expect(badSig.status).toBe(400);

    // 4b. A correctly-signed event must be accepted.
    const webhookRes = await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", signature)
      .set("content-type", "application/json")
      .send(rawBody);
    expect(webhookRes.status).toBe(200);

    // 5. GET /api/subscription now reports diy_pro.
    const after = await request(app).get("/api/subscription").set(authHeader());
    expect(after.status).toBe(200);
    expect(after.body.tier).toBe("diy_pro");

    // 6. The previously-402 endpoint now returns 200.
    const gatedAfter = await request(app)
      .post(`/api/cases/${threadId}/repair-plan`)
      .set(authHeader())
      .send({ exportType: "pdf" });
    expect(gatedAfter.status).toBe(200);
    expect(gatedAfter.headers["content-type"]).toMatch(/application\/pdf/);
  });
});
