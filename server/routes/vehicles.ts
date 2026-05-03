// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { insertVehicleSchema, updateVehicleSchema } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { getUserTier, tierHasFeature, minimumTierFor, tierLabel } from "../entitlements";

export function register(app: Express): void {
  app.get("/api/vehicles", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const vehiclesList = await storage.getVehiclesByUser(req.userId!);
      res.json(vehiclesList);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  app.get("/api/vehicles/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      if (vehicle.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json(vehicle);
    } catch (error) {
      console.error("Error fetching vehicle:", error);
      res.status(500).json({ error: "Failed to fetch vehicle" });
    }
  });

  app.post("/api/vehicles", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tier = await getUserTier(req.userId!);
      if (!tierHasFeature(tier, "multi_vehicle")) {
        const existing = await storage.getVehiclesByUser(req.userId!);
        if (existing.length >= 1) {
          const required = minimumTierFor("multi_vehicle");
          return res.status(402).json({
            error: `Adding more than one vehicle requires ${tierLabel(required)} or higher.`,
            upgradeRequired: true,
            feature: "multi_vehicle",
            currentTier: tier,
            requiredTier: required,
            requiredTierLabel: tierLabel(required),
          });
        }
      }

      const parsed = insertVehicleSchema.parse({
        vin: req.body.vin || null,
        year: req.body.year ? parseInt(req.body.year) : null,
        make: req.body.make || null,
        model: req.body.model || null,
        nickname: req.body.nickname?.trim(),
        imageUrl: req.body.imageUrl || null,
        isPublic: req.body.isPublic === true,
      });

      const vehicle = await storage.createVehicle(parsed, req.userId!);

      res.status(201).json(vehicle);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error creating vehicle:", error);
      res.status(500).json({ error: "Failed to create vehicle" });
    }
  });

  app.patch("/api/vehicles/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      if (vehicle.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const parsed = updateVehicleSchema.parse(req.body);
      const updates: Record<string, unknown> = {};
      if (parsed.vin !== undefined) updates.vin = parsed.vin;
      if (parsed.year !== undefined) updates.year = parsed.year;
      if (parsed.make !== undefined) updates.make = parsed.make;
      if (parsed.model !== undefined) updates.model = parsed.model;
      if (parsed.nickname !== undefined) updates.nickname = parsed.nickname;
      if (parsed.imageUrl !== undefined) updates.imageUrl = parsed.imageUrl;
      if (parsed.isPublic !== undefined) updates.isPublic = parsed.isPublic;

      const updated = await storage.updateVehicle(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error updating vehicle:", error);
      res.status(500).json({ error: "Failed to update vehicle" });
    }
  });

  app.delete("/api/vehicles/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      if (vehicle.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.deleteVehicle(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      res.status(500).json({ error: "Failed to delete vehicle" });
    }
  });
}
