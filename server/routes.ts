import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
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
  updateSwapShopListingSchema,
  updateProductSchema,
} from "@shared/schema";
import { requireAuth, requireAdmin, signJWT, type AuthenticatedRequest } from "./middleware/auth";
import { db } from "./db";
import { users, garageMembers } from "@shared/schema";
import { eq } from "drizzle-orm";

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

  app.post("/api/torque-assist", async (req: Request, res: Response) => {
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
      
      const cached = getCachedResponse(parsed);
      if (cached) {
        return res.json(cached);
      }
      
      const response = generateTorqueAssistResponse(parsed);
      cacheResponse(parsed, response);
      
      res.json(response);
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
      const parsed = insertVehicleSchema.parse({
        vin: req.body.vin || null,
        year: req.body.year ? parseInt(req.body.year) : null,
        make: req.body.make || null,
        model: req.body.model || null,
        nickname: req.body.nickname?.trim(),
        imageUrl: req.body.imageUrl || null,
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

      const parsed = insertVehicleNoteSchema.parse({
        vehicleId: req.params.vehicleId,
        title: req.body.title?.trim(),
        content: req.body.content?.trim(),
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
      if (parsed.isPrivate !== undefined) updates.isPrivate = parsed.isPrivate;

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

  // ========== Thread Routes ==========
  app.get("/api/garages/:garageId/threads", async (req: Request, res: Response) => {
    try {
      const threadsList = await storage.getThreadsByGarage(req.params.garageId);
      res.json(threadsList);
    } catch (error) {
      console.error("Error fetching threads:", error);
      res.status(500).json({ error: "Failed to fetch threads" });
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

  app.post("/api/garages/:garageId/threads", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = insertThreadSchema.parse({
        garageId: req.params.garageId,
        title: req.body.title?.trim(),
        content: req.body.content?.trim(),
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

  app.post("/api/threads/:threadId/replies/:replyId/solution", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.threadId);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      if (thread.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ error: "Only thread owner can mark solutions" });
      }

      await storage.markReplyAsSolution(req.params.replyId, req.params.threadId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking solution:", error);
      res.status(500).json({ error: "Failed to mark solution" });
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

  app.get("/api/swap-shop/:id", async (req: Request, res: Response) => {
    try {
      const listing = await storage.getSwapShopListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      res.json(listing);
    } catch (error) {
      console.error("Error fetching listing:", error);
      res.status(500).json({ error: "Failed to fetch listing" });
    }
  });

  app.post("/api/swap-shop", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = insertSwapShopListingSchema.parse({
        title: req.body.title?.trim(),
        description: req.body.description || null,
        price: req.body.price?.trim(),
        condition: req.body.condition,
        location: req.body.location || null,
        localPickup: req.body.localPickup !== false,
        willShip: req.body.willShip === true,
        imageUrl: req.body.imageUrl || null,
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

  const httpServer = createServer(app);

  return httpServer;
}
