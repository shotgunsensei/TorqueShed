// DORMANT (task #68) — OperatorOS is the source of truth for plans/entitlements.
// Stripe is no longer used for access decisions. This file is preserved for
// data continuity (existing subscriptions table rows / historical webhooks)
// and may be removed in a future cleanup. Do not add new callers.
// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { insertSubscriptionSchema, type SubscriptionTier } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "../middleware/auth";
import { isStripeConfigured } from "../stripeClient";
import { getStripeClient, getPriceIdForTier, getBillingConfigStatus, probeStripe, PAID_TIERS, type PaidTier } from "../stripe";
import { createSubscriptionCheckoutSession, createBillingPortalSession, syncLocalSubscriptionForCustomer, isPaidTier } from "../stripeBilling";
import { tierLabel } from "../entitlements";
import { ensureStripeCustomerForUser, pickReturnBaseUrl, getReturnBaseUrl } from "./_shared";

export function register(app: Express): void {
  // Display-only price metadata. Real prices live in Stripe; these are for the
  // marketing labels on the subscription screen.
  const TIER_PRICE_MAP: Record<SubscriptionTier, { monthly: number; label: string }> = {
    free: { monthly: 0, label: "Free" },
    diy_pro: { monthly: 999, label: "DIY Pro" },
    garage_pro: { monthly: 2900, label: "Garage Pro" },
    shop_pro: { monthly: 7900, label: "Shop Pro" },
  };

  async function buildSubscriptionResponse(userId: string) {
    const sub = await storage.getSubscription(userId);
    const billing = getBillingConfigStatus();
    const tier = (sub?.tier as SubscriptionTier | undefined) ?? "free";
    const status = sub?.status ?? "active";
    const stripeConfigured = billing.allPricesConfigured;
    let stripeMode: "live" | "test" | "missing_config" = "missing_config";
    if (stripeConfigured) {
      try {
        const probe = await probeStripe();
        stripeMode = probe.reachable ? (probe.mode === "unknown" ? "test" : probe.mode) : "missing_config";
      } catch {
        stripeMode = "missing_config";
      }
    }
    const isBillingDelinquent = status === "past_due";
    return {
      tier,
      status,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
      latestInvoiceStatus: sub?.latestInvoiceStatus ?? null,
      paymentMethodLast4: sub?.paymentMethodLast4 ?? null,
      stripeConfigured,
      stripeMode,
      hasStripeCustomer: Boolean(sub?.stripeCustomerId),
      isBillingDelinquent,
      webhookConfigured: billing.webhookSecretConfigured,
      prices: TIER_PRICE_MAP,
      tierPriceIds: billing.priceIds,
    };
  }

  app.get("/api/subscription", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await buildSubscriptionResponse(req.userId!);
      const sub = await storage.getSubscription(req.userId!);
      res.json({
        ...data,
        hasStripeSubscription: Boolean(sub?.stripeSubscriptionId),
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ error: "Failed to load subscription" });
    }
  });

  // Legacy upgrade endpoint kept for "Downgrade to Free" only. Paid upgrades
  // now flow through /api/billing/create-checkout-session.
  app.post("/api/subscription/upgrade", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = insertSubscriptionSchema.parse(req.body);
      const parsedTier = parsed.tier;
      const stripeConfigured = isStripeConfigured();

      if (parsedTier === "free") {
        // Downgrade — instruct the user to cancel via the portal if they have a paid sub.
        const existing = await storage.getSubscription(req.userId!);
        if (existing?.stripeSubscriptionId && stripeConfigured) {
          const portal = await createBillingPortalSession({
            userId: req.userId!,
            returnUrl: `${getReturnBaseUrl(req)}/`,
          });
          return res.json({
            mode: "portal",
            portalUrl: portal.url,
            message: "Open the customer portal to cancel your subscription.",
          });
        }
        const sub = await storage.upsertSubscription(req.userId!, "free", "active");
        return res.json({ mode: "downgrade", tier: sub.tier, status: sub.status });
      }

      if (!stripeConfigured) {
        return res.status(503).json({
          error: "Stripe is not connected on this environment. Connect Stripe to enable paid upgrades.",
          stripeConfigured: false,
        });
      }

      if (!isPaidTier(parsedTier)) {
        return res.status(400).json({ error: "Unknown tier" });
      }

      const baseUrl = getReturnBaseUrl(req);
      const session = await createSubscriptionCheckoutSession({
        userId: req.userId!,
        tier: parsedTier,
        successUrl: `${baseUrl}/?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/?stripe=canceled`,
      });

      res.json({
        mode: "checkout",
        checkoutUrl: session.url,
        sessionId: session.sessionId,
        tier: parsedTier,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
      }
      const message = error instanceof Error ? error.message : "Failed to upgrade subscription";
      console.error("Error upgrading subscription:", error);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/billing/create-checkout-session", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tier = req.body?.tier as PaidTier | undefined;
      if (!tier || !PAID_TIERS.includes(tier)) {
        return res.status(400).json({ error: "Valid paid tier required (diy_pro, garage_pro, shop_pro)." });
      }
      const priceId = getPriceIdForTier(tier);
      if (!priceId) {
        return res.status(503).json({
          error: `Stripe price not configured for ${tierLabel(tier)}. Set ${tier === "diy_pro" ? "STRIPE_PRICE_DIY_PRO" : tier === "garage_pro" ? "STRIPE_PRICE_GARAGE_PRO" : "STRIPE_PRICE_SHOP_PRO"} on the server.`,
          missingConfig: true,
        });
      }

      // Prevent duplicate subscriptions: if the user already has an active or
      // trialing Stripe subscription, route plan changes through the Customer
      // Portal instead of creating a parallel subscription.
      const existingSub = await storage.getSubscription(req.userId!);
      const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
      if (
        existingSub?.stripeSubscriptionId &&
        existingSub.tier !== "free" &&
        ACTIVE_STATUSES.has(existingSub.status ?? "")
      ) {
        const customerId = await ensureStripeCustomerForUser(req.userId!);
        const stripe = await getStripeClient();
        const baseUrl = pickReturnBaseUrl(req);
        const portal = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${baseUrl}/?billing=portal_return`,
        });
        return res.json({
          url: portal.url,
          mode: "portal",
          reason: "has_active_subscription",
          message: "You already have an active subscription. Use the billing portal to switch plans.",
        });
      }

      const customerId = await ensureStripeCustomerForUser(req.userId!);
      const stripe = await getStripeClient();
      const baseUrl = pickReturnBaseUrl(req);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/?billing=success&tier=${tier}&stripe=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/?billing=cancelled`,
        allow_promotion_codes: false,
        metadata: { userId: req.userId!, tier },
        subscription_data: {
          metadata: { userId: req.userId!, tier },
        },
      });
      if (!session.url) {
        return res.status(502).json({ error: "Stripe did not return a checkout URL." });
      }
      res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      console.error("Error creating Stripe checkout session:", error);
      const message = error instanceof Error ? error.message : "Failed to start checkout";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/subscription/portal", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ error: "Stripe is not connected on this environment." });
      }
      const portal = await createBillingPortalSession({
        userId: req.userId!,
        returnUrl: `${getReturnBaseUrl(req)}/`,
      });
      res.json({ url: portal.url });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open billing portal";
      console.error("Error creating portal session:", error);
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/subscription/confirm", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }
      if (!isStripeConfigured()) {
        return res.status(503).json({ error: "Stripe is not connected on this environment." });
      }

      const stripe = await getStripeClient();
      let session;
      try {
        session = await stripe.checkout.sessions.retrieve(sessionId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not load Stripe session";
        return res.status(404).json({ error: message });
      }

      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer && typeof session.customer === "object"
            ? (session.customer as { id?: string }).id ?? null
            : null;

      const localSub = await storage.getSubscription(req.userId!);
      const sessionUserId =
        typeof session.metadata?.userId === "string" ? session.metadata.userId : null;

      // Verify ownership: require either matching metadata.userId or a known
      // local Stripe customer that matches the session's customer.
      const userIdMatches = sessionUserId === req.userId;
      const customerMatches = Boolean(
        customerId && localSub?.stripeCustomerId && localSub.stripeCustomerId === customerId
      );
      if (!userIdMatches && !customerMatches) {
        return res.status(403).json({ error: "This checkout session does not belong to you." });
      }

      let syncFailed = false;
      if (customerId) {
        try {
          await syncLocalSubscriptionForCustomer(customerId);
        } catch (err) {
          console.error("[stripe] confirm sync failed", err);
          syncFailed = true;
        }
      }

      const data = await buildSubscriptionResponse(req.userId!);
      const refreshed = await storage.getSubscription(req.userId!);
      const checkoutComplete =
        session.status === "complete" && session.payment_status === "paid";

      // If the user paid but our local tier hasn't updated yet (e.g. webhook
      // and sync both lagged), tell the client it's still pending so they can
      // surface that instead of an incorrect "subscription updated" toast.
      if (checkoutComplete && (syncFailed || data.tier === "free")) {
        return res.status(202).json({
          ...data,
          hasStripeSubscription: Boolean(refreshed?.stripeSubscriptionId),
          sessionStatus: session.status,
          paymentStatus: session.payment_status,
          pending: true,
          message:
            "Payment confirmed — your new plan is taking a moment to activate. Refresh in a few seconds.",
        });
      }

      res.json({
        ...data,
        hasStripeSubscription: Boolean(refreshed?.stripeSubscriptionId),
        sessionStatus: session.status,
        paymentStatus: session.payment_status,
        pending: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to confirm subscription";
      console.error("Error confirming subscription:", error);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/subscription/sync", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sub = await storage.getSubscription(req.userId!);
      if (sub?.stripeCustomerId) {
        await syncLocalSubscriptionForCustomer(sub.stripeCustomerId);
      }
      const refreshed = await storage.getSubscription(req.userId!);
      res.json({
        tier: refreshed?.tier ?? "free",
        status: refreshed?.status ?? "active",
        currentPeriodEnd: refreshed?.currentPeriodEnd ?? null,
      });
    } catch (error) {
      console.error("Error syncing subscription:", error);
      res.status(500).json({ error: "Failed to sync subscription" });
    }
  });

  app.post("/api/billing/create-portal-session", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sub = await storage.getSubscription(req.userId!);
      if (!sub?.stripeCustomerId) {
        return res.status(400).json({
          error: "No Stripe customer on file. Subscribe to a paid plan first.",
        });
      }
      const stripe = await getStripeClient();
      const baseUrl = pickReturnBaseUrl(req);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${baseUrl}/?billing=portal_return`,
      });
      res.json({ url: portal.url });
    } catch (error) {
      console.error("Error creating Stripe portal session:", error);
      const message = error instanceof Error ? error.message : "Failed to open billing portal";
      res.status(500).json({ error: message });
    }
  });


  // Admin-only health: confirms presence of every Stripe env var. Never echoes
  // the actual values.
  app.get("/api/admin/billing-health", requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const cfg = getBillingConfigStatus();
      const probe = await probeStripe();
      res.json({
        stripeReachable: probe.reachable,
        stripeMode: probe.mode,
        webhookSecretConfigured: cfg.webhookSecretConfigured,
        priceIdsPresent: {
          diy_pro: Boolean(cfg.priceIds.diy_pro),
          garage_pro: Boolean(cfg.priceIds.garage_pro),
          shop_pro: Boolean(cfg.priceIds.shop_pro),
        },
        portalReturnUrlConfigured: Boolean(cfg.portalReturnUrl),
        error: probe.error ?? null,
      });
    } catch (error) {
      console.error("Error checking billing health:", error);
      res.status(500).json({ error: "Failed to load billing health" });
    }
  });
}
