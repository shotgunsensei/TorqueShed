import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import bcrypt from "bcrypt";
import { ZodError } from "zod";
import { storage, type ProfileUpdate } from "./storage";
import { 
  checkRateLimitAsync, 
  getCachedResponse, 
  cacheResponse, 
  generateTorqueAssistResponse 
} from "./torque-assist";
import { torqueAssistRequestSchema } from "@shared/torque-assist";
import { 
  signupSchema,
  loginSchema,
  createReportSchema,
  updateProfileSchema,
  insertThreadSchema,
  insertThreadReplySchema,
  insertSwapShopListingSchema,
  insertVehicleNoteSchema,
  insertVehicleSchema,
  insertProductSchema,
  updateVehicleSchema,
  updateVehicleNoteSchema,
  updateThreadSchema,
  updateThreadStatusSchema,
  markSolvedSchema,
  updateSwapShopListingSchema,
  updateProductSchema,
  insertSubscriptionSchema,
  insertSellerProfileSchema,
  escalateCaseSchema,
  type SellerProfile,
  type ShopService,
  insertToolSchema,
  updateToolSchema,
  updateShopProfileSchema,
  insertShopServiceSchema,
  updateShopServiceSchema,
  createShopLeadSchema,
  inviteTeamMemberSchema,
  upsertCustomerSummarySchema,
  SUBSCRIPTION_TIERS,
  EXPERT_SERVICE_LEVELS,
  type SubscriptionTier,
  type ExpertServiceLevel,
} from "@shared/schema";
import { requireAuth, requireAdmin, optionalAuth, signJWT, type AuthenticatedRequest } from "./middleware/auth";
import { db } from "./db";
import { users, garageMembers, threads, garages, vehicles, vehicleNotes, swapShopListings, savedThreads, savedListings, threadReplies, reports } from "@shared/schema";
import { eq, and, gte, desc, sql, ilike, or } from "drizzle-orm";
import { getContextRecommendations, summarizeCostRange } from "./case-recommendations";
import { getUserTier, tierHasFeature, userHasFeature, minimumTierFor, tierLabel, requireFeature } from "./entitlements";
import PDFDocument from "pdfkit";

