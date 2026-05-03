import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import Stripe from "stripe";

// Replace heavy module-load side effects so we can import the route.
vi.mock("../server/db", () => ({ db: {}, pool: {} }));

vi.mock("../server/storage", () => ({
  storage: {
    getSubscriptionByStripeCustomerId: vi.fn(),
    updateSubscriptionFromStripe: vi.fn(),
    markExpertReviewPaid: vi.fn(),
    markExpertReviewFailed: vi.fn(),
  },
}));

// Real signature verifier: build a stripeSync stub whose processWebhook calls
// stripe.webhooks.constructEventAsync against a known secret. This exercises
// the actual production code path through WebhookHandlers.processWebhook ->
// stripeSync.processWebhook -> stripe.webhooks.constructEventAsync, and
// then through the route's applyStripeEvent -> storage.updateSubscriptionFromStripe.
const WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests";
const stripeForVerification = new Stripe("sk_test_fake_for_verification_only", {
  apiVersion: "2026-02-25.clover",
});
const stripeSyncProcessed = vi.fn().mockResolvedValue(undefined);
vi.mock("../server/stripeClient", () => ({
  isStripeConfigured: () => false,
  getStripeSync: vi.fn(async () => ({
    async processWebhook(payload: Buffer, signature: string) {
      // Real Stripe HMAC verifier — same call StripeSync makes internally.
      await stripeForVerification.webhooks.constructEventAsync(
        payload,
        signature,
        WEBHOOK_SECRET,
      );
      await stripeSyncProcessed();
    },
  })),
}));

import { storage } from "../server/storage";
import { setupStripeWebhook } from "../server/stripeWebhookRoute";
import {
  CUSTOMER_ID,
  SUBSCRIPTION_ID,
  PRICE_ID,
  PERIOD_END_DATE,
  checkoutSessionCompletedEvent,
  subscriptionCreatedEvent,
  subscriptionUpdatedEvent,
  subscriptionPastDueEvent,
  subscriptionDeletedEvent,
  invoicePaymentSucceededEvent,
  invoicePaymentFailedEvent,
} from "./fixtures/stripeEvents";

const mockedStorage = storage as unknown as {
  getSubscriptionByStripeCustomerId: ReturnType<typeof vi.fn>;
  updateSubscriptionFromStripe: ReturnType<typeof vi.fn>;
};

const baseLocal = {
  id: "row_1",
  userId: "user_1",
  tier: "garage_pro" as const,
  status: "active" as const,
  stripeCustomerId: CUSTOMER_ID,
  stripeSubscriptionId: SUBSCRIPTION_ID,
  stripePriceId: PRICE_ID,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: PERIOD_END_DATE,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

function buildApp() {
  const app = express();
  setupStripeWebhook(app);
  return app;
}

function signPayload(payload: string, secret = WEBHOOK_SECRET) {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret });
}

async function postEvent(app: express.Express, event: unknown, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify(event);
  const sig = signPayload(payload, secret);
  return request(app)
    .post("/api/stripe/webhook")
    .set("content-type", "application/json")
    .set("stripe-signature", sig)
    .send(payload);
}

beforeEach(() => {
  stripeSyncProcessed.mockClear();
  mockedStorage.getSubscriptionByStripeCustomerId.mockReset();
  mockedStorage.updateSubscriptionFromStripe.mockReset();
  mockedStorage.getSubscriptionByStripeCustomerId.mockResolvedValue({ ...baseLocal });
  mockedStorage.updateSubscriptionFromStripe.mockResolvedValue({ ...baseLocal });
});

describe("POST /api/stripe/webhook — signature verification", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("content-type", "application/json")
      .send(JSON.stringify(subscriptionCreatedEvent()));
    expect(res.status).toBe(400);
    expect(stripeSyncProcessed).not.toHaveBeenCalled();
    expect(mockedStorage.updateSubscriptionFromStripe).not.toHaveBeenCalled();
  });

  it("returns 400 and does not mutate state when the signature is invalid", async () => {
    const app = buildApp();

    const r1 = await postEvent(app, subscriptionCreatedEvent(), "whsec_wrong_secret");
    expect(r1.status).toBe(400);

    const payload = JSON.stringify(subscriptionCreatedEvent());
    const r2 = await request(app)
      .post("/api/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", "t=1,v1=deadbeef")
      .send(payload);
    expect(r2.status).toBe(400);

    expect(stripeSyncProcessed).not.toHaveBeenCalled();
    expect(mockedStorage.updateSubscriptionFromStripe).not.toHaveBeenCalled();
  });
});

