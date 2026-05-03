// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { requireFeature, requireFeatureOrTeam, userHasFeature, isUserBillingDelinquent, type Feature } from "../entitlements";

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
    "/api/shop-leads/export.csv",
    requireAuth,
    requireFeature("lead_capture"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (await isUserBillingDelinquent(req.userId!)) {
          return res.status(402).json({
            error: "Your last payment failed. Update your billing to continue using premium features.",
            billingPastDue: true,
            feature: "lead_capture",
          });
        }
        const allLeads = await storage.listShopLeads(req.userId!);
        const fromRaw = typeof req.query.from === "string" ? req.query.from : undefined;
        const toRaw = typeof req.query.to === "string" ? req.query.to : undefined;
        const parseBound = (v: string | undefined, end: boolean): Date | null => {
          if (!v) return null;
          const d = new Date(v);
          if (isNaN(d.getTime())) return null;
          // If only a date (YYYY-MM-DD) was provided, treat `to` as end of day.
          if (end && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
            d.setUTCHours(23, 59, 59, 999);
          }
          return d;
        };
        const fromDate = parseBound(fromRaw, false);
        const toDate = parseBound(toRaw, true);
        if ((fromRaw && !fromDate) || (toRaw && !toDate)) {
          return res.status(400).json({ error: "Invalid 'from' or 'to' date" });
        }
        const leads = allLeads.filter((l) => {
          if (!l.createdAt) return !fromDate && !toDate;
          const t = new Date(l.createdAt).getTime();
          if (fromDate && t < fromDate.getTime()) return false;
          if (toDate && t > toDate.getTime()) return false;
          return true;
        });
        const header = [
          "created_at",
          "name",
          "email",
          "phone",
          "vehicle",
          "issue",
          "preferred_contact",
          "read",
        ];
        // Neutralize spreadsheet formula injection: leads come from a public
        // form, so values starting with =, +, -, @, tab or CR/LF could be
        // interpreted as formulas by Excel/Sheets. Prefix with a single quote
        // before normal CSV quoting per OWASP guidance.
        const FORMULA_TRIGGER = /^[=+\-@\t\r\n]/;
        const escape = (v: unknown): string => {
          if (v === null || v === undefined) return "";
          let s = String(v);
          if (FORMULA_TRIGGER.test(s)) s = "'" + s;
          if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        };
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="shop-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        );
        res.write(header.join(",") + "\r\n");
        for (const l of leads) {
          const row = [
            l.createdAt ? new Date(l.createdAt).toISOString() : "",
            l.customerName,
            l.email ?? "",
            l.phone ?? "",
            l.vehicle ?? "",
            l.issue,
            l.preferredContact ?? "",
            l.isRead ? "yes" : "no",
          ];
          res.write(row.map(escape).join(",") + "\r\n");
        }
        res.end();
      } catch (error) {
        console.error("Error exporting leads CSV:", error);
        if (!res.headersSent) res.status(500).json({ error: "Failed to export leads" });
        else res.end();
      }
    },
  );

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
