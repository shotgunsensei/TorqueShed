import type Stripe from "stripe";
import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import { subscriptions, users, type SubscriptionTier, SUBSCRIPTION_TIERS } from "@shared/schema";
import { storage } from "./storage";
import { getUncachableStripeClient } from "./stripeClient";

const PAID_TIERS: SubscriptionTier[] = ["diy_pro", "garage_pro", "shop_pro"];

export const TIER_PRODUCT_NAME: Record<Exclude<SubscriptionTier, "free">, string> = {
  diy_pro: "TorqueShed DIY Pro",
  garage_pro: "TorqueShed Garage Pro",
  shop_pro: "TorqueShed Shop Pro",
};

export const TIER_MONTHLY_AMOUNT_CENTS: Record<Exclude<SubscriptionTier, "free">, number> = {
  diy_pro: 999,
  garage_pro: 2900,
  shop_pro: 7900,
};

export function isPaidTier(tier: string | undefined | null): tier is Exclude<SubscriptionTier, "free"> {
  return !!tier && PAID_TIERS.includes(tier as SubscriptionTier);
}

type StripePriceRow = {
  id: string;
} & Record<string, unknown>;

type StripePriceMetadataRow = {
  metadata: Record<string, string> | null;
} & Record<string, unknown>;

/**
 * Look up the active Stripe price for a tier by metadata.tier.
 * Prefers the synced stripe schema and falls back to a Stripe API call.
 */
export async function getPriceForTier(tier: Exclude<SubscriptionTier, "free">): Promise<string | null> {
  try {
    const result = await db.execute<StripePriceRow>(sql`
      SELECT pr.id
      FROM stripe.prices pr
      WHERE pr.active = true
        AND (pr.metadata ->> 'tier') = ${tier}
      ORDER BY pr.created DESC
      LIMIT 1
    `);
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
  } catch {
    // stripe schema may not exist yet on first boot; fall through to API
  }

  try {
    const stripe = await getUncachableStripeClient();
    const list = await stripe.prices.search({
      query: `active:'true' AND metadata['tier']:'${tier}'`,
      limit: 1,
    });
    if (list.data.length > 0) return list.data[0].id;
  } catch {
    return null;
  }
  return null;
}

async function getTierForPriceId(priceId: string | null | undefined): Promise<SubscriptionTier> {
  if (!priceId) return "free";
  try {
    const result = await db.execute<StripePriceMetadataRow>(sql`
      SELECT metadata FROM stripe.prices WHERE id = ${priceId} LIMIT 1
    `);
    if (result.rows.length > 0) {
      const meta = result.rows[0].metadata;
      const t = meta?.tier;
      if (t && (SUBSCRIPTION_TIERS as readonly string[]).includes(t)) {
        return t as SubscriptionTier;
      }
    }
  } catch {}

  try {
    const stripe = await getUncachableStripeClient();
    const price = await stripe.prices.retrieve(priceId);
    const t = price.metadata?.tier;
    if (t && (SUBSCRIPTION_TIERS as readonly string[]).includes(t)) {
      return t as SubscriptionTier;
    }
  } catch {}
  return "free";
}

/**
 * Find or create a Stripe customer for a user, persisting the ID locally.
 */
export async function ensureStripeCustomer(userId: string): Promise<string> {
  const existing = await storage.getSubscription(userId);
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");

  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.create({
    name: user.username,
    metadata: { userId: user.id, username: user.username },
  });

  if (existing) {
    await db
      .update(subscriptions)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(subscriptions.userId, userId));
  } else {
    await db.insert(subscriptions).values({
      userId,
      tier: "free",
      status: "active",
      stripeCustomerId: customer.id,
    });
  }
  return customer.id;
}

/**
 * Create a Stripe Checkout Session for a paid tier.
 */
export async function createSubscriptionCheckoutSession(params: {
  userId: string;
  tier: Exclude<SubscriptionTier, "free">;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string }> {
  const priceId = await getPriceForTier(params.tier);
  if (!priceId) {
    throw new Error(
      `No Stripe price configured for tier "${params.tier}". Run the seed script: npx tsx scripts/seed-stripe-tiers.ts`
    );
  }

  const customerId = await ensureStripeCustomer(params.userId);
  const stripe = await getUncachableStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { userId: params.userId, tier: params.tier },
    },
    metadata: { userId: params.userId, tier: params.tier },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}

/**
 * Create a Stripe Billing Portal session so the user can manage / cancel.
 */
export async function createBillingPortalSession(params: {
  userId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const sub = await storage.getSubscription(params.userId);
  if (!sub?.stripeCustomerId) {
    throw new Error("No Stripe customer on file. Start a checkout first.");
  }
  const stripe = await getUncachableStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: params.returnUrl,
  });
  return { url: session.url };
}

interface NormalizedStripeSub {
  id: string;
  customer: string;
  status: string;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  priceId: string | null;
}

interface StripeSubscriptionAttrs {
  current_period_end?: number | null;
  cancel_at_period_end?: boolean | null;
  items?: { data?: Array<{ price?: { id?: string } | null }> };
}

