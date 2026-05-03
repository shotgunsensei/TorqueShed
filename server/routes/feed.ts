// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { db } from "../db";
import { garageMembers, threads, swapShopListings } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export function register(app: Express): void {
  // ========== Feed Routes ==========
  app.get("/api/feed", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const user = await storage.getUser(userId);
      const userGoals: string[] = user?.onboardingGoals ?? [];

      const userVehicles = await storage.getVehiclesByUser(userId);

      const memberRows = await db
        .select({ garageId: garageMembers.garageId })
        .from(garageMembers)
        .where(eq(garageMembers.userId, userId));
      const joinedGarageIds = memberRows.map((r) => r.garageId);

      type ThreadWithUser = Awaited<ReturnType<typeof storage.getThreadsByGarage>>[number];
      let bayThreads: ThreadWithUser[] = [];
      if (joinedGarageIds.length > 0) {
        const allThreads = await Promise.all(
          joinedGarageIds.map((gid) => storage.getThreadsByGarage(gid))
        );
        bayThreads = allThreads
          .flat()
          .sort((a, b) => {
            const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
            const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
            return bTime - aTime;
          })
          .slice(0, 10);
      }

      const vehicleMakes = userVehicles
        .map((v) => v.make?.toLowerCase())
        .filter(Boolean) as string[];

      let garageThreads: ThreadWithUser[] = [];
      if (vehicleMakes.length > 0) {
        const makeToGarageId: Record<string, string> = {
          ford: "ford",
          chevrolet: "chevy",
          chevy: "chevy",
          dodge: "dodge",
          ram: "dodge",
          jeep: "jeep",
        };
        const relevantGarageIds = [...new Set(
          vehicleMakes
            .map((m) => makeToGarageId[m] || "general")
        )];
        const relThreads = await Promise.all(
          relevantGarageIds.map((gid) => storage.getThreadsByGarage(gid))
        );
        garageThreads = relThreads
          .flat()
          .filter((t) => t.hasSolution)
          .sort((a, b) => {
            const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
            const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
            return bTime - aTime;
          })
          .slice(0, 6);
      }

      const allListings = await storage.getSwapShopListings();
      let recentListings;
      if (vehicleMakes.length > 0) {
        const makePatterns = vehicleMakes.map((m) => m.toLowerCase());
        const matched = allListings.filter((l) => {
          const text = `${l.title} ${l.description || ""}`.toLowerCase();
          return makePatterns.some((m) => text.includes(m));
        });
        recentListings = matched.length > 0 ? matched.slice(0, 8) : allListings.slice(0, 8);
      } else {
        recentListings = allListings.slice(0, 8);
      }

      res.json({
        vehicles: userVehicles,
        bayThreads,
        garageThreads,
        recentListings,
        joinedGarageIds,
        onboardingGoals: userGoals,
      });
    } catch (error) {
      console.error("Error fetching feed:", error);
      res.status(500).json({ error: "Failed to fetch feed" });
    }
  });

  app.get("/api/feed/solved-this-week", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const userVehicles = await storage.getVehiclesByUser(userId);
      const vehicleMakes = userVehicles
        .map((v) => v.make?.toLowerCase())
        .filter(Boolean) as string[];

      const makeToGarageId: Record<string, string> = {
        ford: "ford", chevrolet: "chevy", chevy: "chevy",
        dodge: "dodge", ram: "dodge", jeep: "jeep",
      };

      const memberRows = await db
        .select({ garageId: garageMembers.garageId })
        .from(garageMembers)
        .where(eq(garageMembers.userId, userId));
      const joinedIds = memberRows.map((r) => r.garageId);

      const relevantIds = [...new Set([
        ...joinedIds,
        ...vehicleMakes.map((m) => makeToGarageId[m] || "general"),
      ])];

      if (relevantIds.length === 0) {
        return res.json([]);
      }

      const allThreads = await Promise.all(
        relevantIds.map((gid) => storage.getThreadsByGarage(gid))
      );

      const solvedThisWeek = allThreads
        .flat()
        .filter((t) => t.hasSolution && t.lastActivityAt && new Date(t.lastActivityAt) >= oneWeekAgo)
        .sort((a, b) => new Date(b.lastActivityAt!).getTime() - new Date(a.lastActivityAt!).getTime())
        .slice(0, 6);

      res.json(solvedThisWeek);
    } catch (error) {
      console.error("Error fetching solved-this-week:", error);
      res.status(500).json({ error: "Failed to fetch solved threads" });
    }
  });

  app.get("/api/feed/recommended-bays", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const userVehicles = await storage.getVehiclesByUser(userId);
      const vehicleMakes = userVehicles
        .map((v) => v.make?.toLowerCase())
        .filter(Boolean) as string[];

      const memberRows = await db
        .select({ garageId: garageMembers.garageId })
        .from(garageMembers)
        .where(eq(garageMembers.userId, userId));
      const joinedIds = new Set(memberRows.map((r) => r.garageId));

      const allGarages = await storage.getGarages();

      const makeToGarageId: Record<string, string> = {
        ford: "ford", chevrolet: "chevy", chevy: "chevy",
        dodge: "dodge", ram: "dodge", jeep: "jeep",
      };

      const relevantGarageIds = new Set(
        vehicleMakes.map((m) => makeToGarageId[m] || "general")
      );

      const relevantNotJoined = allGarages.filter((g) => !joinedIds.has(g.id) && relevantGarageIds.has(g.id));
      const otherNotJoined = allGarages.filter((g) => !joinedIds.has(g.id) && !relevantGarageIds.has(g.id));
      const recommended = [...relevantNotJoined, ...otherNotJoined].slice(0, 5);

      res.json(recommended);
    } catch (error) {
      console.error("Error fetching recommended bays:", error);
      res.status(500).json({ error: "Failed to fetch recommended bays" });
    }
  });

  app.get("/api/feed/continue-activity", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const userThreads = await db
        .select({
          id: threads.id,
          title: threads.title,
          garageId: threads.garageId,
          hasSolution: threads.hasSolution,
          replyCount: threads.replyCount,
          lastActivityAt: threads.lastActivityAt,
          createdAt: threads.createdAt,
          photoUrls: threads.photoUrls,
        })
        .from(threads)
        .where(and(eq(threads.userId, userId), eq(threads.hasSolution, false)))
        .orderBy(desc(threads.lastActivityAt))
        .limit(5);

      const userListings = await db
        .select({
          id: swapShopListings.id,
          title: swapShopListings.title,
          price: swapShopListings.price,
          condition: swapShopListings.condition,
          isActive: swapShopListings.isActive,
          createdAt: swapShopListings.createdAt,
          imageUrl: swapShopListings.imageUrl,
          extraImageUrls: swapShopListings.extraImageUrls,
        })
        .from(swapShopListings)
        .where(and(eq(swapShopListings.userId, userId), eq(swapShopListings.isActive, true)))
        .orderBy(desc(swapShopListings.createdAt))
        .limit(3);

      res.json({
        unresolvedThreads: userThreads,
        activeListings: userListings,
      });
    } catch (error) {
      console.error("Error fetching continue-activity:", error);
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  app.get("/api/vehicles/:id/cost-summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
      if (vehicle.userId !== req.userId) return res.status(403).json({ error: "Not authorized" });

      const notes = await storage.getNotesByVehicle(req.params.id);
      let totalCost = 0;
      const costByType: Record<string, number> = {};

      for (const note of notes) {
        if (note.cost) {
          const parsed = parseFloat(note.cost.replace(/[^0-9.]/g, ""));
          if (!isNaN(parsed)) {
            totalCost += parsed;
            const type = note.type || "general";
            costByType[type] = (costByType[type] || 0) + parsed;
          }
        }
      }

      res.json({
        totalCost,
        costByType,
        noteCount: notes.length,
      });
    } catch (error) {
      console.error("Error fetching cost summary:", error);
      res.status(500).json({ error: "Failed to fetch cost summary" });
    }
  });
}