const BCRYPT_ROUNDS = 12;

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const { username, password } = signupSchema.parse(req.body);

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ 
          error: "Conflict", 
          message: "Username already exists" 
        });
      }

      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
      
      const user = await storage.createUser({
        username: username.trim(),
        passwordHash: hashedPassword,
      });

      const token = signJWT({ sub: user.id, role: user.role || "user" });
      
      if (!token) {
        return res.status(500).json({ 
          error: "Internal Server Error", 
          message: "Failed to generate token. Check APP_JWT_SECRET configuration." 
        });
      }

      res.status(201).json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          onboardingCompleted: user.onboardingCompleted ?? false,
          onboardingGoals: user.onboardingGoals ?? [],
        },
        token,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Bad Request", message: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error during signup:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to create user" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = loginSchema.parse(req.body);

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ 
          error: "Unauthorized", 
          message: "Invalid username or password" 
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ 
          error: "Unauthorized", 
          message: "Invalid username or password" 
        });
      }

      const token = signJWT({ sub: user.id, role: user.role || "user" });
      
      if (!token) {
        return res.status(500).json({ 
          error: "Internal Server Error", 
          message: "Failed to generate token. Check APP_JWT_SECRET configuration." 
        });
      }

      res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          onboardingCompleted: user.onboardingCompleted ?? true,
          onboardingGoals: user.onboardingGoals ?? [],
        },
        token,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Bad Request", message: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error during login:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to login" });
    }
  });

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

  app.post("/api/reports", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = createReportSchema.parse(req.body);

      const report = await storage.createReport({
        reporterId: req.userId!,
        reportedUserId: parsed.reportedUserId || null,
        contentType: parsed.contentType,
        contentId: parsed.contentId || null,
        reason: parsed.reason,
        details: parsed.details || null,
      });
      
      res.status(201).json(report);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error creating report:", error);
      res.status(500).json({ error: "Failed to create report" });
    }
  });

  app.get("/api/users/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted ?? true,
        onboardingGoals: user.onboardingGoals ?? [],
      });
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.get("/api/users/me/profile", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const profile = await storage.getPublicProfile(req.userId!);
      if (!profile) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching current user profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.patch("/api/users/me/profile", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = updateProfileSchema.parse(req.body);
      
      const updates: ProfileUpdate = {};
      if (parsed.bio !== undefined) updates.bio = parsed.bio;
      if (parsed.location !== undefined) updates.location = parsed.location;
      if (parsed.avatarUrl !== undefined) updates.avatarUrl = parsed.avatarUrl;
      if (parsed.focusAreas !== undefined) updates.focusAreas = parsed.focusAreas;
      if (parsed.vehiclesWorkedOn !== undefined) updates.vehiclesWorkedOn = parsed.vehiclesWorkedOn || undefined;
      if (parsed.yearsWrenching !== undefined) updates.yearsWrenching = parsed.yearsWrenching;
      if (parsed.shopAffiliation !== undefined) updates.shopAffiliation = parsed.shopAffiliation;
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid updates provided" });
      }
      
      const updated = await storage.updateUserProfile(req.userId!, updates);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const profile = await storage.getPublicProfile(req.userId!);
      res.json(profile);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error updating current user profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.patch("/api/users/me/onboarding", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { goals, brandIds } = req.body;

      if (goals && Array.isArray(goals)) {
        await db.update(users).set({ onboardingGoals: goals }).where(eq(users.id, req.userId!));
      }

      if (brandIds && Array.isArray(brandIds)) {
        for (const garageId of brandIds) {
          try {
            await storage.joinGarage(req.userId!, garageId);
          } catch {
          }
        }
      }

      await db.update(users).set({ onboardingCompleted: true }).where(eq(users.id, req.userId!));

      res.json({ success: true, onboardingCompleted: true });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ error: "Failed to complete onboarding" });
    }
  });

  app.delete("/api/users/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.deleteUser(req.userId!);
      res.json({ success: true, message: "Account and all associated data deleted successfully" });
    } catch (error) {
      console.error("Error deleting user account:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  app.get("/api/users/me/stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await storage.getUserStats(req.userId!);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/users/:id/profile", async (req: Request, res: Response) => {
    try {
      const fullProfile = await storage.getFullUserProfile(req.params.id);
      if (!fullProfile) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(fullProfile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.patch("/api/users/:id/profile", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const targetUserId = req.params.id;
      
      if (req.userId !== targetUserId && req.userRole !== "admin") {
        return res.status(403).json({ 
          error: "Forbidden", 
          message: "You can only update your own profile" 
        });
      }
      
      const parsed = updateProfileSchema.parse(req.body);
      
      const updates: ProfileUpdate = {};
      if (parsed.bio !== undefined) updates.bio = parsed.bio;
      if (parsed.location !== undefined) updates.location = parsed.location;
      if (parsed.avatarUrl !== undefined) updates.avatarUrl = parsed.avatarUrl;
      if (parsed.focusAreas !== undefined) updates.focusAreas = parsed.focusAreas;
      if (parsed.vehiclesWorkedOn !== undefined) updates.vehiclesWorkedOn = parsed.vehiclesWorkedOn || undefined;
      if (parsed.yearsWrenching !== undefined) updates.yearsWrenching = parsed.yearsWrenching;
      if (parsed.shopAffiliation !== undefined) updates.shopAffiliation = parsed.shopAffiliation;
      
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
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.post("/api/torque-assist", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clientId = req.ip || "unknown";
      
      const allowed = await checkRateLimitAsync(clientId);
      if (!allowed) {
        return res.status(429).json({ 
          error: { 
            code: "RATE_LIMITED", 
            message: "Too many requests. Please wait a moment before trying again." 
          } 
        });
      }
      
      const parsed = torqueAssistRequestSchema.parse(req.body);

      const tier = await getUserTier(req.userId ?? null);
      const isPaid = tierHasFeature(tier, "advanced_diagnostic_tree");

      const cached = getCachedResponse(parsed);
      const fullResponse = cached ?? generateTorqueAssistResponse(parsed);
      if (!cached) cacheResponse(parsed, fullResponse);

      if (isPaid) {
        return res.json({ ...fullResponse, tier, gated: false });
      }

      const trimmed = {
        ...fullResponse,
        likelyCauses: fullResponse.likelyCauses.slice(0, 1),
        recommendedChecks: fullResponse.recommendedChecks.slice(0, 2).map((c) => ({ ...c, tools: c.tools.slice(0, 2) })),
        torqueSpecs: null,
        suggestedParts: [],
        purchaseLinks: [],
        purchaseOptions: [],
        tier,
        gated: true,
        upgradeHint: {
          feature: "advanced_diagnostic_tree" as const,
          requiredTier: "diy_pro",
          message: "Upgrade to DIY Pro for the full diagnostic walkthrough, parts list, and torque specs.",
        },
      };
      res.json(trimmed);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          error: { 
            code: "INVALID_REQUEST", 
            message: error.errors.map(e => e.message).join(", ") 
          } 
        });
      }
      console.error("Error in TorqueAssist:", error);
      res.status(500).json({ 
        error: { 
          code: "INTERNAL_ERROR", 
          message: "An error occurred processing your request" 
        } 
      });
    }
  });

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

  // Product routes - public read, admin-only write
  app.get("/api/products", async (_req: Request, res: Response) => {
    try {
      const productList = await storage.getApprovedProducts();
      res.json(productList);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product || (product.submissionStatus !== "approved" && product.submissionStatus !== "featured")) {
        return res.status(404).json({ error: "Product not found" });
      }
      await storage.incrementProductViews(req.params.id);
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products/:id/click", async (req: Request, res: Response) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      await storage.incrementProductClicks(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking click:", error);
      res.status(500).json({ error: "Failed to track click" });
    }
  });

  // Admin-only product management routes (using JWT auth middleware)
  app.get("/api/admin/products", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const productList = await storage.getAllProducts();
      res.json(productList);
    } catch (error) {
      console.error("Error fetching admin products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/admin/products", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const adminUserId = req.userId!;
      const parsed = insertProductSchema.parse({
        title: req.body.title,
        description: req.body.description || null,
        whyItMatters: req.body.whyItMatters || null,
        price: req.body.price || null,
        priceRange: req.body.priceRange || null,
        category: req.body.category,
        affiliateLink: req.body.affiliateLink || null,
        vendor: req.body.vendor || null,
        imageUrl: req.body.imageUrl || null,
        isSponsored: req.body.isSponsored || false,
      });

      const product = await storage.createProduct(parsed, adminUserId);

      res.status(201).json(product);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/admin/products/:id", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await storage.getProduct(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }

      const parsed = updateProductSchema.parse(req.body);
      const updates: Record<string, unknown> = {};
      if (parsed.title !== undefined) updates.title = parsed.title;
      if (parsed.description !== undefined) updates.description = parsed.description;
      if (parsed.whyItMatters !== undefined) updates.whyItMatters = parsed.whyItMatters;
      if (parsed.price !== undefined) updates.price = parsed.price;
      if (parsed.priceRange !== undefined) updates.priceRange = parsed.priceRange;
      if (parsed.category !== undefined) updates.category = parsed.category;
      if (parsed.affiliateLink !== undefined) updates.affiliateLink = parsed.affiliateLink;
      if (parsed.vendor !== undefined) updates.vendor = parsed.vendor;
      if (parsed.imageUrl !== undefined) updates.imageUrl = parsed.imageUrl;
      if (parsed.isSponsored !== undefined) updates.isSponsored = parsed.isSponsored;
      if (parsed.submissionStatus !== undefined) updates.submissionStatus = parsed.submissionStatus;
      if (parsed.featuredExpiration !== undefined) {
        updates.featuredExpiration = parsed.featuredExpiration ? new Date(parsed.featuredExpiration) : null;
      }

      const updated = await storage.updateProduct(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/admin/products/:id", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await storage.getProduct(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }

      await storage.deleteProduct(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

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

  // ========== Vehicle Routes ==========
  app.get("/api/vehicles", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const vehiclesList = await storage.getVehiclesByUser(req.userId!);
      res.json(vehiclesList);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  app.get("/api/vehicles/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      if (vehicle.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json(vehicle);
    } catch (error) {
      console.error("Error fetching vehicle:", error);
      res.status(500).json({ error: "Failed to fetch vehicle" });
    }
  });

  app.post("/api/vehicles", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tier = await getUserTier(req.userId!);
      if (!tierHasFeature(tier, "multi_vehicle")) {
        const existing = await storage.getVehiclesByUser(req.userId!);
        if (existing.length >= 1) {
          const required = minimumTierFor("multi_vehicle");
          return res.status(402).json({
            error: `Adding more than one vehicle requires ${tierLabel(required)} or higher.`,
            upgradeRequired: true,
            feature: "multi_vehicle",
            currentTier: tier,
            requiredTier: required,
            requiredTierLabel: tierLabel(required),
          });
        }
      }

      const parsed = insertVehicleSchema.parse({
        vin: req.body.vin || null,
        year: req.body.year ? parseInt(req.body.year) : null,
        make: req.body.make || null,
        model: req.body.model || null,
        nickname: req.body.nickname?.trim(),
        imageUrl: req.body.imageUrl || null,
        isPublic: req.body.isPublic === true,
      });

      const vehicle = await storage.createVehicle(parsed, req.userId!);

      res.status(201).json(vehicle);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error creating vehicle:", error);
      res.status(500).json({ error: "Failed to create vehicle" });
    }
  });

  app.patch("/api/vehicles/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      if (vehicle.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const parsed = updateVehicleSchema.parse(req.body);
      const updates: Record<string, unknown> = {};
      if (parsed.vin !== undefined) updates.vin = parsed.vin;
      if (parsed.year !== undefined) updates.year = parsed.year;
      if (parsed.make !== undefined) updates.make = parsed.make;
      if (parsed.model !== undefined) updates.model = parsed.model;
      if (parsed.nickname !== undefined) updates.nickname = parsed.nickname;
      if (parsed.imageUrl !== undefined) updates.imageUrl = parsed.imageUrl;
      if (parsed.isPublic !== undefined) updates.isPublic = parsed.isPublic;

      const updated = await storage.updateVehicle(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error updating vehicle:", error);
      res.status(500).json({ error: "Failed to update vehicle" });
    }
  });

  app.delete("/api/vehicles/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      if (vehicle.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.deleteVehicle(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      res.status(500).json({ error: "Failed to delete vehicle" });
    }
  });

  // ========== Vehicle Notes Routes ==========
  app.get("/api/vehicles/:vehicleId/notes", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const vehicle = await storage.getVehicle(req.params.vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      if (vehicle.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const notes = await storage.getNotesByVehicle(req.params.vehicleId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.get("/api/notes/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      if (note.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json(note);
    } catch (error) {
      console.error("Error fetching note:", error);
      res.status(500).json({ error: "Failed to fetch note" });
    }
  });

  app.post("/api/vehicles/:vehicleId/notes", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const vehicle = await storage.getVehicle(req.params.vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      if (vehicle.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const tier = await getUserTier(req.userId!);
      const canTrackMaintenance = tierHasFeature(tier, "maintenance_tracking");

      const parsed = insertVehicleNoteSchema.parse({
        vehicleId: req.params.vehicleId,
        title: req.body.title?.trim(),
        content: req.body.content?.trim(),
        type: req.body.type || "general",
        cost: req.body.cost || null,
        mileage: req.body.mileage ? Number(req.body.mileage) : null,
        partsUsed: req.body.partsUsed || null,
        beforeState: req.body.beforeState?.trim() || null,
        afterState: req.body.afterState?.trim() || null,
        nextDueMileage: canTrackMaintenance && req.body.nextDueMileage ? Number(req.body.nextDueMileage) : null,
        nextDueDate: canTrackMaintenance && req.body.nextDueDate ? req.body.nextDueDate : null,
        isPrivate: req.body.isPrivate !== false,
      });

      const note = await storage.createNote(parsed, req.userId!);

      res.status(201).json(note);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error creating note:", error);
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.patch("/api/notes/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      if (note.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const parsed = updateVehicleNoteSchema.parse(req.body);
      const updates: Record<string, unknown> = {};
      if (parsed.title !== undefined) updates.title = parsed.title;
      if (parsed.content !== undefined) updates.content = parsed.content;
      if (parsed.type !== undefined) updates.type = parsed.type;
      if (parsed.cost !== undefined) updates.cost = parsed.cost;
      if (parsed.mileage !== undefined) updates.mileage = parsed.mileage;
      if (parsed.partsUsed !== undefined) updates.partsUsed = parsed.partsUsed;
      if (parsed.beforeState !== undefined) updates.beforeState = parsed.beforeState;
      if (parsed.afterState !== undefined) updates.afterState = parsed.afterState;
      if (parsed.isPrivate !== undefined) updates.isPrivate = parsed.isPrivate;

      const wantsMaintenanceFields =
        parsed.nextDueMileage !== undefined || parsed.nextDueDate !== undefined;
      if (wantsMaintenanceFields) {
        if (!(await userHasFeature(req.userId!, "maintenance_tracking"))) {
          return res.status(402).json({
            error: "Maintenance tracking is a Garage Pro feature.",
            upgradeRequired: true,
            feature: "maintenance_tracking",
          });
        }
        if (parsed.nextDueMileage !== undefined) updates.nextDueMileage = parsed.nextDueMileage;
        if (parsed.nextDueDate !== undefined) updates.nextDueDate = parsed.nextDueDate;
      }

      const updated = await storage.updateNote(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error updating note:", error);
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  app.delete("/api/notes/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      if (note.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.deleteNote(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(500).json({ error: "Failed to delete note" });
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

  // ========== Thread Routes ==========
  app.get("/api/garages/:garageId/threads", async (req: Request, res: Response) => {
    try {
      const filter = req.query.filter as string | undefined;
      const search = req.query.search as string | undefined;

      let threadsList = await storage.getThreadsByGarage(req.params.garageId);

      if (filter === "solved") {
        threadsList = threadsList.filter((t) => t.hasSolution);
      } else if (filter === "questions") {
        threadsList = threadsList.filter((t) => !t.hasSolution);
      } else if (filter === "pinned") {
        threadsList = threadsList.filter((t) => t.isPinned);
      }

      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        threadsList = threadsList.filter((t) =>
          t.title.toLowerCase().includes(term) ||
          t.userName.toLowerCase().includes(term)
        );
      }

      res.json(threadsList);
    } catch (error) {
      console.error("Error fetching threads:", error);
      res.status(500).json({ error: "Failed to fetch threads" });
    }
  });

  app.get("/api/threads/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const all = await storage.getAllThreads();
      const mine = all
        .filter((t) => t.userId === req.userId)
        .map((t) => ({ id: t.id, title: t.title, status: t.status, hasSolution: t.hasSolution }));
      res.json(mine);
    } catch (error) {
      console.error("Error fetching my threads:", error);
      res.status(500).json({ error: "Failed to load threads" });
    }
  });

  app.get("/api/threads/:id", async (req: Request, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      res.json(thread);
    } catch (error) {
      console.error("Error fetching thread:", error);
      res.status(500).json({ error: "Failed to fetch thread" });
    }
  });

  app.get("/api/threads", async (req: Request, res: Response) => {
    try {
      const filter = req.query.filter as string | undefined;
      const search = req.query.search as string | undefined;
      const garageIdFilter = req.query.garageId as string | undefined;
      const systemFilter = req.query.system as string | undefined;

      let threadsList = await storage.getAllThreads();

      if (garageIdFilter) {
        threadsList = threadsList.filter((t) => t.garageId === garageIdFilter);
      }

      if (filter === "open") {
        threadsList = threadsList.filter((t) => (t.status ?? "open") === "open");
      } else if (filter === "testing") {
        threadsList = threadsList.filter((t) => t.status === "testing");
      } else if (filter === "needs_expert") {
        threadsList = threadsList.filter((t) => t.status === "needs_expert");
      } else if (filter === "solved") {
        threadsList = threadsList.filter((t) => t.hasSolution || t.status === "solved");
      } else if (filter === "pinned") {
        threadsList = threadsList.filter((t) => t.isPinned);
      }

      if (systemFilter) {
        threadsList = threadsList.filter((t) => t.systemCategory === systemFilter);
      }

      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        threadsList = threadsList.filter((t) =>
          t.title.toLowerCase().includes(term) ||
          (t.userName ?? "").toLowerCase().includes(term) ||
          (t.vehicleName ?? "").toLowerCase().includes(term) ||
          (t.obdCodes ?? []).some((code) => code.toLowerCase().includes(term))
        );
      }

      res.json(threadsList);
    } catch (error) {
      console.error("Error fetching cases:", error);
      res.status(500).json({ error: "Failed to fetch cases" });
    }
  });

  app.post("/api/garages/:garageId/threads", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = insertThreadSchema.parse({
        garageId: req.params.garageId,
        title: req.body.title?.trim(),
        content: req.body.content?.trim(),
        vehicleId: req.body.vehicleId || null,
        symptoms: req.body.symptoms || null,
        obdCodes: req.body.obdCodes || null,
        severity: req.body.severity ? Number(req.body.severity) : null,
        drivability: req.body.drivability ? Number(req.body.drivability) : null,
        recentChanges: req.body.recentChanges?.trim() || null,
        systemCategory: req.body.systemCategory || null,
        urgency: req.body.urgency || null,
        budget: req.body.budget?.trim() || null,
        toolsAvailable: req.body.toolsAvailable?.trim() || null,
        whenItHappens: req.body.whenItHappens?.trim() || null,
        partsReplaced: req.body.partsReplaced?.trim() || null,
      });

      const thread = await storage.createThread(parsed, req.userId!);

      res.status(201).json(thread);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error creating thread:", error);
      res.status(500).json({ error: "Failed to create thread" });
    }
  });

  app.patch("/api/threads/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      if (thread.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const parsed = updateThreadSchema.parse(req.body);
      const updates: Record<string, unknown> = {};
      if (parsed.title !== undefined) updates.title = parsed.title;
      if (parsed.content !== undefined) updates.content = parsed.content;
      if (parsed.hasSolution !== undefined) updates.hasSolution = parsed.hasSolution;
      if (parsed.status !== undefined) updates.status = parsed.status;
      if (parsed.systemCategory !== undefined) updates.systemCategory = parsed.systemCategory;
      if (parsed.urgency !== undefined) updates.urgency = parsed.urgency;
      if (parsed.isPinned !== undefined && req.userRole === "admin") updates.isPinned = parsed.isPinned;

      const updated = await storage.updateThread(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error updating thread:", error);
      res.status(500).json({ error: "Failed to update thread" });
    }
  });

  app.delete("/api/threads/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      if (thread.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.deleteThread(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting thread:", error);
      res.status(500).json({ error: "Failed to delete thread" });
    }
  });

  // ========== Thread Reply Routes ==========
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
      const parsed = insertThreadReplySchema.parse({
        threadId: req.params.threadId,
        content: req.body.content?.trim(),
        replyType: req.body.replyType || undefined,
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

  app.patch("/api/threads/:id/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      if (thread.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ error: "Only the case owner can change status" });
      }

      const { status } = updateThreadStatusSchema.parse(req.body);
      if (status === "solved") {
        return res.status(400).json({ error: "Use Mark Solved endpoint to close a case" });
      }
      const updated = await storage.updateThread(req.params.id, { status });
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error updating status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  app.post("/api/threads/:threadId/solved", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.threadId);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      if (thread.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ error: "Only the case owner can mark solved" });
      }

      const parsed = markSolvedSchema.parse(req.body);
      const replyId: string | null = parsed.replyId ?? null;

      if (replyId) {
        const allReplies = await storage.getRepliesByThread(req.params.threadId);
        const owned = allReplies.find((r) => r.id === replyId);
        if (!owned) {
          return res.status(400).json({ error: "Reply does not belong to this case" });
        }
      }

      await storage.markThreadSolved(req.params.threadId, replyId, {
        rootCause: parsed.rootCause.trim(),
        finalFix: parsed.finalFix.trim(),
        partsUsed: parsed.partsUsed && parsed.partsUsed.length > 0 ? parsed.partsUsed : null,
        toolsUsed: parsed.toolsUsed && parsed.toolsUsed.length > 0 ? parsed.toolsUsed : null,
        solvedCost: parsed.solvedCost?.trim() || null,
        laborMinutes: parsed.laborMinutes ?? null,
        verificationNotes: parsed.verificationNotes?.trim() || null,
      });
      res.json({ success: true });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
      }
      console.error("Error marking solved:", error);
      res.status(500).json({ error: "Failed to mark solved" });
    }
  });

  // ========== Swap Shop Routes ==========
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

      const parsed = insertSwapShopListingSchema.parse({
        title: req.body.title?.trim(),
        description: req.body.description || null,
        price: req.body.price?.trim(),
        condition: req.body.condition,
        location: req.body.location || null,
        localPickup: req.body.localPickup !== false,
        willShip: req.body.willShip === true,
        imageUrl: req.body.imageUrl || null,
        extraImageUrls: hasAdvanced && Array.isArray(req.body.extraImageUrls) ? req.body.extraImageUrls.filter((u: unknown) => typeof u === "string" && u.trim().length > 0) : [],
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
      const updates: Record<string, unknown> = {};
      if (parsed.title !== undefined) updates.title = parsed.title;
      if (parsed.description !== undefined) updates.description = parsed.description;
      if (parsed.price !== undefined) updates.price = parsed.price;
      if (parsed.condition !== undefined) updates.condition = parsed.condition;
      if (parsed.location !== undefined) updates.location = parsed.location;
      if (parsed.localPickup !== undefined) updates.localPickup = parsed.localPickup;
      if (parsed.willShip !== undefined) updates.willShip = parsed.willShip;
      if (parsed.imageUrl !== undefined) updates.imageUrl = parsed.imageUrl;
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
        if (parsed.extraImageUrls !== undefined) updates.extraImageUrls = parsed.extraImageUrls.filter((u) => typeof u === "string" && u.trim().length > 0);
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
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting listing:", error);
      res.status(500).json({ error: "Failed to delete listing" });
    }
  });

  // TODO: Wire up email service for password reset flow
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }
      // TODO: When email service is wired up:
      // 1. Look up user by username
      // 2. Generate a secure reset token with expiration
      // 3. Send reset email with token link
      // For now, always return success to avoid leaking user existence
      res.json({ message: "If an account with that username exists, a reset link has been sent." });
    } catch (error) {
      console.error("Error in forgot-password:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  // TODO: Wire up email service for password reset flow
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
      }
      // TODO: When email service is wired up:
      // 1. Validate the reset token and check expiration
      // 2. Hash the new password
      // 3. Update the user's password
      // 4. Invalidate the token
      res.status(501).json({ error: "Password reset is not yet available. Contact support for assistance." });
    } catch (error) {
      console.error("Error in reset-password:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  // TODO: Wire up email service for email verification flow
  app.post("/api/auth/verify-email", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // TODO: When email service is wired up:
      // 1. Accept verification token from email link
      // 2. Validate token and check expiration
      // 3. Mark user's email as verified in the database
      res.status(501).json({ error: "Email verification is not yet available." });
    } catch (error) {
      console.error("Error in verify-email:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  // ========== Saved Items Routes ==========
  app.post("/api/saved/threads/:threadId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.threadId);
      if (!thread) return res.status(404).json({ error: "Thread not found" });

      await db.insert(savedThreads).values({
        userId: req.userId!,
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

  // ========== Trust Badges Route ==========
  app.get("/api/users/:id/trust-badges", async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const badges: { key: string; label: string; icon: string }[] = [];

      const solutionCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(threadReplies)
        .where(and(eq(threadReplies.userId, userId), eq(threadReplies.isSolution, true)));
      const solvedCount = solutionCount[0]?.count || 0;

      if (solvedCount >= 3) {
        badges.push({ key: "trusted-solver", label: "Trusted Solver", icon: "award" });
      }

      const userVehicles = await storage.getVehiclesByUser(userId);
      const hasVinVehicle = userVehicles.some((v) => v.vin && v.vin.length >= 11);
      if (hasVinVehicle) {
        badges.push({ key: "verified-owner", label: "Verified Owner", icon: "shield" });
      }

      const replyCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(threadReplies)
        .where(eq(threadReplies.userId, userId));
      const totalReplies = replyCount[0]?.count || 0;

      if (totalReplies >= 10) {
        badges.push({ key: "active-contributor", label: "Active Contributor", icon: "message-circle" });
      }

      res.json({
        badges,
        stats: { solvedCount, replyCount: totalReplies, vehicleCount: userVehicles.length },
      });
    } catch (error) {
      console.error("Error fetching trust badges:", error);
      res.status(500).json({ error: "Failed to fetch trust badges" });
    }
  });

  // ========== Admin Report Routes ==========
  app.get("/api/admin/reports", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const statusFilter = (req.query.status as string) || "pending";
      const allReports = await db
        .select({
          id: reports.id,
          reporterId: reports.reporterId,
          reportedUserId: reports.reportedUserId,
          contentType: reports.contentType,
          contentId: reports.contentId,
          reason: reports.reason,
          details: reports.details,
          status: reports.status,
          reviewedBy: reports.reviewedBy,
          reviewedAt: reports.reviewedAt,
          createdAt: reports.createdAt,
          reporterName: sql<string>`(SELECT username FROM users WHERE id = ${reports.reporterId})`,
          reportedUserName: sql<string>`(SELECT username FROM users WHERE id = ${reports.reportedUserId})`,
        })
        .from(reports)
        .where(eq(reports.status, statusFilter))
        .orderBy(desc(reports.createdAt));

      res.json(allReports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  app.patch("/api/admin/reports/:id", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { action } = req.body;
      if (!action || !["dismiss", "remove_content"].includes(action)) {
        return res.status(400).json({ error: "Invalid action. Must be 'dismiss' or 'remove_content'" });
      }

      const [report] = await db
        .select()
        .from(reports)
        .where(eq(reports.id, req.params.id));

      if (!report) return res.status(404).json({ error: "Report not found" });

      if (action === "remove_content" && report.contentId) {
        if (report.contentType === "forum_thread") {
          await db.delete(threads).where(eq(threads.id, report.contentId));
        } else if (report.contentType === "forum_reply") {
          await db.delete(threadReplies).where(eq(threadReplies.id, report.contentId));
        } else if (report.contentType === "swap_listing") {
          await db.delete(swapShopListings).where(eq(swapShopListings.id, report.contentId));
        }
      }

      const newStatus = action === "dismiss" ? "dismissed" : "resolved";
      const [updated] = await db
        .update(reports)
        .set({ status: newStatus, reviewedBy: req.userId!, reviewedAt: new Date() })
        .where(eq(reports.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating report:", error);
      res.status(500).json({ error: "Failed to update report" });
    }
  });

  // ========== Subscriptions ==========
  const TIER_PRICE_MAP: Record<SubscriptionTier, { monthly: number; label: string }> = {
    free: { monthly: 0, label: "Free" },
    diy_pro: { monthly: 999, label: "DIY Pro" },
    garage_pro: { monthly: 2900, label: "Garage Pro" },
    shop_pro: { monthly: 7900, label: "Shop Pro" },
  };

  app.get("/api/subscription", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sub = await storage.getSubscription(req.userId!);
      const tier = (sub?.tier as SubscriptionTier | undefined) ?? "free";
      const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
      res.json({
        tier,
        status: sub?.status ?? "active",
        currentPeriodEnd: sub?.currentPeriodEnd ?? null,
        stripeConfigured,
        prices: TIER_PRICE_MAP,
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ error: "Failed to load subscription" });
    }
  });

  app.post("/api/subscription/upgrade", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = insertSubscriptionSchema.parse(req.body);
      const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

      // STRIPE INTEGRATION POINT:
      // When STRIPE_SECRET_KEY is set, this endpoint should:
      //   1. Create or retrieve a Stripe customer
      //   2. Create a Checkout Session (mode: "subscription") with the matching price ID
      //   3. Return { checkoutUrl } so the client can redirect
      // For now we accept upgrades only when Stripe is not configured (sandbox mode).
      if (stripeConfigured && parsed.tier !== "free") {
        return res.status(503).json({
          error: "Live billing not yet wired up. Set up Stripe price IDs to enable paid upgrades.",
          stripeConfigured: true,
        });
      }

      const sub = await storage.upsertSubscription(req.userId!, parsed.tier, "active");
      res.json({ tier: sub.tier, status: sub.status, sandbox: !stripeConfigured });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
      }
      console.error("Error upgrading subscription:", error);
      res.status(500).json({ error: "Failed to upgrade subscription" });
    }
  });

  // ========== Seller / Shop Profile ==========
  app.get("/api/seller-profile/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const profile = await storage.getSellerProfile(req.userId!);
      res.json(profile ?? null);
    } catch (error) {
      console.error("Error fetching seller profile:", error);
      res.status(500).json({ error: "Failed to load seller profile" });
    }
  });

  app.put("/api/seller-profile/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = insertSellerProfileSchema.parse(req.body);
      const saved = await storage.upsertSellerProfile(req.userId!, {
        displayName: parsed.displayName.trim(),
        sellerType: parsed.sellerType,
        bio: parsed.bio?.trim() || null,
        location: parsed.location?.trim() || null,
      });
      res.json(saved);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
      }
      console.error("Error saving seller profile:", error);
      res.status(500).json({ error: "Failed to save seller profile" });
    }
  });

  // ========== Shop Pro: Profile ==========
  app.get(
    "/api/shop-profile/me",
    requireAuth,
    requireFeature("shop_profile"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getSellerProfile(req.userId!);
        const credibility = await storage.getShopCredibility(req.userId!);
        res.json({ profile: profile ?? null, credibility });
      } catch (error) {
        console.error("Error fetching shop profile:", error);
        res.status(500).json({ error: "Failed to load shop profile" });
      }
    },
  );

  app.put(
    "/api/shop-profile/me",
    requireAuth,
    requireFeature("shop_profile"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = updateShopProfileSchema.parse(req.body);
        if (parsed.slug) {
          const available = await storage.isSlugAvailable(parsed.slug, req.userId!);
          if (!available) {
            return res.status(409).json({ error: "That slug is already taken." });
          }
        }
        const saved = await storage.upsertShopFields(req.userId!, parsed);
        res.json(saved);
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
        }
        console.error("Error saving shop profile:", error);
        res.status(500).json({ error: "Failed to save shop profile" });
      }
    },
  );

  // ========== Shop Pro: Services ==========
  app.get(
    "/api/shop-services",
    requireAuth,
    requireFeature("service_listings"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const items = await storage.listShopServices(req.userId!);
        res.json(items);
      } catch (error) {
        console.error("Error listing shop services:", error);
        res.status(500).json({ error: "Failed to load services" });
      }
    },
  );

  app.post(
    "/api/shop-services",
    requireAuth,
    requireFeature("service_listings"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = insertShopServiceSchema.parse(req.body);
        const created = await storage.createShopService(req.userId!, parsed);
        res.status(201).json(created);
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
        }
        console.error("Error creating shop service:", error);
        res.status(500).json({ error: "Failed to create service" });
      }
    },
  );

  app.patch(
    "/api/shop-services/:id",
    requireAuth,
    requireFeature("service_listings"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const existing = await storage.getShopService(req.params.id);
        if (!existing) return res.status(404).json({ error: "Service not found" });
        if (existing.ownerUserId !== req.userId) return res.status(403).json({ error: "Not your service" });
        const parsed = updateShopServiceSchema.parse(req.body);
        const updated = await storage.updateShopService(req.params.id, parsed);
        res.json(updated);
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
        }
        console.error("Error updating shop service:", error);
        res.status(500).json({ error: "Failed to update service" });
      }
    },
  );

  app.delete(
    "/api/shop-services/:id",
    requireAuth,
    requireFeature("service_listings"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const existing = await storage.getShopService(req.params.id);
        if (!existing) return res.status(404).json({ error: "Service not found" });
        if (existing.ownerUserId !== req.userId) return res.status(403).json({ error: "Not your service" });
        await storage.deleteShopService(req.params.id);
        res.json({ ok: true });
      } catch (error) {
        console.error("Error deleting shop service:", error);
        res.status(500).json({ error: "Failed to delete service" });
      }
    },
  );

  // ========== Shop Pro: Leads ==========
  app.get(
    "/api/shop-leads",
    requireAuth,
    requireFeature("lead_capture"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const items = await storage.listShopLeads(req.userId!);
        res.json(items);
      } catch (error) {
        console.error("Error listing shop leads:", error);
        res.status(500).json({ error: "Failed to load leads" });
      }
    },
  );

  app.get(
    "/api/shop-leads/unread-count",
    requireAuth,
    requireFeature("lead_capture"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const count = await storage.getUnreadLeadCount(req.userId!);
        res.json({ count });
      } catch (error) {
        console.error("Error getting unread leads:", error);
        res.status(500).json({ error: "Failed" });
      }
    },
  );

  app.patch(
    "/api/shop-leads/:id",
    requireAuth,
    requireFeature("lead_capture"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const existing = await storage.getShopLead(req.params.id);
        if (!existing) return res.status(404).json({ error: "Lead not found" });
        if (existing.ownerUserId !== req.userId) return res.status(403).json({ error: "Not your lead" });
        const isRead = req.body?.isRead === true || req.body?.isRead === false ? req.body.isRead : true;
        const updated = await storage.markLeadRead(req.params.id, isRead);
        res.json(updated);
      } catch (error) {
        console.error("Error updating lead:", error);
        res.status(500).json({ error: "Failed to update lead" });
      }
    },
  );

  // ========== Shop Pro: Team ==========
  app.get(
    "/api/shop-team",
    requireAuth,
    requireFeature("team_access"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const members = await storage.listTeamMembers(req.userId!);
        res.json(members);
      } catch (error) {
        console.error("Error listing team:", error);
        res.status(500).json({ error: "Failed to load team" });
      }
    },
  );

  app.post(
    "/api/shop-team",
    requireAuth,
    requireFeature("team_access"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = inviteTeamMemberSchema.parse(req.body);
        const member = await storage.getUserByUsername(parsed.username.trim());
        if (!member) return res.status(404).json({ error: "User not found" });
        if (member.id === req.userId) return res.status(400).json({ error: "You cannot add yourself." });
        const created = await storage.addTeamMember(req.userId!, member.id, parsed.role);
        res.status(201).json({ ...created, username: member.username });
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
        }
        console.error("Error adding team member:", error);
        res.status(500).json({ error: "Failed to add team member" });
      }
    },
  );

  app.delete(
    "/api/shop-team/:id",
    requireAuth,
    requireFeature("team_access"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        await storage.removeTeamMember(req.userId!, req.params.id);
        res.json({ ok: true });
      } catch (error) {
        console.error("Error removing team member:", error);
        res.status(500).json({ error: "Failed to remove team member" });
      }
    },
  );

  // ========== Shop Pro: Customer Diagnostic Summaries ==========
  app.get(
    "/api/cases/:caseId/customer-summary",
    requireAuth,
    requireFeature("customer_diagnostic_summaries"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const thread = await storage.getThread(req.params.caseId);
        if (!thread) return res.status(404).json({ error: "Case not found" });
        if (thread.userId !== req.userId) return res.status(403).json({ error: "Only the case author can view this." });
        const summary = await storage.getCustomerSummaryByCase(req.params.caseId);
        res.json({ summary: summary ?? null });
      } catch (error) {
        console.error("Error fetching customer summary:", error);
        res.status(500).json({ error: "Failed to load summary" });
      }
    },
  );

  app.post(
    "/api/cases/:caseId/customer-summary",
    requireAuth,
    requireFeature("customer_diagnostic_summaries"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const thread = await storage.getThread(req.params.caseId);
        if (!thread) return res.status(404).json({ error: "Case not found" });
        if (thread.userId !== req.userId) return res.status(403).json({ error: "Only the case author can manage this." });
        const parsed = upsertCustomerSummarySchema.parse(req.body);
        const token = crypto.randomBytes(24).toString("hex");
        const saved = await storage.upsertCustomerSummary(req.params.caseId, req.userId!, parsed, token);
        res.json(saved);
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
        }
        console.error("Error saving customer summary:", error);
        res.status(500).json({ error: "Failed to save summary" });
      }
    },
  );

  app.post(
    "/api/cases/:caseId/customer-summary/rotate",
    requireAuth,
    requireFeature("customer_diagnostic_summaries"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const thread = await storage.getThread(req.params.caseId);
        if (!thread) return res.status(404).json({ error: "Case not found" });
        if (thread.userId !== req.userId) return res.status(403).json({ error: "Only the case author can manage this." });
        const newToken = crypto.randomBytes(24).toString("hex");
        const updated = await storage.rotateCustomerSummaryToken(req.params.caseId, newToken);
        if (!updated) return res.status(404).json({ error: "No summary to rotate" });
        res.json(updated);
      } catch (error) {
        console.error("Error rotating summary token:", error);
        res.status(500).json({ error: "Failed to rotate token" });
      }
    },
  );

  app.delete(
    "/api/cases/:caseId/customer-summary",
    requireAuth,
    requireFeature("customer_diagnostic_summaries"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const thread = await storage.getThread(req.params.caseId);
        if (!thread) return res.status(404).json({ error: "Case not found" });
        if (thread.userId !== req.userId) return res.status(403).json({ error: "Only the case author can manage this." });
        await storage.revokeCustomerSummary(req.params.caseId);
        res.json({ ok: true });
      } catch (error) {
        console.error("Error revoking summary:", error);
        res.status(500).json({ error: "Failed to revoke summary" });
      }
    },
  );

  app.get("/api/seller-dashboard", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const dash = await storage.getSellerDashboard(req.userId!);
      const sub = await storage.getSubscription(req.userId!);
      const tier = (sub?.tier as SubscriptionTier | undefined) ?? "free";
      const FREE_LISTING_LIMIT = 3;
      res.json({
        profile: dash.profile,
        activeListings: dash.activeListings,
        drafts: dash.draftListings,
        attachedCasesCount: dash.attachedCaseCount,
        tier,
        listingLimit: tier === "free" ? FREE_LISTING_LIMIT : null,
        atLimit: tier === "free" && dash.activeListings.length >= FREE_LISTING_LIMIT,
      });
    } catch (error) {
      console.error("Error fetching seller dashboard:", error);
      res.status(500).json({ error: "Failed to load seller dashboard" });
    }
  });

  // ========== Expert Review Escalation ==========
  const EXPERT_PRICE_CENTS: Record<ExpertServiceLevel, number> = {
    quick_review: 1500,
    full_diagnostic: 3900,
    live_remote: 9900,
  };

  app.post("/api/cases/:caseId/escalate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.caseId);
      if (!thread) return res.status(404).json({ error: "Case not found" });

      const parsed = escalateCaseSchema.parse(req.body);
      const priceCents = EXPERT_PRICE_CENTS[parsed.serviceLevel];

      // STRIPE INTEGRATION POINT:
      // When STRIPE_SECRET_KEY is set, this endpoint should create a one-time
      // Payment Intent for `priceCents`, hold the expert review record in
      // payment_status: "pending" until the webhook flips it to "paid".

      const review = await storage.createExpertReview(
        req.params.caseId,
        req.userId!,
        parsed.serviceLevel,
        parsed.userNotes?.trim() || null,
        priceCents,
      );
      res.json(review);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
      }
      console.error("Error escalating case:", error);
      res.status(500).json({ error: "Failed to escalate case" });
    }
  });

  app.get("/api/cases/:caseId/escalations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reviews = await storage.getExpertReviewsByCase(req.params.caseId);
      const own = reviews.filter((r) => r.userId === req.userId);
      res.json(own);
    } catch (error) {
      console.error("Error fetching escalations:", error);
      res.status(500).json({ error: "Failed to load escalations" });
    }
  });

  // ========== Repair Plan Export ==========
  app.post("/api/cases/:caseId/repair-plan", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.caseId);
      if (!thread) return res.status(404).json({ error: "Case not found" });

      const tier = await getUserTier(req.userId!);
      const wantsPdf = req.body?.exportType === "pdf";
      if (wantsPdf && !tierHasFeature(tier, "pdf_repair_plan")) {
        const required = minimumTierFor("pdf_repair_plan");
        return res.status(402).json({
          error: `PDF export requires ${tierLabel(required)} or higher.`,
          upgradeRequired: true,
          feature: "pdf_repair_plan",
          currentTier: tier,
          requiredTier: required,
          requiredTierLabel: tierLabel(required),
        });
      }

      const recs = getContextRecommendations({
        obdCodes: thread.obdCodes,
        systemCategory: thread.systemCategory,
        symptoms: thread.symptoms,
        title: thread.title,
      });
      const totalCostRange = summarizeCostRange(recs);

      const planRec = (r: typeof recs[number]) => ({ title: r.title, reason: r.description });

      const plan = {
        version: 1,
        generatedAt: new Date().toISOString(),
        vehicle: {
          name: thread.vehicleName ?? null,
          mileage: null,
        },
        case: {
          id: thread.id,
          title: thread.title,
          systemCategory: thread.systemCategory,
          urgency: thread.urgency,
          status: thread.status,
        },
        symptoms: thread.symptoms ?? [],
        obdCodes: thread.obdCodes ?? [],
        probableCauses: recs.filter((r) => r.category === "likely_part").slice(0, 5).map((r) => r.title),
        diagnosticSteps: [
          "Verify the symptom is reproducible.",
          "Pull and document any current and pending DTCs.",
          "Inspect related connectors, wiring, and hoses for obvious damage.",
          "Run the targeted tests for each top hypothesis before swapping parts.",
        ],
        toolsNeeded: recs.filter((r) => r.type === "tool").map(planRec),
        partsList: recs.filter((r) => r.type === "part" || r.type === "consumable").map(planRec),
        safetyWarnings: [
          "Always use jack stands when working under a vehicle.",
          "Disconnect the battery before any work on airbag, fuel, or high-voltage systems.",
          "Verify fitment of every part by VIN before installing.",
        ],
        difficulty: thread.urgency === "stranded" ? "advanced" : "moderate",
        estimatedCostRange: totalCostRange.label,
        finalNotes: "Document each test result on the case so the community can verify your final fix.",
        tier,
        exportType: wantsPdf ? "pdf" : "preview",
      };

      const exportType = wantsPdf ? "pdf" : "preview";
      await storage.createRepairPlanExport(req.params.caseId, req.userId!, exportType, plan);

      if (!wantsPdf) {
        return res.json(plan);
      }

      const doc = new PDFDocument({ margin: 50, size: "LETTER" });
      const safeTitle = (thread.title || "case").replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="repair-plan-${safeTitle}.pdf"`);
      doc.pipe(res);

      doc.fontSize(20).text("TorqueShed Repair Plan", { align: "left" });
      doc.moveDown(0.3).fontSize(14).text(thread.title);
      if (thread.vehicleName) doc.fontSize(10).fillColor("#666").text(`Vehicle: ${thread.vehicleName}`);
      doc.fontSize(9).fillColor("#888").text(`Generated: ${new Date(plan.generatedAt).toLocaleString()}`);
      doc.fontSize(9).text(`Difficulty: ${plan.difficulty}    Estimated total: ${plan.estimatedCostRange}`);
      doc.moveDown();

      const writeSection = (label: string, items: string[]) => {
        if (items.length === 0) return;
        doc.fillColor("#000").fontSize(13).text(label, { underline: true });
        doc.moveDown(0.2);
        items.forEach((line) => {
          doc.fontSize(10).fillColor("#222").text(`• ${line}`, { indent: 12, paragraphGap: 2 });
        });
        doc.moveDown(0.4);
      };

      if (plan.symptoms.length > 0) writeSection("Symptoms", plan.symptoms);
      if (plan.obdCodes.length > 0) writeSection("DTC Codes", plan.obdCodes);
      if (plan.probableCauses.length > 0) writeSection("Probable Causes", plan.probableCauses);
      writeSection("Diagnostic Steps", plan.diagnosticSteps);
      writeSection("Tools Needed", plan.toolsNeeded.map((t) => `${t.title} — ${t.reason}`));
      writeSection("Parts & Consumables", plan.partsList.map((p) => `${p.title} — ${p.reason}`));
      writeSection("Safety Warnings", plan.safetyWarnings);

      doc.moveDown(0.5).fontSize(8).fillColor("#666").text(plan.finalNotes, { align: "left" });
      doc.fontSize(7).fillColor("#999").text(`TorqueShed · Generated ${new Date(plan.generatedAt).toLocaleDateString()} · Tier: ${tier}`, { align: "right" });
      doc.end();
    } catch (error) {
      console.error("Error generating repair plan:", error);
      if (!res.headersSent) res.status(500).json({ error: "Failed to generate repair plan" });
    }
  });

  // ========== Case Recommendations ==========
  app.get("/api/cases/:caseId/recommendations", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.caseId);
      if (!thread) return res.status(404).json({ error: "Case not found" });

      const tier = await getUserTier(req.userId ?? null);
      const fullChecklist = tierHasFeature(tier, "full_parts_checklist");

      const seeded = getContextRecommendations({
        obdCodes: thread.obdCodes,
        systemCategory: thread.systemCategory,
        symptoms: thread.symptoms,
        title: thread.title,
      });

      const userListings = await storage.getListingsForCase(req.params.caseId);
      const toClient = (r: typeof seeded[number]) => ({
        title: r.title,
        reason: r.description,
        affiliateUrl: r.url,
        estimatedPrice: r.estimatedPrice,
        fitmentNote: r.fitmentNote,
        type: r.type,
        category: r.category,
      });

      const requiredTools = seeded.filter((r) => r.category === "required_tool").map(toClient);
      const optionalTools = seeded.filter((r) => r.category === "optional_tool").map(toClient);
      const likelyParts = seeded.filter((r) => r.category === "likely_part").map(toClient);
      const consumables = seeded.filter((r) => r.category === "consumable").map(toClient);
      const safetyEquipment = seeded.filter((r) => r.category === "safety_equipment").map(toClient);

      const FREE_LIMITS = { optionalTools: 1, likelyParts: 2, consumables: 1 } as const;

      res.json({
        requiredTools,
        optionalTools: fullChecklist ? optionalTools : optionalTools.slice(0, FREE_LIMITS.optionalTools),
        likelyParts: fullChecklist ? likelyParts : likelyParts.slice(0, FREE_LIMITS.likelyParts),
        consumables: fullChecklist ? consumables : consumables.slice(0, FREE_LIMITS.consumables),
        safetyEquipment,
        marketplaceListings: userListings.map((l) => ({
          id: l.id,
          title: l.title,
          price: l.price,
          category: l.category ?? "parts",
        })),
        totalCostRange: summarizeCostRange(seeded),
        affiliateNote: "Affiliate links shown when available. Always verify fitment by VIN before purchase.",
        hiddenCounts: fullChecklist ? null : {
          optionalTools: Math.max(0, optionalTools.length - FREE_LIMITS.optionalTools),
          likelyParts: Math.max(0, likelyParts.length - FREE_LIMITS.likelyParts),
          consumables: Math.max(0, consumables.length - FREE_LIMITS.consumables),
        },
        fullChecklist,
        tier,
      });
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ error: "Failed to load recommendations" });
    }
  });

  // ========== Case Tools Used (attach inventory tools to a case) ==========
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

  // ========== Similar Solved Cases ==========
  app.get("/api/cases/:caseId/similar", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.caseId);
      if (!thread) return res.status(404).json({ error: "Case not found" });

      const tier = await getUserTier(req.userId!);
      const hasFull = tierHasFeature(tier, "similar_solved_matching");

      const all = await storage.getAllThreads();
      const baseDtcs = (thread.obdCodes ?? []).map((c) => c.toUpperCase().trim()).filter(Boolean);
      const parseVehicle = (name: string | null | undefined) => {
        const tokens = (name ?? "").toLowerCase().split(/\s+/).filter(Boolean);
        const yearIdx = tokens.findIndex((t) => /^(19|20)\d{2}$/.test(t));
        const afterYear = yearIdx >= 0 ? tokens.slice(yearIdx + 1) : tokens;
        const make = afterYear[0] ?? "";
        const model = afterYear[1] ?? "";
        return { make, model };
      };
      const baseVehicle = parseVehicle(thread.vehicleName);
      const baseSymptoms = (thread.symptoms ?? []).join(" ").toLowerCase();

      const scored = all
        .filter((t) => t.id !== thread.id && (t.hasSolution || t.status === "solved"))
        .map((t) => {
          let score = 0;
          const reasons: string[] = [];

          const tVehicle = parseVehicle(t.vehicleName);
          const sameMake = baseVehicle.make && tVehicle.make && baseVehicle.make === tVehicle.make;
          const sameModel = baseVehicle.model && tVehicle.model && baseVehicle.model === tVehicle.model;
          if (sameMake && sameModel) {
            score += 25;
            reasons.push(`Same make + model (${baseVehicle.make} ${baseVehicle.model})`);
          } else if (sameMake) {
            score += 10;
            reasons.push(`Same make (${baseVehicle.make})`);
          }
          const tDtcs = (t.obdCodes ?? []).map((c) => c.toUpperCase().trim());
          const dtcOverlap = baseDtcs.filter((c) => tDtcs.includes(c));
          if (dtcOverlap.length > 0) {
            score += 25 * dtcOverlap.length;
            reasons.push(`DTC match: ${dtcOverlap.join(", ")}`);
          }
          if (thread.systemCategory && t.systemCategory === thread.systemCategory) {
            score += 5;
            reasons.push("Same system");
          }
          const tSymptoms = (t.symptoms ?? []).join(" ").toLowerCase();
          if (baseSymptoms && tSymptoms) {
            const baseWords = Array.from(new Set(baseSymptoms.split(/\W+/).filter((w) => w.length > 4)));
            const overlap = baseWords.filter((w) => tSymptoms.includes(w));
            if (overlap.length > 0) {
              score += overlap.length * 2;
              reasons.push(`Symptom overlap (${overlap.length})`);
            }
          }

          return { thread: t, score, reasons };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);

      const top = scored.slice(0, 5);
      const visible = hasFull ? top : top.slice(0, 1);
      const hidden = top.length - visible.length;

      res.json({
        cases: visible.map((s) => ({
          id: s.thread.id,
          title: s.thread.title,
          vehicleName: s.thread.vehicleName,
          systemCategory: s.thread.systemCategory,
          obdCodes: s.thread.obdCodes ?? [],
          score: s.score,
          matchReasons: s.reasons,
        })),
        hiddenCount: hidden,
        totalAvailable: top.length,
        hasFeature: hasFull,
      });
    } catch (error) {
      console.error("Error fetching similar cases:", error);
      res.status(500).json({ error: "Failed to load similar cases" });
    }
  });

  // ========== Maintenance Due ==========
  app.get("/api/vehicles/me/maintenance-due", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tier = await getUserTier(req.userId!);
      const hasFeature = tierHasFeature(tier, "maintenance_tracking");
      if (!hasFeature) {
        return res.json({ items: [], hasFeature: false, totalCount: 0 });
      }
      const items = await storage.getMaintenanceDueForUser(req.userId!);
      res.json({ items, hasFeature: true, totalCount: items.length });
    } catch (error) {
      console.error("Error loading maintenance due:", error);
      res.status(500).json({ error: "Failed to load maintenance" });
    }
  });

  // ========== Tool Inventory ==========
  app.get("/api/tools", requireAuth, requireFeature("tool_inventory"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const list = await storage.getToolsByUser(req.userId!);
      res.json(list);
    } catch (error) {
      console.error("Error loading tools:", error);
      res.status(500).json({ error: "Failed to load tools" });
    }
  });

  app.post("/api/tools", requireAuth, requireFeature("tool_inventory"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = insertToolSchema.parse(req.body);
      const created = await storage.createTool(parsed, req.userId!);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
      }
      console.error("Error creating tool:", error);
      res.status(500).json({ error: "Failed to create tool" });
    }
  });

  app.patch("/api/tools/:id", requireAuth, requireFeature("tool_inventory"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tool = await storage.getTool(req.params.id);
      if (!tool) return res.status(404).json({ error: "Tool not found" });
      if (tool.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
      const parsed = updateToolSchema.parse(req.body);
      const updated = await storage.updateTool(req.params.id, parsed);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
      }
      console.error("Error updating tool:", error);
      res.status(500).json({ error: "Failed to update tool" });
    }
  });

  app.delete("/api/tools/:id", requireAuth, requireFeature("tool_inventory"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tool = await storage.getTool(req.params.id);
      if (!tool) return res.status(404).json({ error: "Tool not found" });
      if (tool.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
      await storage.deleteTool(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tool:", error);
      res.status(500).json({ error: "Failed to delete tool" });
    }
  });

  // ========== Listings extras ==========
  app.get("/api/listings/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const listings = await storage.getListingsByUser(req.userId!);
      res.json(listings);
    } catch (error) {
      console.error("Error fetching my listings:", error);
      res.status(500).json({ error: "Failed to load listings" });
    }
  });

  // ========== Public Shop Pro pages ==========
  function publicShopPayload(profile: SellerProfile, services: ShopService[], credibility: Awaited<ReturnType<typeof storage.getShopCredibility>>) {
    return {
      shop: {
        slug: profile.slug,
        displayName: profile.displayName,
        description: profile.description ?? null,
        logoUrl: profile.logoUrl ?? null,
        location: profile.location ?? null,
        serviceArea: profile.serviceArea ?? null,
        address: profile.address ?? null,
        phone: profile.phone ?? null,
        email: profile.email ?? null,
        website: profile.website ?? null,
        specialties: profile.specialties ?? [],
        certifications: profile.certifications ?? [],
        yearsInBusiness: profile.yearsInBusiness ?? null,
        hours: profile.hours ?? {},
        isVerified: profile.isVerified ?? false,
      },
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        description: s.description,
        startingPrice: s.startingPrice,
        eta: s.eta,
      })),
      credibility,
    };
  }

  app.get("/api/public/shops/:slug", async (req: Request, res: Response) => {
    try {
      const profile = await storage.getShopProfileBySlug(req.params.slug);
      if (!profile || !profile.isPublic) return res.status(404).json({ error: "Shop not found" });
      const services = await storage.listPublicShopServices(profile.userId);
      const credibility = await storage.getShopCredibility(profile.userId);
      res.json(publicShopPayload(profile, services, credibility));
    } catch (error) {
      console.error("Error fetching public shop:", error);
      res.status(500).json({ error: "Failed to load shop" });
    }
  });

  app.post("/api/public/shops/:slug/leads", async (req: Request, res: Response) => {
    try {
      const profile = await storage.getShopProfileBySlug(req.params.slug);
      if (!profile || !profile.isPublic) return res.status(404).json({ error: "Shop not found" });
      const tier = await getUserTier(profile.userId);
      if (!tierHasFeature(tier, "lead_capture")) {
        return res.status(404).json({ error: "Shop not accepting leads" });
      }
      const parsed = createShopLeadSchema.parse(req.body);
      if (parsed.serviceId) {
        const svc = await storage.getShopService(parsed.serviceId);
        if (!svc || svc.ownerUserId !== profile.userId) {
          return res.status(400).json({ error: "Invalid service" });
        }
      }
      const created = await storage.createShopLead(profile.userId, parsed);
      res.status(201).json({ ok: true, id: created.id });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
      }
      console.error("Error creating public lead:", error);
      res.status(500).json({ error: "Failed to submit lead" });
    }
  });

  app.get("/api/public/diagnostic-summary/:token", async (req: Request, res: Response) => {
    try {
      const summary = await storage.getCustomerSummaryByToken(req.params.token);
      if (!summary || summary.isRevoked) return res.status(404).json({ error: "Summary not available" });
      const thread = await storage.getThread(summary.caseId);
      const profile = await storage.getSellerProfile(summary.ownerUserId);
      res.json({
        summary: {
          customerConcern: summary.customerConcern,
          diagnosticFindings: summary.diagnosticFindings,
          recommendedRepairs: summary.recommendedRepairs,
          urgencyLevel: summary.urgencyLevel,
          estimateNotes: summary.estimateNotes,
          nextSteps: summary.nextSteps,
          updatedAt: summary.updatedAt,
        },
        case: thread
          ? {
              title: thread.title,
              vehicleName: thread.vehicleName,
              obdCodes: thread.obdCodes ?? [],
            }
          : null,
        shop: profile
          ? {
              displayName: profile.displayName,
              slug: profile.slug,
              logoUrl: profile.logoUrl,
              phone: profile.phone,
              email: profile.email,
              website: profile.website,
            }
          : null,
      });
    } catch (error) {
      console.error("Error fetching public summary:", error);
      res.status(500).json({ error: "Failed to load summary" });
    }
  });

  // Server-rendered HTML routes (shareable links)
  app.get("/shops/:slug", async (_req: Request, res: Response) => {
    res.sendFile(path.resolve(process.cwd(), "server", "templates", "public-shop.html"));
  });
  app.get("/public/diagnostic-summary/:token", async (_req: Request, res: Response) => {
    res.sendFile(path.resolve(process.cwd(), "server", "templates", "public-summary.html"));
  });

  const httpServer = createServer(app);

  return httpServer;
}
