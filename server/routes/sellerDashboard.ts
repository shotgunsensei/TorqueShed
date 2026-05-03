// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { type SubscriptionTier } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";

export function register(app: Express): void {
  app.get("/api/seller-dashboard", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const dash = await storage.getSellerDashboard(req.userId!);
      const sub = await storage.getSubscription(req.userId!);
      const tier = (sub?.tier as SubscriptionTier | undefined) ?? "free";
      const FREE_LISTING_LIMIT = 3;
      res.json({
        profile: dash.profile,
        activeListings: dash.activeListings,
        drafts: dash.draftListings,
        attachedCasesCount: dash.attachedCaseCount,
        tier,
        listingLimit: tier === "free" ? FREE_LISTING_LIMIT : null,
        atLimit: tier === "free" && dash.activeListings.length >= FREE_LISTING_LIMIT,
      });
    } catch (error) {
      console.error("Error fetching seller dashboard:", error);
      res.status(500).json({ error: "Failed to load seller dashboard" });
    }
  });
}
