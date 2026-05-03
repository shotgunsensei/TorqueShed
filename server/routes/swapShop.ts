// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { insertSwapShopListingSchema, updateSwapShopListingSchema } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, optionalAuth, type AuthenticatedRequest } from "../middleware/auth";
import { ObjectStorageService } from "../objectStorage";
import { getUserTier, tierHasFeature } from "../entitlements";
import { isObjectStillReferenced } from "./_shared";

export function register(app: Express): void {
  app.get("/api/swap-shop", async (_req: Request, res: Response) => {
    try {
      const listings = await storage.getSwapShopListings();
      res.json(listings);
    } catch (error) {
      console.error("Error fetching swap shop listings:", error);
      res.status(500).json({ error: "Failed to fetch listings" });
    }
  });

  app.get("/api/swap-shop/my-listings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const listings = await storage.getUserSwapShopListings(req.userId!);
      res.json(listings);
    } catch (error) {
      console.error("Error fetching user listings:", error);
      res.status(500).json({ error: "Failed to fetch listings" });
    }
  });

  app.get("/api/swap-shop/:id", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const listing = await storage.getSwapShopListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (listing.isDraft) {
        const viewerId = req.userId;
        const isOwner = viewerId && viewerId === listing.userId;
        let isAdmin = false;
        if (viewerId) {
          const viewer = await storage.getUser(viewerId);
          isAdmin = viewer?.role === "admin";
        }
        if (!isOwner && !isAdmin) {
          return res.status(404).json({ error: "Listing not found" });
        }
      }
      res.json(listing);
    } catch (error) {
      console.error("Error fetching listing:", error);
      res.status(500).json({ error: "Failed to fetch listing" });
    }
  });

  app.post("/api/swap-shop", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tier = await getUserTier(req.userId!);
      const hasAdvanced = tierHasFeature(tier, "advanced_listing_options");

      const FREE_LISTING_LIMIT = 3;
      if (tier === "free") {
        const existing = await storage.getActiveListingsByUser(req.userId!);
        if (existing.length >= FREE_LISTING_LIMIT) {
          return res.status(402).json({
            error: `Free tier is limited to ${FREE_LISTING_LIMIT} active listings. Upgrade to Garage Pro for unlimited listings.`,
            upgradeRequired: true,
            feature: "advanced_listing_options",
            currentTier: tier,
            requiredTier: "garage_pro",
            requiredTierLabel: "Garage Pro",
          });
        }
      }

      let attachedCaseId: string | null = req.body.attachedCaseId || null;
      if (attachedCaseId) {
        const attachedThread = await storage.getThread(attachedCaseId);
        if (!attachedThread || attachedThread.userId !== req.userId) {
          return res.status(403).json({ error: "You can only attach listings to your own cases." });
        }
      }

      const objectStorageService = new ObjectStorageService();
      const normalizeImage = (raw: string | null | undefined): string | null => {
        if (!raw || typeof raw !== "string" || !raw.trim()) return null;
        try {
          return objectStorageService.normalizeObjectEntityPath(raw);
        } catch {
          return raw;
        }
      };

      const normalizedImageUrl = normalizeImage(req.body.imageUrl);
      const rawExtras: string[] = hasAdvanced && Array.isArray(req.body.extraImageUrls)
        ? req.body.extraImageUrls.filter((u: unknown) => typeof u === "string" && u.trim().length > 0).slice(0, 8)
        : [];
      const normalizedExtras: string[] = [];
      for (const raw of rawExtras) {
        const norm = normalizeImage(raw);
        if (norm) normalizedExtras.push(norm);
      }

      const parsed = insertSwapShopListingSchema.parse({
        title: req.body.title?.trim(),
        description: req.body.description || null,
        price: req.body.price?.trim(),
        condition: req.body.condition,
        location: req.body.location || null,
        localPickup: req.body.localPickup !== false,
        willShip: req.body.willShip === true,
        imageUrl: normalizedImageUrl,
        extraImageUrls: normalizedExtras,
        contactMethod: hasAdvanced ? (req.body.contactMethod || null) : null,
        isDraft: hasAdvanced ? req.body.isDraft === true : false,
        category: req.body.category || "parts",
        attachedCaseId,
      });

      const listing = await storage.createSwapShopListing(parsed, req.userId!);

      res.status(201).json(listing);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error creating listing:", error);
      res.status(500).json({ error: "Failed to create listing" });
    }
  });

  app.patch("/api/swap-shop/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const listing = await storage.getSwapShopListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (listing.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const tier = await getUserTier(req.userId!);
      const hasAdvanced = tierHasFeature(tier, "advanced_listing_options");

      const parsed = updateSwapShopListingSchema.parse(req.body);
      const objectStorageService = new ObjectStorageService();
      const normalizeImage = (raw: string | null | undefined): string | null => {
        if (!raw || typeof raw !== "string" || !raw.trim()) return null;
        try {
          return objectStorageService.normalizeObjectEntityPath(raw);
        } catch {
          return raw;
        }
      };

      const updates: Record<string, unknown> = {};
      if (parsed.title !== undefined) updates.title = parsed.title;
      if (parsed.description !== undefined) updates.description = parsed.description;
      if (parsed.price !== undefined) updates.price = parsed.price;
      if (parsed.condition !== undefined) updates.condition = parsed.condition;
      if (parsed.location !== undefined) updates.location = parsed.location;
      if (parsed.localPickup !== undefined) updates.localPickup = parsed.localPickup;
      if (parsed.willShip !== undefined) updates.willShip = parsed.willShip;
      if (parsed.imageUrl !== undefined) updates.imageUrl = normalizeImage(parsed.imageUrl);
      if (parsed.isActive !== undefined) updates.isActive = parsed.isActive;
      if (parsed.category !== undefined) updates.category = parsed.category;
      if (parsed.attachedCaseId !== undefined) {
        if (parsed.attachedCaseId) {
          const attachedThread = await storage.getThread(parsed.attachedCaseId);
          if (!attachedThread || attachedThread.userId !== req.userId) {
            return res.status(403).json({ error: "You can only attach listings to your own cases." });
          }
        }
        updates.attachedCaseId = parsed.attachedCaseId;
      }
      if (hasAdvanced) {
        if (parsed.extraImageUrls !== undefined) {
          const filtered = parsed.extraImageUrls.filter((u) => typeof u === "string" && u.trim().length > 0).slice(0, 8);
          const normalized: string[] = [];
          for (const raw of filtered) {
            const norm = normalizeImage(raw);
            if (norm) normalized.push(norm);
          }
          updates.extraImageUrls = normalized;
        }
        if (parsed.contactMethod !== undefined) updates.contactMethod = parsed.contactMethod;
        if (parsed.isDraft !== undefined) updates.isDraft = parsed.isDraft;
      }

      const updated = await storage.updateSwapShopListing(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error updating listing:", error);
      res.status(500).json({ error: "Failed to update listing" });
    }
  });

  app.delete("/api/swap-shop/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const listing = await storage.getSwapShopListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (listing.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.deleteSwapShopListing(req.params.id);

      try {
        const objectSvc = new ObjectStorageService();
        const items: Array<{ url: string | null | undefined; ownerUserId: string | null | undefined }> = [
          { url: listing.imageUrl, ownerUserId: listing.userId },
          ...((listing.extraImageUrls ?? []).map((url) => ({ url, ownerUserId: listing.userId }))),
        ];
        await objectSvc.deleteOwnedObjects(items, {
          isStillReferenced: (url) => isObjectStillReferenced(url),
        });
      } catch (cleanupErr) {
        console.error("Error cleaning up listing objects:", cleanupErr);
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting listing:", error);
      res.status(500).json({ error: "Failed to delete listing" });
    }
  });
}
