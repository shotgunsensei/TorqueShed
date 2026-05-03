import type Stripe from "stripe";

export const PERIOD_END_UNIX = 1_900_000_000;
export const PERIOD_END_DATE = new Date(PERIOD_END_UNIX * 1000);

export const CUSTOMER_ID = "cus_test_123";
export const SUBSCRIPTION_ID = "sub_test_123";
export const PRICE_ID = "price_test_garage_pro";
export const SESSION_ID = "cs_test_123";
export const INVOICE_ID = "in_test_123";

function envelope<T>(type: Stripe.Event["type"], object: T): Stripe.Event {
  return {
    id: `evt_${type}_test`,
    object: "event",
    api_version: "2026-02-25.clover",
    created: 1700000000,
    data: { object: object as unknown as Stripe.Event.Data.Object },
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    type,
  } as Stripe.Event;
}

export function checkoutSessionCompletedEvent(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Event {
  const session = {
    id: SESSION_ID,
    object: "checkout.session",
    customer: CUSTOMER_ID,
    subscription: SUBSCRIPTION_ID,
    mode: "subscription",
    status: "complete",
    metadata: { tier: "garage_pro", userId: "user_1" },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
  return envelope("checkout.session.completed", session);
}

export function expertEscalationCompletedEvent(): Stripe.Event {
  const session = {
    id: SESSION_ID,
    object: "checkout.session",
    customer: CUSTOMER_ID,
    mode: "payment",
    status: "complete",
    metadata: { kind: "expert_escalation", reviewId: "rev_1" },
  } as unknown as Stripe.Checkout.Session;
  return envelope("checkout.session.completed", session);
}

function buildSubscription(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: SUBSCRIPTION_ID,
    object: "subscription",
    customer: CUSTOMER_ID,
    status: "active",
    cancel_at_period_end: false,
    current_period_end: PERIOD_END_UNIX,
    metadata: {},
    items: {
      data: [
        {
          id: "si_test_1",
          current_period_end: PERIOD_END_UNIX,
          price: {
            id: PRICE_ID,
            metadata: { tier: "garage_pro" },
          },
        },
      ],
    },
    ...overrides,
  };
}

export function subscriptionCreatedEvent(): Stripe.Event {
  return envelope("customer.subscription.created", buildSubscription());
}

export function subscriptionUpdatedEvent(): Stripe.Event {
  return envelope(
    "customer.subscription.updated",
    buildSubscription({
      cancel_at_period_end: true,
      metadata: { tier: "shop_pro" },
      items: {
        data: [
          {
            id: "si_test_1",
            current_period_end: PERIOD_END_UNIX,
            price: { id: "price_test_shop_pro", metadata: { tier: "shop_pro" } },
          },
        ],
      },
    }),
  );
}

export function subscriptionPastDueEvent(): Stripe.Event {
  return envelope(
    "customer.subscription.updated",
    buildSubscription({ status: "past_due" }),
  );
}

export function subscriptionDeletedEvent(): Stripe.Event {
  return envelope(
    "customer.subscription.deleted",
    buildSubscription({ status: "canceled" }),
  );
}

export function invoicePaymentSucceededEvent(): Stripe.Event {
  const invoice = {
    id: INVOICE_ID,
    object: "invoice",
    customer: CUSTOMER_ID,
    subscription: SUBSCRIPTION_ID,
    status: "paid",
  } as unknown as Stripe.Invoice;
  return envelope("invoice.payment_succeeded", invoice);
}

export function invoicePaymentFailedEvent(): Stripe.Event {
  const invoice = {
    id: INVOICE_ID,
    object: "invoice",
    customer: CUSTOMER_ID,
    subscription: SUBSCRIPTION_ID,
    status: "open",
  } as unknown as Stripe.Invoice;
  return envelope("invoice.payment_failed", invoice);
}
