/**
 * Seed TorqueShed subscription tiers (DIY Pro / Garage Pro / Shop Pro)
 * as recurring monthly products in Stripe.
 *
 * Run with: npx tsx scripts/seed-stripe-tiers.ts
 *
 * Idempotent — products are looked up by metadata.tier and created only if missing.
 * Webhooks managed by stripe-replit-sync will sync them into the local stripe schema.
 */
import "dotenv/config";
import { getUncachableStripeClient } from "../server/stripeClient";

type Interval = "month" | "year";

interface TierSpec {
  tier: "diy_pro" | "garage_pro" | "shop_pro";
  name: string;
  description: string;
  monthlyCents: number;
  annualCents: number;
}

const TIERS: TierSpec[] = [
  {
    tier: "diy_pro",
    name: "TorqueShed DIY Pro",
    description:
      "Advanced diagnostic tree, unlimited saved cases, PDF repair plans, full parts checklist, similar solved matching.",
    monthlyCents: 999,
    annualCents: 9900,
  },
  {
    tier: "garage_pro",
    name: "TorqueShed Garage Pro",
    description:
      "Everything in DIY Pro plus multi-vehicle, maintenance tracking, repair history, cost tracking, build logs, tool inventory.",
    monthlyCents: 2900,
    annualCents: 29000,
  },
  {
    tier: "shop_pro",
    name: "TorqueShed Shop Pro",
    description:
      "Everything in Garage Pro plus public shop profile, service listings, lead capture, team access, customer summaries.",
    monthlyCents: 7900,
    annualCents: 79000,
  },
];

async function ensureProduct(spec: TierSpec) {
  const stripe = await getUncachableStripeClient();
  let product: any = null;
  try {
    const products = await stripe.products.search({
      query: `active:'true' AND metadata['tier']:'${spec.tier}'`,
      limit: 1,
    });
    product = products.data[0] ?? null;
  } catch {}

  if (!product) {
    product = await stripe.products.create({
      name: spec.name,
      description: spec.description,
      metadata: { tier: spec.tier, app: "torqueshed" },
    });
    console.log(`[create] product ${product.id} (${spec.name})`);
  } else {
    console.log(`[reuse] product ${product.id} (${spec.name})`);
  }
  return product;
}

async function ensurePrice(spec: TierSpec, interval: Interval, product: any) {
  const stripe = await getUncachableStripeClient();
  const amount = interval === "month" ? spec.monthlyCents : spec.annualCents;

  // Idempotent: look for an active price tagged with our tier + interval.
  let existing: any = null;
  try {
    const search = await stripe.prices.search({
      query: `active:'true' AND metadata['tier']:'${spec.tier}' AND metadata['interval']:'${interval}'`,
      limit: 1,
    });
    existing = search.data[0];
  } catch (err) {
    console.warn(`prices.search failed for ${spec.tier}/${interval}`, err);
  }

  if (existing) {
    console.log(
      `[skip] ${spec.tier} ${interval} price exists  price=${existing.id}  amount=${existing.unit_amount}`,
    );
    return;
  }

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amount,
    currency: "usd",
    recurring: { interval },
    metadata: { tier: spec.tier, app: "torqueshed", interval },
    nickname: `${spec.name} — ${interval === "month" ? "Monthly" : "Annual"}`,
  });
  console.log(
    `[create] price ${price.id} ($${(amount / 100).toFixed(2)}/${interval === "month" ? "mo" : "yr"}) for ${spec.tier}`,
  );
}

async function ensureTier(spec: TierSpec) {
  const product = await ensureProduct(spec);
  await ensurePrice(spec, "month", product);
  await ensurePrice(spec, "year", product);
}

async function main() {
  console.log("Seeding TorqueShed Stripe products & prices (monthly + annual)...");
  for (const spec of TIERS) {
    try {
      await ensureTier(spec);
    } catch (err) {
      console.error(`Failed to seed ${spec.tier}:`, err);
    }
  }
  console.log(
    "Done. Set STRIPE_PRICE_<TIER> and STRIPE_PRICE_<TIER>_ANNUAL env vars to the printed price IDs.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
