import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage, type ProfileUpdate } from "./storage";
import { setupWebSocket, getGarageUserCount } from "./websocket";
import { 
  validateRequest, 
  checkRateLimit, 
  getCachedResponse, 
  cacheResponse, 
  generateTorqueAssistResponse 
} from "./torque-assist";
import { FOCUS_AREAS, type FocusArea } from "@shared/schema";

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

  app.get("/api/users/:id/profile", async (req: Request, res: Response) => {
    try {
      const profile = await storage.getPublicProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.patch("/api/users/:id/profile", async (req: Request, res: Response) => {
    try {
      const { bio, location, avatarUrl, focusAreas, vehiclesWorkedOn, yearsWrenching, shopAffiliation } = req.body;
      
      const updates: ProfileUpdate = {};
      
      if (bio !== undefined) {
        if (typeof bio !== "string" || bio.length > 500) {
          return res.status(400).json({ error: "Bio must be a string under 500 characters" });
        }
        updates.bio = bio;
      }
      
      if (location !== undefined) {
        if (typeof location !== "string" || location.length > 100) {
          return res.status(400).json({ error: "Location must be a string under 100 characters" });
        }
        updates.location = location;
      }
      
      if (avatarUrl !== undefined) {
        if (typeof avatarUrl !== "string") {
          return res.status(400).json({ error: "Avatar URL must be a string" });
        }
        updates.avatarUrl = avatarUrl;
      }
      
      if (focusAreas !== undefined) {
        if (!Array.isArray(focusAreas)) {
          return res.status(400).json({ error: "Focus areas must be an array" });
        }
        const validAreas = focusAreas.filter((area): area is FocusArea => 
          FOCUS_AREAS.includes(area as FocusArea)
        );
        if (validAreas.length !== focusAreas.length) {
          return res.status(400).json({ error: "Invalid focus area provided" });
        }
        updates.focusAreas = validAreas;
      }
      
      if (vehiclesWorkedOn !== undefined) {
        if (vehiclesWorkedOn !== null && (typeof vehiclesWorkedOn !== "string" || vehiclesWorkedOn.length > 1000)) {
          return res.status(400).json({ error: "Vehicles worked on must be a string under 1000 characters" });
        }
        updates.vehiclesWorkedOn = vehiclesWorkedOn || undefined;
      }
      
      if (yearsWrenching !== undefined) {
        if (yearsWrenching !== null && (typeof yearsWrenching !== "number" || yearsWrenching < 0 || yearsWrenching > 100)) {
          return res.status(400).json({ error: "Years wrenching must be a number between 0 and 100" });
        }
        updates.yearsWrenching = yearsWrenching;
      }
      
      if (shopAffiliation !== undefined) {
        if (shopAffiliation !== null && (typeof shopAffiliation !== "string" || shopAffiliation.length > 200)) {
          return res.status(400).json({ error: "Shop affiliation must be a string under 200 characters" });
        }
        updates.shopAffiliation = shopAffiliation;
      }
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid updates provided" });
      }
      
      const updated = await storage.updateUserProfile(req.params.id, updates);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const profile = await storage.getPublicProfile(req.params.id);
      res.json(profile);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
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
