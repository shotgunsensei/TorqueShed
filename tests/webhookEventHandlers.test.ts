import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../server/db", () => ({
  db: {},
  pool: {},
}));

vi.mock("../server/storage", () => ({
  storage: {
    getSubscriptionByStripeCustomerId: vi.fn(),
    updateSubscriptionFromStripe: vi.fn(),
  },
}));

import { storage } from "../server/storage";
import { applyStripeEvent } from "../server/webhookEventHandlers";
import {
  CUSTOMER_ID,
  PERIOD_END_DATE,
  PRICE_ID,
  SUBSCRIPTION_ID,
  checkoutSessionCompletedEvent,
  expertEscalationCompletedEvent,
  invoicePaymentFailedEvent,
  invoicePaymentSucceededEvent,
  subscriptionCreatedEvent,
  subscriptionDeletedEvent,
  subscriptionPastDueEvent,
  subscriptionUpdatedEvent,
} from "./fixtures/stripeEvents";

const baseLocal = {
  id: "row_1",
  userId: "user_1",
  tier: "free" as const,
  status: "active" as const,
  stripeCustomerId: CUSTOMER_ID,
  stripeSubscriptionId: null,
  stripePriceId: null,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const mockedStorage = storage as unknown as {
  getSubscriptionByStripeCustomerId: ReturnType<typeof vi.fn>;
  updateSubscriptionFromStripe: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  mockedStorage.getSubscriptionByStripeCustomerId.mockReset();
  mockedStorage.updateSubscriptionFromStripe.mockReset();
  mockedStorage.getSubscriptionByStripeCustomerId.mockResolvedValue({ ...baseLocal });
  mockedStorage.updateSubscriptionFromStripe.mockResolvedValue({ ...baseLocal });
});

describe("applyStripeEvent", () => {
  it("checkout.session.completed activates the subscription with metadata tier", async () => {
    const ok = await applyStripeEvent(checkoutSessionCompletedEvent());
    expect(ok).toBe(true);
    expect(mockedStorage.updateSubscriptionFromStripe).toHaveBeenCalledTimes(1);
    expect(mockedStorage.updateSubscriptionFromStripe).toHaveBeenCalledWith("user_1", expect.objectContaining({
      tier: "garage_pro",
      status: "active",
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: SUBSCRIPTION_ID,
      stripePriceId: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    }));
  });

  it("checkout.session.completed ignores expert-escalation sessions", async () => {
    const ok = await applyStripeEvent(expertEscalationCompletedEvent());
    expect(ok).toBe(false);
    expect(mockedStorage.updateSubscriptionFromStripe).not.toHaveBeenCalled();
  });

  it("customer.subscription.created writes tier/status/period from event", async () => {
    const ok = await applyStripeEvent(subscriptionCreatedEvent());
    expect(ok).toBe(true);
    expect(mockedStorage.updateSubscriptionFromStripe).toHaveBeenCalledWith("user_1", expect.objectContaining({
      tier: "garage_pro",
      status: "active",
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: SUBSCRIPTION_ID,
      stripePriceId: PRICE_ID,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: PERIOD_END_DATE,
    }));
  });

  it("customer.subscription.updated propagates cancel_at_period_end and tier changes", async () => {
    const ok = await applyStripeEvent(subscriptionUpdatedEvent());
    expect(ok).toBe(true);
    expect(mockedStorage.updateSubscriptionFromStripe).toHaveBeenCalledWith("user_1", expect.objectContaining({
      tier: "shop_pro",
      status: "active",
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: SUBSCRIPTION_ID,
      stripePriceId: "price_test_shop_pro",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: PERIOD_END_DATE,
    }));
  });

  it("customer.subscription.updated drops tier to free when status is past_due", async () => {
    const ok = await applyStripeEvent(subscriptionPastDueEvent());
    expect(ok).toBe(true);
    expect(mockedStorage.updateSubscriptionFromStripe).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({ tier: "free", status: "past_due" }),
    );
  });

  it("customer.subscription.deleted clears the subscription back to free/canceled", async () => {
    const ok = await applyStripeEvent(subscriptionDeletedEvent());
    expect(ok).toBe(true);
    expect(mockedStorage.updateSubscriptionFromStripe).toHaveBeenCalledWith("user_1", expect.objectContaining({
      tier: "free",
      status: "canceled",
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: SUBSCRIPTION_ID,
      stripePriceId: PRICE_ID,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: PERIOD_END_DATE,
    }));
  });

  it("invoice.payment_succeeded sets status to active and preserves tier", async () => {
    mockedStorage.getSubscriptionByStripeCustomerId.mockResolvedValue({
      ...baseLocal,
      tier: "garage_pro",
      status: "past_due",
      stripeSubscriptionId: SUBSCRIPTION_ID,
      stripePriceId: PRICE_ID,
      currentPeriodEnd: PERIOD_END_DATE,
      cancelAtPeriodEnd: false,
    });
    const ok = await applyStripeEvent(invoicePaymentSucceededEvent());
    expect(ok).toBe(true);
    expect(mockedStorage.updateSubscriptionFromStripe).toHaveBeenCalledWith("user_1", expect.objectContaining({
      tier: "garage_pro",
      status: "active",
      stripeCustomerId: CUSTOMER_ID,
      stripeSubscriptionId: SUBSCRIPTION_ID,
      stripePriceId: PRICE_ID,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: PERIOD_END_DATE,
    }));
  });

  it("invoice.payment_failed flips status to past_due", async () => {
    mockedStorage.getSubscriptionByStripeCustomerId.mockResolvedValue({
      ...baseLocal,
      tier: "garage_pro",
      status: "active",
      stripeSubscriptionId: SUBSCRIPTION_ID,
      stripePriceId: PRICE_ID,
      currentPeriodEnd: PERIOD_END_DATE,
    });
    const ok = await applyStripeEvent(invoicePaymentFailedEvent());
    expect(ok).toBe(true);
    expect(mockedStorage.updateSubscriptionFromStripe).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({ tier: "garage_pro", status: "past_due" }),
    );
  });

  it("returns false when no local subscription exists for the customer", async () => {
    mockedStorage.getSubscriptionByStripeCustomerId.mockResolvedValue(undefined);
    const ok = await applyStripeEvent(subscriptionCreatedEvent());
    expect(ok).toBe(false);
    expect(mockedStorage.updateSubscriptionFromStripe).not.toHaveBeenCalled();
  });

  it("ignores event types we don't handle", async () => {
    const evt = { type: "customer.created", data: { object: { id: "cus_x" } } } as never;
    const ok = await applyStripeEvent(evt);
    expect(ok).toBe(false);
    expect(mockedStorage.updateSubscriptionFromStripe).not.toHaveBeenCalled();
  });
});
