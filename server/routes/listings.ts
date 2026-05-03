// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";

export function register(app: Express): void {
  app.get("/api/listings/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const listings = await storage.getListingsByUser(req.userId!);
      res.json(listings);
    } catch (error) {
      console.error("Error fetching my listings:", error);
      res.status(500).json({ error: "Failed to load listings" });
    }
  });
}
