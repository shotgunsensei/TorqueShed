// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { insertSellerProfileSchema } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";

export function register(app: Express): void {
  app.get("/api/seller-profile/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const profile = await storage.getSellerProfile(req.userId!);
      res.json(profile ?? null);
    } catch (error) {
      console.error("Error fetching seller profile:", error);
      res.status(500).json({ error: "Failed to load seller profile" });
    }
  });

  app.put("/api/seller-profile/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = insertSellerProfileSchema.parse(req.body);
      const saved = await storage.upsertSellerProfile(req.userId!, {
        displayName: parsed.displayName.trim(),
        sellerType: parsed.sellerType,
        bio: parsed.bio?.trim() || null,
        location: parsed.location?.trim() || null,
      });
      res.json(saved);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
      }
      console.error("Error saving seller profile:", error);
      res.status(500).json({ error: "Failed to save seller profile" });
    }
  });
}