type StripeSubscriptionRow = {
  id: string;
  customer: string;
  status: string;
  current_period_end?: number | null;
  attrs: StripeSubscriptionAttrs | null;
} & Record<string, unknown>;

function pickPriceIdFromStripeSub(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  return item?.price?.id ?? null;
}

function normalizeApiSub(sub: Stripe.Subscription): NormalizedStripeSub {
  // The Stripe SDK exposes current_period_end on the subscription object even
  // though some API versions only return it via items. We fall back to the
  // first item's period end if needed.
  const apiSub = sub as Stripe.Subscription & { current_period_end?: number | null };
  const periodEnd =
    apiSub.current_period_end ??
    sub.items?.data?.[0]?.current_period_end ??
    null;
  return {
    id: sub.id,
    customer: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    status: sub.status,
    current_period_end: periodEnd,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    priceId: pickPriceIdFromStripeSub(sub),
  };
}

/**
 * Read the most relevant subscription for a customer from the synced stripe schema
 * and write tier/status/period to the local subscriptions table.
 */
export async function syncLocalSubscriptionForCustomer(stripeCustomerId: string): Promise<void> {
  const userRow = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
    .limit(1);
  const local = userRow[0];
  if (!local) return;

  let stripeSub: NormalizedStripeSub | null = null;

  try {
    const result = await db.execute<StripeSubscriptionRow>(sql`
      SELECT id, customer, status, current_period_end, attrs
      FROM stripe.subscriptions
      WHERE customer = ${stripeCustomerId}
      ORDER BY
        CASE WHEN status IN ('active','trialing','past_due') THEN 0 ELSE 1 END,
        created DESC NULLS LAST
      LIMIT 1
    `);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      const attrs = row.attrs ?? {};
      const periodEnd = row.current_period_end ?? attrs.current_period_end ?? null;
      stripeSub = {
        id: row.id,
        customer: row.customer,
        status: row.status,
        current_period_end: periodEnd ?? null,
        cancel_at_period_end: Boolean(attrs.cancel_at_period_end),
        priceId: attrs.items?.data?.[0]?.price?.id ?? null,
      };
    }
  } catch {
    // Schema not present, fall back to API
  }

  if (!stripeSub) {
    try {
      const stripe = await getUncachableStripeClient();
      const list = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "all",
        limit: 5,
      });
      const ranked = [...list.data].sort((a, b) => {
        const score = (s: Stripe.Subscription) =>
          (["active", "trialing", "past_due"].includes(s.status) ? 0 : 1);
        if (score(a) !== score(b)) return score(a) - score(b);
        return (b.created ?? 0) - (a.created ?? 0);
      });
      const first = ranked[0];
      if (first) {
        stripeSub = normalizeApiSub(first);
      }
    } catch (err) {
      console.error("[stripe] Failed to list subscriptions for customer", stripeCustomerId, err);
      return;
    }
  }

  if (!stripeSub) {
    await db
      .update(subscriptions)
      .set({
        tier: "free",
        status: "canceled",
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, local.userId));
    return;
  }

  const isLive = ["active", "trialing"].includes(stripeSub.status);
  const tier = isLive ? await getTierForPriceId(stripeSub.priceId) : "free";

  await db
    .update(subscriptions)
    .set({
      tier,
      status: stripeSub.status,
      stripeSubscriptionId: stripeSub.id,
      currentPeriodEnd: stripeSub.current_period_end
        ? new Date(stripeSub.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.userId, local.userId));
}

interface StripeWebhookEventEnvelope {
  type?: string;
  data?: {
    object?: {
      customer?: string | { id?: string } | null;
      id?: string;
    } | null;
  };
}

/**
 * Inspect a webhook payload buffer for a customer ID and resync that customer.
 * Safe to call after sync.processWebhook so the stripe schema is already updated.
 */
export async function reconcileWebhookPayload(payload: Buffer): Promise<void> {
  let event: StripeWebhookEventEnvelope;
  try {
    event = JSON.parse(payload.toString("utf8")) as StripeWebhookEventEnvelope;
  } catch {
    return;
  }

  const obj = event.data?.object;
  if (!obj) return;

  let customerId: string | null = null;
  if (typeof obj.customer === "string") {
    customerId = obj.customer;
  } else if (obj.customer && typeof obj.customer === "object" && obj.customer.id) {
    customerId = obj.customer.id;
  } else if (
    (event.type === "customer.deleted" || event.type === "customer.created") &&
    typeof obj.id === "string"
  ) {
    customerId = obj.id;
  }

  if (!customerId) return;

  try {
    await syncLocalSubscriptionForCustomer(customerId);
  } catch (err) {
    console.error("[stripe] Failed to reconcile customer", customerId, err);
  }
}

export async function syncAllLocalSubscriptions(): Promise<number> {
  const rows = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions);
  let count = 0;
  for (const row of rows) {
    if (!row.stripeCustomerId) continue;
    try {
      await syncLocalSubscriptionForCustomer(row.stripeCustomerId);
      count++;
    } catch (err) {
      console.error("[stripe] backfill failed for", row.stripeCustomerId, err);
    }
  }
  return count;
}
