// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { getUserTier, tierHasFeature } from "../entitlements";

export function register(app: Express): void {
  app.get("/api/vehicles/me/maintenance-due", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tier = await getUserTier(req.userId!);
      const hasFeature = tierHasFeature(tier, "maintenance_tracking");
      if (!hasFeature) {
        return res.json({ items: [], hasFeature: false, totalCount: 0 });
      }
      const items = await storage.getMaintenanceDueForUser(req.userId!);
      res.json({ items, hasFeature: true, totalCount: items.length });
    } catch (error) {
      console.error("Error loading maintenance due:", error);
      res.status(500).json({ error: "Failed to load maintenance" });
    }
  });
}
