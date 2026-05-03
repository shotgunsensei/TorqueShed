// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { updateShopProfileSchema } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { requireFeature } from "../entitlements";

export function register(app: Express): void {
  app.get(
    "/api/shop-profile/me",
    requireAuth,
    requireFeature("shop_profile"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getSellerProfile(req.userId!);
        const credibility = await storage.getShopCredibility(req.userId!);
        res.json({ profile: profile ?? null, credibility });
      } catch (error) {
        console.error("Error fetching shop profile:", error);
        res.status(500).json({ error: "Failed to load shop profile" });
      }
    },
  );

  app.put(
    "/api/shop-profile/me",
    requireAuth,
    requireFeature("shop_profile"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = updateShopProfileSchema.parse(req.body);
        if (parsed.slug) {
          const available = await storage.isSlugAvailable(parsed.slug, req.userId!);
          if (!available) {
            return res.status(409).json({ error: "That slug is already taken." });
          }
        }
        const saved = await storage.upsertShopFields(req.userId!, parsed);
        res.json(saved);
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
        }
        console.error("Error saving shop profile:", error);
        res.status(500).json({ error: "Failed to save shop profile" });
      }
    },
  );
}
