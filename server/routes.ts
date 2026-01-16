import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { setupWebSocket, getGarageUserCount } from "./websocket";
import { 
  validateRequest, 
  checkRateLimit, 
  getCachedResponse, 
  cacheResponse, 
  generateTorqueAssistResponse 
} from "./torque-assist";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/garages", async (_req: Request, res: Response) => {
    try {
      const garages = await storage.getGarages();
      const garagesWithActiveCount = garages.map(garage => ({
        ...garage,
        activeNow: getGarageUserCount(garage.id),
      }));
      res.json(garagesWithActiveCount);
    } catch (error) {
      console.error("Error fetching garages:", error);
      res.status(500).json({ error: "Failed to fetch garages" });
    }
  });

  app.get("/api/garages/:id", async (req: Request, res: Response) => {
    try {
      const garage = await storage.getGarage(req.params.id);
      if (!garage) {
        return res.status(404).json({ error: "Garage not found" });
      }
      res.json({
        ...garage,
        activeNow: getGarageUserCount(garage.id),
      });
    } catch (error) {
      console.error("Error fetching garage:", error);
      res.status(500).json({ error: "Failed to fetch garage" });
    }
  });

  app.get("/api/garages/:id/messages", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const before = req.query.before as string | undefined;
      
      const messages = await storage.getChatMessages(req.params.id, limit, before);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/garages/:id/messages", async (req: Request, res: Response) => {
    try {
      const { userId, content } = req.body;
      
      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ error: "Message content is required" });
      }

      const message = await storage.createChatMessage({
        garageId: req.params.id,
        userId: userId || null,
        content: content.trim(),
      });
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  app.post("/api/reports", async (req: Request, res: Response) => {
    try {
      const { reporterId, reportedUserId, contentType, contentId, reason, details } = req.body;
      
      if (!contentType || !reason) {
        return res.status(400).json({ error: "Content type and reason are required" });
      }

      const validContentTypes = ["chat_message", "forum_thread", "forum_reply", "user"];
      if (!validContentTypes.includes(contentType)) {
        return res.status(400).json({ error: "Invalid content type" });
      }

      const validReasons = ["spam", "harassment", "scam", "illegal", "impersonation", "other"];
      if (!validReasons.includes(reason)) {
        return res.status(400).json({ error: "Invalid reason" });
      }

      const report = await storage.createReport({
        reporterId: reporterId || null,
        reportedUserId: reportedUserId || null,
        contentType,
        contentId: contentId || null,
        reason,
        details: details || null,
      });
      
      res.status(201).json(report);
    } catch (error) {
      console.error("Error creating report:", error);
      res.status(500).json({ error: "Failed to create report" });
    }
  });

  app.post("/api/torque-assist", async (req: Request, res: Response) => {
    try {
      const clientId = req.ip || "unknown";
      
      if (!checkRateLimit(clientId)) {
        return res.status(429).json({ 
          error: { 
            code: "RATE_LIMITED", 
            message: "Too many requests. Please wait a moment before trying again." 
          } 
        });
      }
      
      const validation = validateRequest(req.body);
      
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      
      const cached = getCachedResponse(validation.data);
      if (cached) {
        return res.json(cached);
      }
      
      const response = generateTorqueAssistResponse(validation.data);
      cacheResponse(validation.data, response);
      
      res.json(response);
    } catch (error) {
      console.error("Error in TorqueAssist:", error);
      res.status(500).json({ 
        error: { 
          code: "INTERNAL_ERROR", 
          message: "An error occurred processing your request" 
        } 
      });
    }
  });

  const httpServer = createServer(app);
  
  setupWebSocket(httpServer);

  return httpServer;
}
