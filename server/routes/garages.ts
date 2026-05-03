// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";

export function register(app: Express): void {
  app.get("/api/garages", async (req: Request, res: Response) => {
    try {
      const garages = await storage.getGarages();
      const userId = (req as AuthenticatedRequest).userId;
      if (userId) {
        const withMembership = await Promise.all(
          garages.map(async (g) => ({
            ...g,
            isJoined: await storage.isGarageMember(userId, g.id),
          }))
        );
        return res.json(withMembership);
      }
      res.json(garages.map((g) => ({ ...g, isJoined: false })));
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
      const userId = (req as AuthenticatedRequest).userId;
      const isJoined = userId ? await storage.isGarageMember(userId, req.params.id) : false;
      res.json({ ...garage, isJoined });
    } catch (error) {
      console.error("Error fetching garage:", error);
      res.status(500).json({ error: "Failed to fetch garage" });
    }
  });

  app.post("/api/garages/:id/join", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const garage = await storage.getGarage(req.params.id);
      if (!garage) return res.status(404).json({ error: "Garage not found" });
      await storage.joinGarage(req.userId!, req.params.id);
      res.json({ joined: true });
    } catch (error) {
      console.error("Error joining garage:", error);
      res.status(500).json({ error: "Failed to join garage" });
    }
  });

  app.delete("/api/garages/:id/join", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.leaveGarage(req.userId!, req.params.id);
      res.json({ joined: false });
    } catch (error) {
      console.error("Error leaving garage:", error);
      res.status(500).json({ error: "Failed to leave garage" });
    }
  });

  app.get("/api/garages/:garageId/top-contributors", async (req: Request, res: Response) => {
    try {
      const contributors = await storage.getTopContributors(req.params.garageId);
      res.json(contributors);
    } catch (error) {
      console.error("Error fetching top contributors:", error);
      res.status(500).json({ error: "Failed to fetch top contributors" });
    }
  });
}
