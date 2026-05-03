// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";

export function register(app: Express): void {
  // ========== Object Storage / File Upload Routes ==========
  app.post("/api/objects/upload", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const kindRaw = (req.body?.kind as string | undefined) || "image";
      const kind = kindRaw === "video" ? "video" : "image";
      const svc = new ObjectStorageService();
      const { uploadUrl, objectPath } = await svc.getUploadUrl(kind, req.userId);
      res.json({ uploadUrl, objectPath });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req: Request, res: Response) => {
    try {
      const svc = new ObjectStorageService();
      const file = await svc.getObjectEntityFile(`/objects/${req.params.objectPath}`);
      await svc.downloadObject(file, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Not found" });
      }
      console.error("Error serving object:", error);
      if (!res.headersSent) res.status(500).json({ error: "Failed to serve object" });
    }
  });

  app.get("/public-objects/:filePath(*)", async (req: Request, res: Response) => {
    try {
      const svc = new ObjectStorageService();
      const file = await svc.searchPublicObject(req.params.filePath);
      if (!file) return res.status(404).json({ error: "Not found" });
      await svc.downloadObject(file, res);
    } catch (error) {
      console.error("Error serving public object:", error);
      if (!res.headersSent) res.status(500).json({ error: "Failed to serve object" });
    }
  });
}
