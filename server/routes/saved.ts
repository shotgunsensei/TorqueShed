// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { db } from "../db";
import { savedThreads, savedListings, threads, swapShopListings } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { getUserTier, tierHasFeature, minimumTierFor, tierLabel } from "../entitlements";
import { FREE_SAVED_THREAD_LIMIT } from "./_shared";

export function register(app: Express): void {
  app.post("/api/saved/threads/:threadId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.threadId);
      if (!thread) return res.status(404).json({ error: "Thread not found" });

      const userId = req.userId!;
      const tier = await getUserTier(userId);
      if (!tierHasFeature(tier, "unlimited_saved_cases")) {
        const alreadySaved = await storage.isThreadSavedByUser(userId, req.params.threadId);
        if (!alreadySaved) {
          const count = await storage.countSavedThreadsForUser(userId);
          if (count >= FREE_SAVED_THREAD_LIMIT) {
            const required = minimumTierFor("unlimited_saved_cases");
            return res.status(402).json({
              error: `Free accounts can save up to ${FREE_SAVED_THREAD_LIMIT} cases. Upgrade to ${tierLabel(required)} for unlimited saves.`,
              upgradeRequired: true,
              feature: "unlimited_saved_cases",
              currentTier: tier,
              requiredTier: required,
              requiredTierLabel: tierLabel(required),
              limit: FREE_SAVED_THREAD_LIMIT,
              currentCount: count,
            });
          }
        }
      }

      await db.insert(savedThreads).values({
        userId,
        threadId: req.params.threadId,
      }).onConflictDoNothing();

      res.json({ saved: true });
    } catch (error) {
      console.error("Error saving thread:", error);
      res.status(500).json({ error: "Failed to save thread" });
    }
  });

  app.delete("/api/saved/threads/:threadId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await db.delete(savedThreads).where(
        and(eq(savedThreads.userId, req.userId!), eq(savedThreads.threadId, req.params.threadId))
      );
      res.json({ saved: false });
    } catch (error) {
      console.error("Error unsaving thread:", error);
      res.status(500).json({ error: "Failed to unsave thread" });
    }
  });

  app.post("/api/saved/listings/:listingId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const listing = await storage.getSwapShopListing(req.params.listingId);
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      await db.insert(savedListings).values({
        userId: req.userId!,
        listingId: req.params.listingId,
      }).onConflictDoNothing();

      res.json({ saved: true });
    } catch (error) {
      console.error("Error saving listing:", error);
      res.status(500).json({ error: "Failed to save listing" });
    }
  });

  app.delete("/api/saved/listings/:listingId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await db.delete(savedListings).where(
        and(eq(savedListings.userId, req.userId!), eq(savedListings.listingId, req.params.listingId))
      );
      res.json({ saved: false });
    } catch (error) {
      console.error("Error unsaving listing:", error);
      res.status(500).json({ error: "Failed to unsave listing" });
    }
  });

  app.get("/api/saved", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const savedThreadRows = await db
        .select({
          threadId: savedThreads.threadId,
          savedAt: savedThreads.savedAt,
          title: threads.title,
          garageId: threads.garageId,
          hasSolution: threads.hasSolution,
          replyCount: threads.replyCount,
          createdAt: threads.createdAt,
        })
        .from(savedThreads)
        .innerJoin(threads, eq(savedThreads.threadId, threads.id))
        .where(eq(savedThreads.userId, userId))
        .orderBy(desc(savedThreads.savedAt));

      const savedListingRows = await db
        .select({
          listingId: savedListings.listingId,
          savedAt: savedListings.savedAt,
          title: swapShopListings.title,
          price: swapShopListings.price,
          condition: swapShopListings.condition,
          isActive: swapShopListings.isActive,
          createdAt: swapShopListings.createdAt,
        })
        .from(savedListings)
        .innerJoin(swapShopListings, eq(savedListings.listingId, swapShopListings.id))
        .where(eq(savedListings.userId, userId))
        .orderBy(desc(savedListings.savedAt));

      res.json({ threads: savedThreadRows, listings: savedListingRows });
    } catch (error) {
      console.error("Error fetching saved items:", error);
      res.status(500).json({ error: "Failed to fetch saved items" });
    }
  });

  app.get("/api/saved/thread-ids", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const rows = await db
        .select({ threadId: savedThreads.threadId })
        .from(savedThreads)
        .where(eq(savedThreads.userId, req.userId!));
      res.json(rows.map((r) => r.threadId));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch saved thread IDs" });
    }
  });

  app.get("/api/saved/listing-ids", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const rows = await db
        .select({ listingId: savedListings.listingId })
        .from(savedListings)
        .where(eq(savedListings.userId, req.userId!));
      res.json(rows.map((r) => r.listingId));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch saved listing IDs" });
    }
  });
}
