// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";

export function register(app: Express): void {
  app.get("/api/diagnostic-sessions", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessions = await storage.getDiagnosticSessions(req.userId!);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching diagnostic sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.get("/api/diagnostic-sessions/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const session = await storage.getDiagnosticSession(req.params.id);
      if (!session || session.userId !== req.userId!) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error fetching diagnostic session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  app.post("/api/diagnostic-sessions", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const session = await storage.createDiagnosticSession(req.userId!, req.body);
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating diagnostic session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  app.put("/api/diagnostic-sessions/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await storage.getDiagnosticSession(req.params.id);
      if (!existing || existing.userId !== req.userId!) {
        return res.status(404).json({ error: "Session not found" });
      }
      const updated = await storage.updateDiagnosticSession(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating diagnostic session:", error);
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.delete("/api/diagnostic-sessions/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await storage.getDiagnosticSession(req.params.id);
      if (!existing || existing.userId !== req.userId!) {
        return res.status(404).json({ error: "Session not found" });
      }
      await storage.deleteDiagnosticSession(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting diagnostic session:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });
}