describe("POST /api/stripe/webhook — subscription mutations", () => {
  it("checkout.session.completed activates subscription with metadata tier", async () => {
    const app = buildApp();
    mockedStorage.getSubscriptionByStripeCustomerId.mockResolvedValue({
      ...baseLocal,
      tier: "free",
      status: "active",
      stripeSubscriptionId: null,
    });

    const res = await postEvent(app, checkoutSessionCompletedEvent());

    expect(res.status).toBe(200);
    expect(stripeSyncProcessed).toHaveBeenCalledTimes(1);
    expect(mockedStorage.updateSubscriptionFromStripe).toHaveBeenCalledTimes(1);
    expect(mockedStorage.updateSubscriptionFromStripe).toHaveBeenCalledWith("user_1", {
      tier: "garage_pro",
      status: "active",
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: SUBSCRIPTION_ID,
      stripePriceId: PRICE_ID,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: PERIOD_END_DATE,
    });
  });

  it("customer.subscription.created writes tier/status/period from event", async () => {
    const app = buildApp();
    const res = await postEvent(app, subscriptionCreatedEvent());

    expect(res.status).toBe(200);
    expect(mockedStorage.updateSubscriptionFromStripe).toHaveBeenCalledWith("user_1", {
      tier: "garage_pro",
      status: "active",
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: SUBSCRIPTION_ID,
      stripePriceId: PRICE_ID,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: PERIOD_END_DATE,
    });
  });

  it("customer.subscription.updated propagates cancel_at_period_end and tier changes", async () => {
    const app = buildApp();
    const res = await postEvent(app, subscriptionUpdatedEvent());

    expect(res.status).toBe(200);
    expect(mockedStorage.updateSubscriptionFromStripe).toHaveBeenCalledWith("user_1", {
      tier: "shop_pro",
      status: "active",
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: SUBSCRIPTION_ID,
      stripePriceId: "price_test_shop_pro",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: PERIOD_END_DATE,
    });
  });

  it("customer.subscription.updated drops tier to free when status is past_due", async () => {
    const app = buildApp();
    const res = await postEvent(app, subscriptionPastDueEvent());

    expect(res.status).toBe(200);
    const [, payload] = mockedStorage.updateSubscriptionFromStripe.mock.calls[0];
    expect(payload).toMatchObject({
      tier: "free",
      status: "past_due",
      stripeSubscriptionId: SUBSCRIPTION_ID,
      cancelAtPeriodEnd: false,
    });
  });

  it("customer.subscription.deleted clears the subscription back to free/canceled", async () => {
    const app = buildApp();
    const res = await postEvent(app, subscriptionDeletedEvent());

    expect(res.status).toBe(200);
    expect(mockedStorage.updateSubscriptionFromStripe).toHaveBeenCalledWith("user_1", {
      tier: "free",
      status: "canceled",
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: SUBSCRIPTION_ID,
      stripePriceId: PRICE_ID,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: PERIOD_END_DATE,
    });
  });

  it("invoice.payment_succeeded sets status to active and preserves tier", async () => {
    const app = buildApp();
    const res = await postEvent(app, invoicePaymentSucceededEvent());

    expect(res.status).toBe(200);
    expect(mockedStorage.updateSubscriptionFromStripe).toHaveBeenCalledWith("user_1", {
      tier: "garage_pro",
      status: "active",
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: SUBSCRIPTION_ID,
      stripePriceId: PRICE_ID,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: PERIOD_END_DATE,
    });
  });

  it("invoice.payment_failed flips status to past_due without changing tier", async () => {
    const app = buildApp();
    const res = await postEvent(app, invoicePaymentFailedEvent());

    expect(res.status).toBe(200);
    expect(mockedStorage.updateSubscriptionFromStripe).toHaveBeenCalledWith("user_1", {
      tier: "garage_pro",
      status: "past_due",
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: SUBSCRIPTION_ID,
      stripePriceId: PRICE_ID,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: PERIOD_END_DATE,
    });
  });

  it("does not mutate when no local subscription row exists for the customer", async () => {
    const app = buildApp();
    mockedStorage.getSubscriptionByStripeCustomerId.mockResolvedValue(undefined);

    const res = await postEvent(app, subscriptionCreatedEvent());
    expect(res.status).toBe(200);
    expect(mockedStorage.updateSubscriptionFromStripe).not.toHaveBeenCalled();
  });
});
