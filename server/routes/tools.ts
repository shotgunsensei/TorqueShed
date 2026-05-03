// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { insertToolSchema, updateToolSchema } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { requireFeature } from "../entitlements";

export function register(app: Express): void {
  app.get("/api/tools", requireAuth, requireFeature("tool_inventory"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const list = await storage.getToolsByUser(req.userId!);
      res.json(list);
    } catch (error) {
      console.error("Error loading tools:", error);
      res.status(500).json({ error: "Failed to load tools" });
    }
  });

  app.post("/api/tools", requireAuth, requireFeature("tool_inventory"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = insertToolSchema.parse(req.body);
      const created = await storage.createTool(parsed, req.userId!);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
      }
      console.error("Error creating tool:", error);
      res.status(500).json({ error: "Failed to create tool" });
    }
  });

  app.patch("/api/tools/:id", requireAuth, requireFeature("tool_inventory"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tool = await storage.getTool(req.params.id);
      if (!tool) return res.status(404).json({ error: "Tool not found" });
      if (tool.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
      const parsed = updateToolSchema.parse(req.body);
      const updated = await storage.updateTool(req.params.id, parsed);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
      }
      console.error("Error updating tool:", error);
      res.status(500).json({ error: "Failed to update tool" });
    }
  });

  app.delete("/api/tools/:id", requireAuth, requireFeature("tool_inventory"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tool = await storage.getTool(req.params.id);
      if (!tool) return res.status(404).json({ error: "Tool not found" });
      if (tool.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
      await storage.deleteTool(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tool:", error);
      res.status(500).json({ error: "Failed to delete tool" });
    }
  });
}
