// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { requireFeatureOrTeam, userHasFeature, type Feature } from "../entitlements";

// Resolve which owner IDs the requester can act on for a feature: requester themselves
// (only if they personally have the feature) plus any team owners that have the feature.
async function resolveAccessibleOwnerIdsForFeature(userId: string, feature: Feature): Promise<string[]> {
  const ids = new Set<string>();
  if (await userHasFeature(userId, feature)) ids.add(userId);
  const owners = await storage.getOwnersForTeamMember(userId);
  for (const o of owners) {
    if (await userHasFeature(o.ownerUserId, feature)) ids.add(o.ownerUserId);
  }
  return Array.from(ids);
}

export function register(app: Express): void {
  app.get(
    "/api/shop-leads",
    requireAuth,
    requireFeatureOrTeam("lead_capture"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const ownerIds = await resolveAccessibleOwnerIdsForFeature(req.userId!, "lead_capture");
        const all = await storage.listAccessibleShopLeads(req.userId!);
        const items = all.filter((l) => ownerIds.includes(l.ownerUserId));
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
    requireFeatureOrTeam("lead_capture"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const ownerIds = await resolveAccessibleOwnerIdsForFeature(req.userId!, "lead_capture");
        if (ownerIds.length === 0) return res.json({ count: 0 });
        const all = await storage.listAccessibleShopLeads(req.userId!);
        const count = all.filter((l) => ownerIds.includes(l.ownerUserId) && l.isRead === false).length;
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
    requireFeatureOrTeam("lead_capture"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const existing = await storage.getShopLead(req.params.id);
        if (!existing) return res.status(404).json({ error: "Lead not found" });
        // The lead's owner must have the lead_capture feature; otherwise no one can act on it.
        if (!(await userHasFeature(existing.ownerUserId, "lead_capture"))) {
          return res.status(402).json({ error: "Lead owner does not have an active Shop Pro subscription." });
        }
        const isOwner = existing.ownerUserId === req.userId;
        let allowed = isOwner;
        if (!allowed) {
          const role = await storage.getTeamRole(existing.ownerUserId, req.userId!);
          if (role === "admin" || role === "technician") allowed = true;
        }
        if (!allowed) return res.status(403).json({ error: "You do not have access to this lead" });
        const isRead = req.body?.isRead === true || req.body?.isRead === false ? req.body.isRead : true;
        const updated = await storage.markLeadRead(req.params.id, isRead);
        res.json(updated);
      } catch (error) {
        console.error("Error updating lead:", error);
        res.status(500).json({ error: "Failed to update lead" });
      }
    },
  );
}
