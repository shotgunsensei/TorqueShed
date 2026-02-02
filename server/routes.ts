import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import bcrypt from "bcrypt";
import { storage, type ProfileUpdate } from "./storage";
import { setupWebSocket, getGarageUserCount } from "./websocket";
import { 
  validateRequest, 
  checkRateLimitAsync, 
  getCachedResponse, 
  cacheResponse, 
  generateTorqueAssistResponse 
} from "./torque-assist";
import { FOCUS_AREAS, PRODUCT_CATEGORIES, type FocusArea } from "@shared/schema";
import { requireAuth, requireAdmin, signJWT, type AuthenticatedRequest } from "./middleware/auth";

const BCRYPT_ROUNDS = 12;

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || typeof username !== "string" || username.trim().length < 3) {
        return res.status(400).json({ 
          error: "Bad Request", 
          message: "Username must be at least 3 characters" 
        });
      }
      
      if (!password || typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ 
          error: "Bad Request", 
          message: "Password must be at least 8 characters" 
        });
      }

      const existingUser = await storage.getUserByUsername(username.trim());
      if (existingUser) {
        return res.status(409).json({ 
          error: "Conflict", 
          message: "Username already exists" 
        });
      }

      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
      
      const user = await storage.createUser({
        username: username.trim(),
        password: hashedPassword,
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
        },
        token,
      });
    } catch (error) {
      console.error("Error during signup:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to create user" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ 
          error: "Bad Request", 
          message: "Username and password are required" 
        });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ 
          error: "Unauthorized", 
          message: "Invalid username or password" 
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
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
        },
        token,
      });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to login" });
    }
  });

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

  app.post("/api/garages/:id/messages", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { content } = req.body;
      
      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ error: "Message content is required" });
      }

      const message = await storage.createChatMessage({
        garageId: req.params.id,
        userId: req.userId!,
        content: content.trim(),
      });
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  app.post("/api/reports", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { reportedUserId, contentType, contentId, reason, details } = req.body;
      
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
        reporterId: req.userId!,
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
      
      const updated = await storage.updateUserProfile(req.userId!, updates);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const profile = await storage.getPublicProfile(req.userId!);
      res.json(profile);
    } catch (error) {
      console.error("Error updating current user profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
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
      // req.ip correctly uses X-Forwarded-For when trust proxy is enabled
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
      const { title, description, whyItMatters, price, priceRange, category, affiliateLink, vendor, imageUrl, isSponsored } = req.body;
      
      if (!title || typeof title !== "string" || title.length > 255) {
        return res.status(400).json({ error: "Valid title is required (max 255 chars)" });
      }
      if (!category || !PRODUCT_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: "Valid category is required" });
      }

      const product = await storage.createProduct({
        title,
        description: description || null,
        whyItMatters: whyItMatters || null,
        price: price || null,
        priceRange: priceRange || null,
        category,
        affiliateLink: affiliateLink || null,
        vendor: vendor || null,
        imageUrl: imageUrl || null,
        isSponsored: isSponsored || false,
      }, adminUserId);

      res.status(201).json(product);
    } catch (error) {
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

      const updates: Record<string, unknown> = {};
      const { title, description, whyItMatters, price, priceRange, category, affiliateLink, vendor, imageUrl, isSponsored, submissionStatus, featuredExpiration } = req.body;

      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (whyItMatters !== undefined) updates.whyItMatters = whyItMatters;
      if (price !== undefined) updates.price = price;
      if (priceRange !== undefined) updates.priceRange = priceRange;
      if (category !== undefined) {
        if (!PRODUCT_CATEGORIES.includes(category)) {
          return res.status(400).json({ error: "Invalid category" });
        }
        updates.category = category;
      }
      if (affiliateLink !== undefined) updates.affiliateLink = affiliateLink;
      if (vendor !== undefined) updates.vendor = vendor;
      if (imageUrl !== undefined) updates.imageUrl = imageUrl;
      if (isSponsored !== undefined) updates.isSponsored = isSponsored;
      if (submissionStatus !== undefined) {
        const validStatuses = ["pending", "approved", "featured"];
        if (!validStatuses.includes(submissionStatus)) {
          return res.status(400).json({ error: "Invalid submission status" });
        }
        updates.submissionStatus = submissionStatus;
      }
      if (featuredExpiration !== undefined) {
        updates.featuredExpiration = featuredExpiration ? new Date(featuredExpiration) : null;
      }

      const updated = await storage.updateProduct(req.params.id, updates);
      res.json(updated);
    } catch (error) {
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
      const { vin, year, make, model, nickname, imageUrl } = req.body;
      
      if (!nickname || typeof nickname !== "string" || nickname.trim().length === 0) {
        return res.status(400).json({ error: "Nickname is required" });
      }

      const vehicle = await storage.createVehicle({
        vin: vin || null,
        year: year ? parseInt(year) : null,
        make: make || null,
        model: model || null,
        nickname: nickname.trim(),
        imageUrl: imageUrl || null,
      }, req.userId!);

      res.status(201).json(vehicle);
    } catch (error) {
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

      const updates: Record<string, unknown> = {};
      const { vin, year, make, model, nickname, imageUrl } = req.body;
      if (vin !== undefined) updates.vin = vin;
      if (year !== undefined) updates.year = year ? parseInt(year) : null;
      if (make !== undefined) updates.make = make;
      if (model !== undefined) updates.model = model;
      if (nickname !== undefined) updates.nickname = nickname;
      if (imageUrl !== undefined) updates.imageUrl = imageUrl;

      const updated = await storage.updateVehicle(req.params.id, updates);
      res.json(updated);
    } catch (error) {
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

      const { title, content, isPrivate } = req.body;
      
      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json({ error: "Title is required" });
      }
      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ error: "Content is required" });
      }

      const note = await storage.createNote({
        vehicleId: req.params.vehicleId,
        title: title.trim(),
        content: content.trim(),
        isPrivate: isPrivate !== false,
      }, req.userId!);

      res.status(201).json(note);
    } catch (error) {
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

      const updates: Record<string, unknown> = {};
      const { title, content, isPrivate } = req.body;
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (isPrivate !== undefined) updates.isPrivate = isPrivate;

      const updated = await storage.updateNote(req.params.id, updates);
      res.json(updated);
    } catch (error) {
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
      const { title, content } = req.body;
      
      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json({ error: "Title is required" });
      }
      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ error: "Content is required" });
      }

      const thread = await storage.createThread({
        garageId: req.params.garageId,
        title: title.trim(),
        content: content.trim(),
      }, req.userId!);

      res.status(201).json(thread);
    } catch (error) {
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

      const updates: Record<string, unknown> = {};
      const { title, content, hasSolution, isPinned } = req.body;
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (hasSolution !== undefined) updates.hasSolution = hasSolution;
      if (isPinned !== undefined && req.userRole === "admin") updates.isPinned = isPinned;

      const updated = await storage.updateThread(req.params.id, updates);
      res.json(updated);
    } catch (error) {
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
      const { content } = req.body;
      
      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ error: "Content is required" });
      }

      const reply = await storage.createThreadReply({
        threadId: req.params.threadId,
        content: content.trim(),
      }, req.userId!);

      res.status(201).json(reply);
    } catch (error) {
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
      const { title, description, price, condition, location, localPickup, willShip, imageUrl } = req.body;
      
      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json({ error: "Title is required" });
      }
      if (!price || typeof price !== "string" || price.trim().length === 0) {
        return res.status(400).json({ error: "Price is required" });
      }
      if (!condition) {
        return res.status(400).json({ error: "Condition is required" });
      }

      const listing = await storage.createSwapShopListing({
        title: title.trim(),
        description: description || null,
        price: price.trim(),
        condition,
        location: location || null,
        localPickup: localPickup !== false,
        willShip: willShip === true,
        imageUrl: imageUrl || null,
      }, req.userId!);

      res.status(201).json(listing);
    } catch (error) {
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
      if (listing.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const updates: Record<string, unknown> = {};
      const { title, description, price, condition, location, localPickup, willShip, imageUrl, isActive } = req.body;
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (price !== undefined) updates.price = price;
      if (condition !== undefined) updates.condition = condition;
      if (location !== undefined) updates.location = location;
      if (localPickup !== undefined) updates.localPickup = localPickup;
      if (willShip !== undefined) updates.willShip = willShip;
      if (imageUrl !== undefined) updates.imageUrl = imageUrl;
      if (isActive !== undefined) updates.isActive = isActive;

      const updated = await storage.updateSwapShopListing(req.params.id, updates);
      res.json(updated);
    } catch (error) {
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
  
  setupWebSocket(httpServer);

  return httpServer;
}
