// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { optionalAuth, type AuthenticatedRequest } from "../middleware/auth";
import { getContextRecommendations, summarizeCostRange } from "../case-recommendations";
import { getUserTier, tierHasFeature } from "../entitlements";

export function register(app: Express): void {
  app.get("/api/cases/:caseId/recommendations", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.caseId);
      if (!thread) return res.status(404).json({ error: "Case not found" });

      const tier = await getUserTier(req.userId ?? null);
      const fullChecklist = tierHasFeature(tier, "full_parts_checklist");

      const seeded = getContextRecommendations({
        obdCodes: thread.obdCodes,
        systemCategory: thread.systemCategory,
        symptoms: thread.symptoms,
        title: thread.title,
      });

      const userListings = await storage.getListingsForCase(req.params.caseId);
      const toClient = (r: typeof seeded[number]) => ({
        title: r.title,
        reason: r.description,
        affiliateUrl: r.url,
        estimatedPrice: r.estimatedPrice,
        fitmentNote: r.fitmentNote,
        type: r.type,
        category: r.category,
      });

      const requiredTools = seeded.filter((r) => r.category === "required_tool").map(toClient);
      const optionalTools = seeded.filter((r) => r.category === "optional_tool").map(toClient);
      const likelyParts = seeded.filter((r) => r.category === "likely_part").map(toClient);
      const consumables = seeded.filter((r) => r.category === "consumable").map(toClient);
      const safetyEquipment = seeded.filter((r) => r.category === "safety_equipment").map(toClient);

      const FREE_LIMITS = { optionalTools: 1, likelyParts: 2, consumables: 1 } as const;

      res.json({
        requiredTools,
        optionalTools: fullChecklist ? optionalTools : optionalTools.slice(0, FREE_LIMITS.optionalTools),
        likelyParts: fullChecklist ? likelyParts : likelyParts.slice(0, FREE_LIMITS.likelyParts),
        consumables: fullChecklist ? consumables : consumables.slice(0, FREE_LIMITS.consumables),
        safetyEquipment,
        marketplaceListings: userListings.map((l) => ({
          id: l.id,
          title: l.title,
          price: l.price,
          category: l.category ?? "parts",
        })),
        totalCostRange: summarizeCostRange(seeded),
        affiliateNote: "Affiliate links shown when available. Always verify fitment by VIN before purchase.",
        hiddenCounts: fullChecklist ? null : {
          optionalTools: Math.max(0, optionalTools.length - FREE_LIMITS.optionalTools),
          likelyParts: Math.max(0, likelyParts.length - FREE_LIMITS.likelyParts),
          consumables: Math.max(0, consumables.length - FREE_LIMITS.consumables),
        },
        fullChecklist,
        tier,
      });
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ error: "Failed to load recommendations" });
    }
  });
}
