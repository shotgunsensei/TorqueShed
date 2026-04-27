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

const PRICE_ENV_KEYS: Record<PaidTier, string> = {
  diy_pro: "STRIPE_PRICE_DIY_PRO",
  garage_pro: "STRIPE_PRICE_GARAGE_PRO",
  shop_pro: "STRIPE_PRICE_SHOP_PRO",
};

export function getPriceIdForTier(tier: PaidTier): string | null {
  const v = process.env[PRICE_ENV_KEYS[tier]]?.trim();
  return v && v.length > 0 ? v : null;
}

export function getTierForPriceId(priceId: string): SubscriptionTier | null {
  for (const t of PAID_TIERS) {
    if (getPriceIdForTier(t) === priceId) return t;
  }
  return null;
}

export function getBillingConfigStatus() {
  const priceIds: Record<PaidTier, string | null> = {
    diy_pro: getPriceIdForTier("diy_pro"),
    garage_pro: getPriceIdForTier("garage_pro"),
    shop_pro: getPriceIdForTier("shop_pro"),
  };
  const allPricesConfigured = (Object.values(priceIds) as Array<string | null>).every((p) => Boolean(p));
  const webhookSecretConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const portalReturnUrl = process.env.STRIPE_BILLING_RETURN_URL?.trim() || null;
  return { priceIds, allPricesConfigured, webhookSecretConfigured, portalReturnUrl };
}
