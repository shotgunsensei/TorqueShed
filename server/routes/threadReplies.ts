// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { insertThreadReplySchema } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { ObjectStorageService } from "../objectStorage";

export function register(app: Express): void {
  app.get("/api/threads/:threadId/replies", async (req: Request, res: Response) => {
    try {
      const replies = await storage.getRepliesByThread(req.params.threadId);
      res.json(replies);
    } catch (error) {
      console.error("Error fetching replies:", error);
      res.status(500).json({ error: "Failed to fetch replies" });
    }
  });

  app.post("/api/threads/:threadId/replies", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const objectSvc = new ObjectStorageService();
      const normalizeList = (arr: unknown): string[] | null => {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        return arr
          .filter((u): u is string => typeof u === "string" && u.length > 0)
          .map((u) => objectSvc.normalizeObjectEntityPath(u));
      };

      const parsed = insertThreadReplySchema.parse({
        threadId: req.params.threadId,
        content: req.body.content?.trim(),
        replyType: req.body.replyType || undefined,
        photoUrls: normalizeList(req.body.photoUrls),
        videoUrls: normalizeList(req.body.videoUrls),
      });

      const reply = await storage.createThreadReply(parsed, req.userId!);

      res.status(201).json(reply);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error creating reply:", error);
      res.status(500).json({ error: "Failed to create reply" });
    }
  });
}
