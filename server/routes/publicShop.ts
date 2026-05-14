// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import path from "node:path";
import { ZodError } from "zod";
import { createShopLeadSchema, type SellerProfile, type ShopService } from "@shared/schema";
import { storage } from "../storage";
import { getUserTier, tierHasFeature } from "../entitlements";
import { checkRateLimitAsync } from "../torque-assist";

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

export function register(app: Express): void {
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
      const clientId = `lead:${req.ip || "unknown"}:${req.params.slug}`;
      const allowed = await checkRateLimitAsync(clientId);
      if (!allowed) {
        return res.status(429).json({ error: "Too many submissions. Please wait a few minutes and try again." });
      }
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
      void (async () => {
        try {
          const { notifyOwnerAndTeamOfNewLead } = await import("../notifications");
          await notifyOwnerAndTeamOfNewLead({
            ownerUserId: profile.userId,
            customerName: parsed.customerName,
            issue: parsed.issue,
            vehicle: parsed.vehicle ?? null,
            leadId: created.id,
          });
        } catch (err) {
          console.warn("[notifications] lead notify failed", err);
        }
      })();
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
              // Slug + logo are safe identifiers used by the public summary
              // page header. Contact fields (phone/email/website) are only
              // surfaced when the shop has explicitly opted into a public
              // profile — otherwise the customer just sees the diagnostic
              // content with no way to reach the shop, matching the privacy
              // contract enforced on /api/public/shops/:slug.
              slug: profile.isPublic ? profile.slug : null,
              logoUrl: profile.logoUrl,
              phone: profile.isPublic ? profile.phone : null,
              email: profile.isPublic ? profile.email : null,
              website: profile.isPublic ? profile.website : null,
            }
          : null,
      });
    } catch (error) {
      console.error("Error fetching public summary:", error);
      res.status(500).json({ error: "Failed to load summary" });
    }
  });

  app.get("/public/diagnostic-summary/:token", async (_req: Request, res: Response) => {
    res.sendFile(path.resolve(process.cwd(), "server", "templates", "public-summary.html"));
  });

  app.get("/shops/:slug", async (req: Request, res: Response) => {
    const profile = await storage.getShopProfileBySlug(req.params.slug);
    if (!profile || !profile.isPublic) {
      return res.status(404).sendFile(path.resolve(process.cwd(), "server", "templates", "public-shop.html"));
    }
    res.sendFile(path.resolve(process.cwd(), "server", "templates", "public-shop.html"));
  });
}
