import type Stripe from "stripe";
import {
  SUBSCRIPTION_TIERS,
  SUBSCRIPTION_STATUSES,
  type SubscriptionTier,
  type SubscriptionStatus,
} from "@shared/schema";
import { storage } from "./storage";

const TIER_SET = new Set<string>(SUBSCRIPTION_TIERS);
const STATUS_SET = new Set<string>(SUBSCRIPTION_STATUSES);

function asTier(value: unknown, fallback: SubscriptionTier = "free"): SubscriptionTier {
  return typeof value === "string" && TIER_SET.has(value)
    ? (value as SubscriptionTier)
    : fallback;
}

function asStatus(value: unknown, fallback: SubscriptionStatus = "active"): SubscriptionStatus {
  if (typeof value !== "string") return fallback;
  if (STATUS_SET.has(value)) return value as SubscriptionStatus;
  // Map known Stripe statuses outside our enum to safe equivalents so
  // unknown statuses never silently masquerade as "active".
  if (value === "incomplete_expired" || value === "unpaid" || value === "paused") {
    return "canceled";
  }
  return fallback;
}

function customerIdOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  return null;
}

function subscriptionIdOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  return null;
}

interface SubscriptionLikeItem {
  current_period_end?: number | null;
  price?: {
    id?: string | null;
    metadata?: Record<string, string> | null;
    recurring?: { interval?: string | null } | null;
  } | null;
}

interface SubscriptionLike {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end?: boolean | null;
  current_period_end?: number | null;
  trial_end?: number | null;
  items?: { data?: SubscriptionLikeItem[] };
  metadata?: Record<string, string> | null;
}

function pickInterval(sub: SubscriptionLike): "month" | "year" | null {
  const fromMeta = sub.metadata?.interval;
  if (fromMeta === "month" || fromMeta === "year") return fromMeta;
  const fromPrice = sub.items?.data?.[0]?.price?.recurring?.interval;
  if (fromPrice === "month" || fromPrice === "year") return fromPrice;
  return null;
}

function pickTrialEnd(sub: SubscriptionLike): Date | null {
  const ts = typeof sub.trial_end === "number" ? sub.trial_end : null;
  return ts ? new Date(ts * 1000) : null;
}

function pickPeriodEnd(sub: SubscriptionLike): Date | null {
  const fromSub = sub.current_period_end;
  const fromItem = sub.items?.data?.[0]?.current_period_end ?? null;
  const ts = typeof fromSub === "number" ? fromSub : fromItem;
  return typeof ts === "number" ? new Date(ts * 1000) : null;
}

function pickPriceId(sub: SubscriptionLike): string | null {
  return sub.items?.data?.[0]?.price?.id ?? null;
}

function pickTierFromSubscription(sub: SubscriptionLike): SubscriptionTier | null {
  const fromSubMeta = sub.metadata?.tier;
  if (fromSubMeta && TIER_SET.has(fromSubMeta)) return fromSubMeta as SubscriptionTier;
  const fromPriceMeta = sub.items?.data?.[0]?.price?.metadata?.tier;
  if (fromPriceMeta && TIER_SET.has(fromPriceMeta)) return fromPriceMeta as SubscriptionTier;
  return null;
}

/**
 * Apply a verified Stripe event to the local `subscriptions` table.
 * Handles checkout.session.completed, customer.subscription.{created,updated,deleted}
 * and invoice.payment_{succeeded,failed}. Returns true when a row was written.
 */
export async function applyStripeEvent(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.kind === "expert_escalation") return false;
      const customerId = customerIdOf(session.customer);
      if (!customerId) return false;
      const local = await storage.getSubscriptionByStripeCustomerId(customerId);
      if (!local) return false;
      const tier = asTier(session.metadata?.tier, local.tier as SubscriptionTier);
      const subscriptionId = subscriptionIdOf(session.subscription) ?? local.stripeSubscriptionId ?? null;
      const sessionInterval =
        session.metadata?.interval === "year" || session.metadata?.interval === "month"
          ? (session.metadata.interval as "month" | "year")
          : (local.interval as "month" | "year" | null) ?? null;
      // Preserve a trialing status already recorded by customer.subscription.* events
      // for the same subscription; webhook ordering is not guaranteed and forcing
      // "active" here would erase a valid trial countdown shown to the user.
      const localStatus = local.status as SubscriptionStatus;
      const sameSub =
        subscriptionId !== null && local.stripeSubscriptionId === subscriptionId;
      const trialStillActive =
        local.trialEndsAt instanceof Date && local.trialEndsAt.getTime() > Date.now();
      const preserveTrial =
        sameSub && (localStatus === "trialing" || trialStillActive);
      const status: SubscriptionStatus = preserveTrial ? "trialing" : "active";
      await storage.updateSubscriptionFromStripe(local.userId, {
        tier,
        status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: local.stripePriceId ?? null,
        interval: sessionInterval,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: local.currentPeriodEnd ?? null,
        trialEndsAt: local.trialEndsAt ?? null,
      });
      return true;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as unknown as SubscriptionLike;
      const customerId = customerIdOf(sub.customer);
      if (!customerId) return false;
      const local = await storage.getSubscriptionByStripeCustomerId(customerId);
      if (!local) return false;
      const status = asStatus(sub.status, "active");
      const isLive = status === "active" || status === "trialing";
      const tierFromEvent = pickTierFromSubscription(sub);
      const tier: SubscriptionTier = !isLive
        ? "free"
        : tierFromEvent ?? (local.tier as SubscriptionTier);
      await storage.updateSubscriptionFromStripe(local.userId, {
        tier,
        status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: pickPriceId(sub),
        interval: pickInterval(sub) ?? (local.interval as "month" | "year" | null) ?? null,
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        currentPeriodEnd: pickPeriodEnd(sub),
        trialEndsAt: pickTrialEnd(sub),
      });
      return true;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as unknown as SubscriptionLike;
      const customerId = customerIdOf(sub.customer);
      if (!customerId) return false;
      const local = await storage.getSubscriptionByStripeCustomerId(customerId);
      if (!local) return false;
      await storage.updateSubscriptionFromStripe(local.userId, {
        tier: "free",
        status: "canceled",
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: pickPriceId(sub),
        interval: pickInterval(sub) ?? (local.interval as "month" | "year" | null) ?? null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: pickPeriodEnd(sub),
        trialEndsAt: null,
      });
      return true;
    }

    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = customerIdOf(invoice.customer);
      if (!customerId) return false;
      const local = await storage.getSubscriptionByStripeCustomerId(customerId);
      if (!local) return false;
      const status: SubscriptionStatus =
        event.type === "invoice.payment_succeeded" ? "active" : "past_due";
      await storage.updateSubscriptionFromStripe(local.userId, {
        tier: local.tier as SubscriptionTier,
        status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: local.stripeSubscriptionId ?? null,
        stripePriceId: local.stripePriceId ?? null,
        interval: (local.interval as "month" | "year" | null) ?? null,
        cancelAtPeriodEnd: Boolean(local.cancelAtPeriodEnd),
        currentPeriodEnd: local.currentPeriodEnd ?? null,
        trialEndsAt: local.trialEndsAt ?? null,
      });
      return true;
    }

    default:
      return false;
  }
}
