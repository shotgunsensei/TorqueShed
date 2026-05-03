// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { escalateCaseSchema, type ExpertServiceLevel } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { isUserBillingDelinquent } from "../entitlements";
import { getStripeClient } from "../stripe";
import { ensureStripeCustomerForUser, pickReturnBaseUrl } from "./_shared";

const EXPERT_PRICE_CENTS: Record<ExpertServiceLevel, number> = {
  quick_review: 1500,
  full_diagnostic: 3900,
  live_remote: 9900,
};

const EXPERT_SERVICE_NAMES: Record<string, string> = {
  quick_review: "Quick Review (Expert)",
  full_diagnostic: "Full Diagnostic (Expert)",
  live_remote: "Live Remote Session (Expert)",
};

export function register(app: Express): void {
  app.post("/api/cases/:caseId/escalate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Block delinquent users from creating new paid escalations.
      if (await isUserBillingDelinquent(req.userId!)) {
        return res.status(402).json({
          error: "Your most recent payment failed. Update your billing to request a new expert review.",
          billingPastDue: true,
        });
      }

      const thread = await storage.getThread(req.params.caseId);
      if (!thread) return res.status(404).json({ error: "Case not found" });

      const parsed = escalateCaseSchema.parse(req.body);
      const priceCents = EXPERT_PRICE_CENTS[parsed.serviceLevel];

      // Create the review row in pending state. The webhook flips it to "paid"
      // once Stripe confirms the one-time charge via checkout.session.completed.
      const review = await storage.createExpertReview(
        req.params.caseId,
        req.userId!,
        parsed.serviceLevel,
        parsed.userNotes?.trim() || null,
        priceCents,
      );

      // Try to start a Stripe Checkout (mode: 'payment') for the one-time
      // charge. If Stripe isn't configured, surface that to the client so it
      // can show an honest "billing not configured" message instead of pretending.
      try {
        const stripe = await getStripeClient();
        const customerId = await ensureStripeCustomerForUser(req.userId!);
        const baseUrl = pickReturnBaseUrl(req);
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer: customerId,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: priceCents,
                product_data: {
                  name: EXPERT_SERVICE_NAMES[parsed.serviceLevel] ?? "Expert Review",
                  description: `Case ${req.params.caseId.slice(0, 8)} · ${parsed.serviceLevel}`,
                },
              },
            },
          ],
          success_url: `${baseUrl}/?escalation=success&reviewId=${review.id}`,
          cancel_url: `${baseUrl}/?escalation=cancelled&reviewId=${review.id}`,
          metadata: {
            kind: "expert_escalation",
            reviewId: review.id,
            caseId: req.params.caseId,
            userId: req.userId!,
            serviceLevel: parsed.serviceLevel,
          },
          payment_intent_data: {
            metadata: {
              kind: "expert_escalation",
              reviewId: review.id,
              caseId: req.params.caseId,
              userId: req.userId!,
            },
          },
        });
        if (session.url) {
          await storage.setExpertReviewStripeSession(review.id, session.id);
          return res.json({ review, checkoutUrl: session.url });
        }
        return res.status(502).json({ error: "Stripe did not return a checkout URL." });
      } catch (stripeErr) {
        const message = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
        // Roll back: leave the review in pending; it has no Stripe session attached.
        return res.status(503).json({
          error: "Live billing is not configured for expert escalations yet.",
          missingConfig: true,
          detail: message,
          reviewId: review.id,
        });
      }
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
      }
      console.error("Error escalating case:", error);
      res.status(500).json({ error: "Failed to escalate case" });
    }
  });

  app.get("/api/cases/:caseId/escalations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reviews = await storage.getExpertReviewsByCase(req.params.caseId);
      const own = reviews.filter((r) => r.userId === req.userId);
      res.json(own);
    } catch (error) {
      console.error("Error fetching escalations:", error);
      res.status(500).json({ error: "Failed to load escalations" });
    }
  });
}
