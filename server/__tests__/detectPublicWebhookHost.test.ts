/**
 * Verification for the Stripe-webhook host selection used at startup by
 * reconcileStripeManagedWebhook(). Domain-change resilience hinges entirely on
 * picking the *current* Replit hostname rather than any persisted/legacy value
 * that may still point at a dead workspace URL.
 *
 * Run with:  npx tsx server/__tests__/detectPublicWebhookHost.test.ts
 */
import assert from "node:assert/strict";
import { detectPublicWebhookHost } from "../stripeWebhookUrl";

type Env = NodeJS.ProcessEnv;
const env = (overrides: Record<string, string | undefined>): Env =>
  overrides as unknown as Env;

// 1. Workspace dev hostname change: legacy PUBLIC_BASE_URL points at a dead
//    domain, but REPLIT_DEV_DOMAIN holds the live one — the live one must win.
assert.equal(
  detectPublicWebhookHost(
    env({
      REPLIT_DEV_DOMAIN: "fresh-host.janeway.replit.dev",
      PUBLIC_BASE_URL: "https://stale-host.janeway.replit.dev",
    }),
  ),
  "fresh-host.janeway.replit.dev",
  "stale PUBLIC_BASE_URL must not override the live REPLIT_DEV_DOMAIN",
);

// 2. Production deployment always anchors on REPLIT_DOMAINS[0], even if
//    REPLIT_DEV_DOMAIN is also present (e.g. ephemeral preview env).
assert.equal(
  detectPublicWebhookHost(
    env({
      REPLIT_DEPLOYMENT: "1",
      REPLIT_DOMAINS: "torqueshed.pro,www.torqueshed.pro",
      REPLIT_DEV_DOMAIN: "fresh-host.janeway.replit.dev",
      PUBLIC_BASE_URL: "https://stale.example.com",
    }),
  ),
  "torqueshed.pro",
  "production must use REPLIT_DOMAINS[0]",
);

// 3. Explicit named override wins for non-Replit local dev (e.g. ngrok).
assert.equal(
  detectPublicWebhookHost(
    env({
      STRIPE_WEBHOOK_PUBLIC_HOST: "https://my-tunnel.ngrok.app",
    }),
  ),
  "https://my-tunnel.ngrok.app",
  "STRIPE_WEBHOOK_PUBLIC_HOST should win when no Replit envs are set",
);

// 4. Legacy PUBLIC_BASE_URL is honoured only when nothing else is configured.
assert.equal(
  detectPublicWebhookHost(env({ PUBLIC_BASE_URL: "https://legacy.example.com" })),
  "https://legacy.example.com",
  "PUBLIC_BASE_URL is the last-resort fallback off-Replit",
);

// 5. Nothing configured → null (caller skips reconciliation).
assert.equal(detectPublicWebhookHost(env({})), null, "empty env yields null");

console.log("detectPublicWebhookHost: 5/5 checks passed");
