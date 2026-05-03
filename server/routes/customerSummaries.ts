// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { ZodError } from "zod";
import { upsertCustomerSummarySchema } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { requireFeatureOrTeam, userHasFeature } from "../entitlements";

function mapSummaryForOwner(row: Awaited<ReturnType<typeof storage.getCustomerSummaryByCase>>) {
  if (!row) return null;
  const { token, ...rest } = row as typeof row & { token: string };
  return { ...rest, shareToken: token };
}

async function getCaseAccessOwnerForSummary(
  caseId: string,
  userId: string,
  allowedTeamRoles: ("owner" | "admin" | "technician" | "viewer")[] = ["owner", "admin", "technician", "viewer"],
): Promise<{ thread: NonNullable<Awaited<ReturnType<typeof storage.getThread>>>; ownerUserId: string } | null> {
  const access = await storage.getThreadAccessOwner(caseId, userId);
  if (!access) return null;
  const thread = await storage.getThread(caseId);
  if (!thread) return null;
  if (access.isAuthor) return { thread, ownerUserId: access.ownerUserId };
  if (access.role && (allowedTeamRoles as string[]).includes(access.role)) {
    if (await userHasFeature(access.ownerUserId, "team_access")) {
      return { thread, ownerUserId: access.ownerUserId };
    }
  }
  return null;
}

export function register(app: Express): void {
  app.get(
    "/api/cases/:caseId/customer-summary",
    requireAuth,
    requireFeatureOrTeam("customer_diagnostic_summaries"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const access = await getCaseAccessOwnerForSummary(req.params.caseId, req.userId!);
        if (!access) return res.status(403).json({ error: "You do not have access to this case." });
        if (!(await userHasFeature(access.ownerUserId, "customer_diagnostic_summaries"))) {
          return res.status(402).json({ error: "Case owner does not have an active Shop Pro subscription." });
        }
        const summary = await storage.getCustomerSummaryByCase(req.params.caseId);
        res.json({ summary: mapSummaryForOwner(summary) });
      } catch (error) {
        console.error("Error fetching customer summary:", error);
        res.status(500).json({ error: "Failed to load summary" });
      }
    },
  );

  app.post(
    "/api/cases/:caseId/customer-summary",
    requireAuth,
    requireFeatureOrTeam("customer_diagnostic_summaries"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const access = await getCaseAccessOwnerForSummary(req.params.caseId, req.userId!, ["owner", "admin", "technician"]);
        if (!access) return res.status(403).json({ error: "You do not have write access to this case." });
        if (!(await userHasFeature(access.ownerUserId, "customer_diagnostic_summaries"))) {
          return res.status(402).json({ error: "Case owner does not have an active Shop Pro subscription." });
        }
        const parsed = upsertCustomerSummarySchema.parse(req.body);
        const token = crypto.randomBytes(24).toString("hex");
        const saved = await storage.upsertCustomerSummary(req.params.caseId, access.ownerUserId, parsed, token);
        res.json(mapSummaryForOwner(saved));
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
    requireFeatureOrTeam("customer_diagnostic_summaries"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const access = await getCaseAccessOwnerForSummary(req.params.caseId, req.userId!, ["owner", "admin", "technician"]);
        if (!access) return res.status(403).json({ error: "You do not have write access to this case." });
        if (!(await userHasFeature(access.ownerUserId, "customer_diagnostic_summaries"))) {
          return res.status(402).json({ error: "Case owner does not have an active Shop Pro subscription." });
        }
        const newToken = crypto.randomBytes(24).toString("hex");
        const updated = await storage.rotateCustomerSummaryToken(req.params.caseId, newToken);
        if (!updated) return res.status(404).json({ error: "No summary to rotate" });
        res.json(mapSummaryForOwner(updated));
      } catch (error) {
        console.error("Error rotating summary token:", error);
        res.status(500).json({ error: "Failed to rotate token" });
      }
    },
  );

  app.delete(
    "/api/cases/:caseId/customer-summary",
    requireAuth,
    requireFeatureOrTeam("customer_diagnostic_summaries"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const access = await getCaseAccessOwnerForSummary(req.params.caseId, req.userId!, ["owner", "admin", "technician"]);
        if (!access) return res.status(403).json({ error: "You do not have write access to this case." });
        if (!(await userHasFeature(access.ownerUserId, "customer_diagnostic_summaries"))) {
          return res.status(402).json({ error: "Case owner does not have an active Shop Pro subscription." });
        }
        await storage.revokeCustomerSummary(req.params.caseId);
        res.json({ ok: true });
      } catch (error) {
        console.error("Error revoking summary:", error);
        res.status(500).json({ error: "Failed to revoke summary" });
      }
    },
  );
}
