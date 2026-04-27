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

interface TierSpec {
  tier: "diy_pro" | "garage_pro" | "shop_pro";
  name: string;
  description: string;
  amountCents: number;
}

const TIERS: TierSpec[] = [
  {
    tier: "diy_pro",
    name: "TorqueShed DIY Pro",
    description:
      "Advanced diagnostic tree, unlimited saved cases, PDF repair plans, full parts checklist, similar solved matching.",
    amountCents: 999,
  },
  {
    tier: "garage_pro",
    name: "TorqueShed Garage Pro",
    description:
      "Everything in DIY Pro plus multi-vehicle, maintenance tracking, repair history, cost tracking, build logs, tool inventory.",
    amountCents: 2900,
  },
  {
    tier: "shop_pro",
    name: "TorqueShed Shop Pro",
    description:
      "Everything in Garage Pro plus public shop profile, service listings, lead capture, team access, customer summaries.",
    amountCents: 7900,
  },
];

async function ensureTier(spec: TierSpec) {
  const stripe = await getUncachableStripeClient();

  // Look for an existing active price tagged with metadata.tier === spec.tier
  let existingPrice: any = null;
  try {
    const search = await stripe.prices.search({
      query: `active:'true' AND metadata['tier']:'${spec.tier}'`,
      limit: 1,
    });
    existingPrice = search.data[0];
  } catch (err) {
    console.warn(`prices.search failed for ${spec.tier} — falling back to product search`, err);
  }

  if (existingPrice) {
    const product = typeof existingPrice.product === "string"
      ? existingPrice.product
      : existingPrice.product?.id;
    console.log(
      `[skip] ${spec.tier} already exists  product=${product}  price=${existingPrice.id}  amount=${existingPrice.unit_amount}`
    );
    return;
  }

  // Find or create the product
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

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: spec.amountCents,
    currency: "usd",
    recurring: { interval: "month" },
    metadata: { tier: spec.tier, app: "torqueshed" },
    nickname: `${spec.name} — Monthly`,
  });
  console.log(`[create] price ${price.id} ($${(spec.amountCents / 100).toFixed(2)}/mo) for ${spec.tier}`);
}

async function main() {
  console.log("Seeding TorqueShed Stripe products & prices...");
  for (const spec of TIERS) {
    try {
      await ensureTier(spec);
    } catch (err) {
      console.error(`Failed to seed ${spec.tier}:`, err);
    }
  }
  console.log("Done. Webhooks will sync these into the local stripe schema.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
