// DORMANT (task #68) — OperatorOS is the source of truth for plans/entitlements.
// Stripe is no longer used for access decisions. This file is preserved for
// data continuity (existing subscriptions table rows / historical webhooks)
// and may be removed in a future cleanup. Do not add new callers.
// Stripe client for billing.
//
// Credentials are pulled from the Replit Stripe connector
// (connection:conn_stripe_*). When the connector is unavailable or env vars
// are missing we throw a stable error so callers can return a structured
// upgrade/billing-config response instead of crashing.
import Stripe from "stripe";
import type { SubscriptionTier } from "@shared/schema";

let connectionSettings: { settings?: { secret?: string; publishable?: string } } | null = null;

async function getCredentials(): Promise<{ secretKey: string; publishableKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error("Stripe connector unavailable (missing REPLIT_CONNECTORS_HOSTNAME or REPL identity).");
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Replit-Token": xReplitToken,
    },
  });
  const data = (await response.json()) as { items?: Array<{ settings?: { secret?: string; publishable?: string } }> };
  connectionSettings = data.items?.[0] ?? null;
  const secretKey = connectionSettings?.settings?.secret;
  const publishableKey = connectionSettings?.settings?.publishable;
  if (!secretKey || !publishableKey) {
    throw new Error(`Stripe ${targetEnvironment} connection not configured.`);
  }
  return { secretKey, publishableKey };
}

// Never cache the client; always fetch a fresh one to avoid stale credentials.
export async function getStripeClient(): Promise<Stripe> {
  const fromEnv = process.env.STRIPE_SECRET_KEY?.trim();
  if (fromEnv) {
    return new Stripe(fromEnv, { apiVersion: "2026-02-25.clover" });
  }
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
}

export async function getStripePublishableKey(): Promise<string> {
  const envKey = process.env.STRIPE_PUBLISHABLE_KEY?.trim();
  if (envKey) return envKey;
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

// Quick health probe — does not throw, returns whether we can talk to Stripe at all.
export async function probeStripe(): Promise<{ reachable: boolean; mode: "live" | "test" | "unknown"; error?: string }> {
  try {
    const fromEnv = process.env.STRIPE_SECRET_KEY?.trim();
    const key = fromEnv ?? (await getCredentials()).secretKey;
    const mode: "live" | "test" | "unknown" = key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : "unknown";
    const client = new Stripe(key, { apiVersion: "2026-02-25.clover" });
    // Tiny call — list 1 product to confirm credentials work.
    await client.products.list({ limit: 1 });
    return { reachable: true, mode };
  } catch (err) {
    return { reachable: false, mode: "unknown", error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------- Tier <-> Stripe price mapping ----------------

export const PAID_TIERS = ["diy_pro", "garage_pro", "shop_pro"] as const;
export type PaidTier = typeof PAID_TIERS[number];

export type BillingInterval = "month" | "year";

const PRICE_ENV_KEYS: Record<PaidTier, Record<BillingInterval, string>> = {
  diy_pro: { month: "STRIPE_PRICE_DIY_PRO", year: "STRIPE_PRICE_DIY_PRO_ANNUAL" },
  garage_pro: { month: "STRIPE_PRICE_GARAGE_PRO", year: "STRIPE_PRICE_GARAGE_PRO_ANNUAL" },
  shop_pro: { month: "STRIPE_PRICE_SHOP_PRO", year: "STRIPE_PRICE_SHOP_PRO_ANNUAL" },
};

export function getPriceIdForTier(tier: PaidTier, interval: BillingInterval = "month"): string | null {
  const v = process.env[PRICE_ENV_KEYS[tier][interval]]?.trim();
  return v && v.length > 0 ? v : null;
}

export function getTierForPriceId(priceId: string): { tier: SubscriptionTier; interval: BillingInterval } | null {
  for (const t of PAID_TIERS) {
    if (getPriceIdForTier(t, "month") === priceId) return { tier: t, interval: "month" };
    if (getPriceIdForTier(t, "year") === priceId) return { tier: t, interval: "year" };
  }
  return null;
}

export function getBillingConfigStatus() {
  const priceIds: Record<PaidTier, { month: string | null; year: string | null }> = {
    diy_pro: { month: getPriceIdForTier("diy_pro", "month"), year: getPriceIdForTier("diy_pro", "year") },
    garage_pro: { month: getPriceIdForTier("garage_pro", "month"), year: getPriceIdForTier("garage_pro", "year") },
    shop_pro: { month: getPriceIdForTier("shop_pro", "month"), year: getPriceIdForTier("shop_pro", "year") },
  };
  // Annual prices are optional from a "live billing works" standpoint — monthly
  // is still the baseline that gates the missing_config banner.
  const allPricesConfigured = (Object.values(priceIds)).every((p) => Boolean(p.month));
  const allAnnualPricesConfigured = (Object.values(priceIds)).every((p) => Boolean(p.year));
  const webhookSecretConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const portalReturnUrl = process.env.STRIPE_BILLING_RETURN_URL?.trim() || null;
  return { priceIds, allPricesConfigured, allAnnualPricesConfigured, webhookSecretConfigured, portalReturnUrl };
}
