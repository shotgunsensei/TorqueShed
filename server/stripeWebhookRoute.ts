import express from "express";
import type { Request, Response } from "express";
import type Stripe from "stripe";
import { storage } from "./storage";
import { WebhookHandlers } from "./webhookHandlers";
import { applyStripeEvent } from "./webhookEventHandlers";

export { applyStripeEvent };

export async function handleExpertEscalationEvent(payload: Buffer): Promise<void> {
  let event: Stripe.Event;
  try {
    event = JSON.parse(payload.toString("utf8")) as Stripe.Event;
  } catch {
    return;
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.expired" &&
    event.type !== "checkout.session.async_payment_failed"
  ) {
    return;
  }

  const session = event.data?.object as Stripe.Checkout.Session | undefined;
  if (!session || session.metadata?.kind !== "expert_escalation") return;

  const reviewId = session.metadata?.reviewId;
  if (!reviewId) return;

  try {
    if (event.type === "checkout.session.completed") {
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
      await storage.markExpertReviewPaid(reviewId, paymentIntentId);
    } else {
      await storage.markExpertReviewFailed(reviewId);
    }
  } catch (err) {
    console.error(
      `[stripe] Failed handling expert-escalation event ${event.type} for review ${reviewId}:`,
      err,
    );
  }
}

export function setupStripeWebhook(app: express.Application): void {
  // CRITICAL: this route must be registered BEFORE express.json() so the body
  // arrives as a raw Buffer for Stripe signature verification.
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const signature = req.headers["stripe-signature"];
      if (!signature) {
        return res.status(400).json({ error: "Missing stripe-signature header" });
      }
      const sig = Array.isArray(signature) ? signature[0] : signature;

      try {
        if (!Buffer.isBuffer(req.body)) {
          console.error(
            "STRIPE WEBHOOK ERROR: req.body is not a Buffer. " +
              "express.json() likely ran before this route. " +
              "Ensure setupStripeWebhook() is called BEFORE setupBodyParsing().",
          );
          return res.status(500).json({ error: "Webhook processing error" });
        }

        const buf = req.body as Buffer;
        // 1) Verify signature + sync stripe.* schema (managed by stripe-replit-sync).
        await WebhookHandlers.processWebhook(buf, sig);

        // 2) Parse the verified event and apply it to our local subscriptions
        //    table via storage.updateSubscriptionFromStripe. This is the single
        //    source of truth that promotes/demotes the user's tier.
        let parsed: Stripe.Event | null = null;
        try {
          parsed = JSON.parse(buf.toString("utf8")) as Stripe.Event;
        } catch (err) {
          console.error("[stripe] failed to parse webhook payload:", err);
        }
        if (parsed) {
          try {
            await applyStripeEvent(parsed);
          } catch (err) {
            console.error("[stripe] applyStripeEvent failed:", err);
          }
        }

        // 3) One-time expert-escalation checkouts aren't subscriptions; handle
        //    them separately.
        await handleExpertEscalationEvent(buf);

        res.status(200).json({ received: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "unknown";
        console.error("Stripe webhook error:", message);
        res.status(400).json({ error: "Webhook processing error" });
      }
    },
  );
  console.log("Stripe webhook route registered at /api/stripe/webhook");
}
