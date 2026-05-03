// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { insertProductSchema, updateProductSchema } from "@shared/schema";
import { storage } from "../storage";
import { requireAdmin, type AuthenticatedRequest } from "../middleware/auth";
import { rateLimited } from "../lib/rateLimit";

export function register(app: Express): void {
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

  app.post("/api/products/:id/click", rateLimited("public:product-click", 60, 60 * 1000), async (req: Request, res: Response) => {
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
}
