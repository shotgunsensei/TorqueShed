// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { inviteTeamMemberSchema } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { requireFeature, userHasFeature } from "../entitlements";

export function register(app: Express): void {
  app.get(
    "/api/shop-team/memberships",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const owners = await storage.getOwnersForTeamMember(req.userId!);
        const enriched = await Promise.all(
          owners.map(async (o) => ({
            ownerUserId: o.ownerUserId,
            role: o.role,
            ownerHasTeamAccess: await userHasFeature(o.ownerUserId, "team_access"),
            ownerHasLeadCapture: await userHasFeature(o.ownerUserId, "lead_capture"),
            ownerHasCustomerSummaries: await userHasFeature(
              o.ownerUserId,
              "customer_diagnostic_summaries",
            ),
          })),
        );
        res.json({ memberships: enriched });
      } catch (error) {
        console.error("Error listing memberships:", error);
        res.status(500).json({ error: "Failed to load memberships" });
      }
    },
  );

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
}
