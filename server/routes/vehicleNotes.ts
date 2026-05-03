// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { insertVehicleNoteSchema, updateVehicleNoteSchema } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { getUserTier, tierHasFeature, userHasFeature } from "../entitlements";

export function register(app: Express): void {
  // ========== Vehicle Notes Routes ==========
  app.get("/api/vehicles/:vehicleId/notes", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const vehicle = await storage.getVehicle(req.params.vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      if (vehicle.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const notes = await storage.getNotesByVehicle(req.params.vehicleId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.get("/api/notes/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      if (note.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json(note);
    } catch (error) {
      console.error("Error fetching note:", error);
      res.status(500).json({ error: "Failed to fetch note" });
    }
  });

  app.post("/api/vehicles/:vehicleId/notes", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const vehicle = await storage.getVehicle(req.params.vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      if (vehicle.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const tier = await getUserTier(req.userId!);
      const canTrackMaintenance = tierHasFeature(tier, "maintenance_tracking");

      const parsed = insertVehicleNoteSchema.parse({
        vehicleId: req.params.vehicleId,
        title: req.body.title?.trim(),
        content: req.body.content?.trim(),
        type: req.body.type || "general",
        cost: req.body.cost || null,
        mileage: req.body.mileage ? Number(req.body.mileage) : null,
        partsUsed: req.body.partsUsed || null,
        beforeState: req.body.beforeState?.trim() || null,
        afterState: req.body.afterState?.trim() || null,
        nextDueMileage: canTrackMaintenance && req.body.nextDueMileage ? Number(req.body.nextDueMileage) : null,
        nextDueDate: canTrackMaintenance && req.body.nextDueDate ? req.body.nextDueDate : null,
        isPrivate: req.body.isPrivate !== false,
      });

      const note = await storage.createNote(parsed, req.userId!);

      res.status(201).json(note);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error creating note:", error);
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.patch("/api/notes/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      if (note.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const parsed = updateVehicleNoteSchema.parse(req.body);
      const updates: Record<string, unknown> = {};
      if (parsed.title !== undefined) updates.title = parsed.title;
      if (parsed.content !== undefined) updates.content = parsed.content;
      if (parsed.type !== undefined) updates.type = parsed.type;
      if (parsed.cost !== undefined) updates.cost = parsed.cost;
      if (parsed.mileage !== undefined) updates.mileage = parsed.mileage;
      if (parsed.partsUsed !== undefined) updates.partsUsed = parsed.partsUsed;
      if (parsed.beforeState !== undefined) updates.beforeState = parsed.beforeState;
      if (parsed.afterState !== undefined) updates.afterState = parsed.afterState;
      if (parsed.isPrivate !== undefined) updates.isPrivate = parsed.isPrivate;

      const wantsMaintenanceFields =
        parsed.nextDueMileage !== undefined || parsed.nextDueDate !== undefined;
      if (wantsMaintenanceFields) {
        if (!(await userHasFeature(req.userId!, "maintenance_tracking"))) {
          return res.status(402).json({
            error: "Maintenance tracking is a Garage Pro feature.",
            upgradeRequired: true,
            feature: "maintenance_tracking",
          });
        }
        if (parsed.nextDueMileage !== undefined) updates.nextDueMileage = parsed.nextDueMileage;
        if (parsed.nextDueDate !== undefined) updates.nextDueDate = parsed.nextDueDate;
      }

      const updated = await storage.updateNote(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error updating note:", error);
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  app.delete("/api/notes/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      if (note.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.deleteNote(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(500).json({ error: "Failed to delete note" });
    }
  });
}
