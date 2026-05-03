/**
 * Resolve the public host that Stripe should deliver webhooks to.
 *
 * Precedence is deliberately Replit-first so the rotating dev hostname always
 * wins over any stale persisted overrides:
 *   1. REPLIT_DOMAINS[0]            (production deployment)
 *   2. REPLIT_DEV_DOMAIN            (current workspace hostname)
 *   3. STRIPE_WEBHOOK_PUBLIC_HOST   (explicit named override for non-Replit
 *                                    environments, e.g. local + ngrok)
 *   4. PUBLIC_BASE_URL              (legacy fallback only — never trusted on
 *                                    Replit because it is the exact value
 *                                    that goes stale on a hostname change)
 */
export function detectPublicWebhookHost(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const isProduction = env.REPLIT_DEPLOYMENT === "1";
  const prodHost = env.REPLIT_DOMAINS?.split(",")[0]?.trim() || null;
  const devHost = env.REPLIT_DEV_DOMAIN?.trim() || null;
  const onReplit = Boolean(prodHost || devHost);
  const explicitOverride = env.STRIPE_WEBHOOK_PUBLIC_HOST?.trim() || null;
  const legacyOverride = onReplit ? null : env.PUBLIC_BASE_URL?.trim() || null;

  if (isProduction && prodHost) return prodHost;
  if (devHost) return devHost;
  if (prodHost) return prodHost;
  if (explicitOverride) return explicitOverride;
  return legacyOverride;
}

export function detectPublicWebhookUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const host = detectPublicWebhookHost(env);
  if (!host) return null;
  return host.startsWith("http")
    ? `${host.replace(/\/$/, "")}/api/stripe/webhook`
    : `https://${host}/api/stripe/webhook`;
}
