// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { insertShopServiceSchema, updateShopServiceSchema } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { requireFeature } from "../entitlements";

export function register(app: Express): void {
  app.get(
    "/api/shop-services",
    requireAuth,
    requireFeature("service_listings"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const items = await storage.listShopServices(req.userId!);
        res.json(items);
      } catch (error) {
        console.error("Error listing shop services:", error);
        res.status(500).json({ error: "Failed to load services" });
      }
    },
  );

  app.post(
    "/api/shop-services",
    requireAuth,
    requireFeature("service_listings"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = insertShopServiceSchema.parse(req.body);
        const created = await storage.createShopService(req.userId!, parsed);
        res.status(201).json(created);
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
        }
        console.error("Error creating shop service:", error);
        res.status(500).json({ error: "Failed to create service" });
      }
    },
  );

  app.patch(
    "/api/shop-services/:id",
    requireAuth,
    requireFeature("service_listings"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const existing = await storage.getShopService(req.params.id);
        if (!existing) return res.status(404).json({ error: "Service not found" });
        if (existing.ownerUserId !== req.userId) return res.status(403).json({ error: "Not your service" });
        const parsed = updateShopServiceSchema.parse(req.body);
        const updated = await storage.updateShopService(req.params.id, parsed);
        res.json(updated);
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
        }
        console.error("Error updating shop service:", error);
        res.status(500).json({ error: "Failed to update service" });
      }
    },
  );

  app.delete(
    "/api/shop-services/:id",
    requireAuth,
    requireFeature("service_listings"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const existing = await storage.getShopService(req.params.id);
        if (!existing) return res.status(404).json({ error: "Service not found" });
        if (existing.ownerUserId !== req.userId) return res.status(403).json({ error: "Not your service" });
        await storage.deleteShopService(req.params.id);
        res.json({ ok: true });
      } catch (error) {
        console.error("Error deleting shop service:", error);
        res.status(500).json({ error: "Failed to delete service" });
      }
    },
  );
}
