// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { requireFeature } from "../entitlements";

const sanitizeCaseToolLink = (link: { id: string; caseId: string; toolId: string; attachedBy: string; createdAt: Date | null; tool: { id: string; name: string; brand: string | null; category: string } | null }) => ({
  id: link.id,
  caseId: link.caseId,
  toolId: link.toolId,
  attachedBy: link.attachedBy,
  createdAt: link.createdAt,
  tool: link.tool
    ? { id: link.tool.id, name: link.tool.name, brand: link.tool.brand, category: link.tool.category }
    : null,
});

export function register(app: Express): void {
  app.get("/api/cases/:caseId/tools-used", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.caseId);
      if (!thread) return res.status(404).json({ error: "Case not found" });
      if (thread.userId !== req.userId) {
        return res.status(403).json({ error: "Only the case author can view attached tools." });
      }
      const items = await storage.getToolsUsedForCase(req.params.caseId);
      res.json(items.map(sanitizeCaseToolLink));
    } catch (error) {
      console.error("Error listing case tools:", error);
      res.status(500).json({ error: "Failed to list tools used" });
    }
  });

  app.post("/api/cases/:caseId/tools-used", requireAuth, requireFeature("tool_inventory"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.caseId);
      if (!thread) return res.status(404).json({ error: "Case not found" });
      if (thread.userId !== req.userId) return res.status(403).json({ error: "Only the case author can attach tools." });

      const toolId = typeof req.body.toolId === "string" ? req.body.toolId : null;
      if (!toolId) return res.status(400).json({ error: "toolId is required" });

      const tool = await storage.getTool(toolId);
      if (!tool || tool.userId !== req.userId) {
        return res.status(403).json({ error: "Tool not found in your inventory." });
      }

      const existing = await storage.getToolsUsedForCase(req.params.caseId);
      if (existing.some((l) => l.toolId === toolId)) {
        return res.status(409).json({ error: "This tool is already attached to this case." });
      }

      const created = await storage.attachToolToCase(req.params.caseId, toolId, req.userId!);
      res.status(201).json({
        id: created.id,
        caseId: created.caseId,
        toolId: created.toolId,
        attachedBy: created.attachedBy,
        createdAt: created.createdAt,
      });
    } catch (error) {
      console.error("Error attaching tool:", error);
      res.status(500).json({ error: "Failed to attach tool" });
    }
  });

  app.delete("/api/cases/:caseId/tools-used/:linkId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const link = await storage.getCaseToolUsed(req.params.linkId);
      if (!link) return res.status(404).json({ error: "Attachment not found" });
      if (link.caseId !== req.params.caseId) return res.status(404).json({ error: "Attachment not found" });
      if (link.attachedBy !== req.userId) return res.status(403).json({ error: "Not authorized" });
      await storage.detachToolFromCase(req.params.linkId);
      res.status(204).end();
    } catch (error) {
      console.error("Error detaching tool:", error);
      res.status(500).json({ error: "Failed to detach tool" });
    }
  });
}
