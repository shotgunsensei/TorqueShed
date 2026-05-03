// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { insertThreadSchema, updateThreadSchema, updateThreadStatusSchema, markSolvedSchema } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { ObjectStorageService } from "../objectStorage";
import { userHasFeature } from "../entitlements";
import { db } from "../db";
import { threadReplies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hasThreadAccess, isObjectStillReferenced } from "./_shared";

export function register(app: Express): void {
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
      // Include the user's own cases plus any cases owned by Shop Pro accounts
      // they're a team member of (when the owner actually has team_access).
      const teamOwners = await storage.getOwnersForTeamMember(req.userId!);
      const accessibleOwnerIds = new Set<string>([req.userId!]);
      for (const o of teamOwners) {
        if (await userHasFeature(o.ownerUserId, "team_access")) {
          accessibleOwnerIds.add(o.ownerUserId);
        }
      }
      const mine = all
        .filter((t) => t.userId && accessibleOwnerIds.has(t.userId))
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          hasSolution: t.hasSolution,
          isOwn: t.userId === req.userId,
        }));
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
      const objectSvc = new ObjectStorageService();
      const normalizeList = (arr: unknown): string[] | null => {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        return arr
          .filter((u): u is string => typeof u === "string" && u.length > 0)
          .map((u) => objectSvc.normalizeObjectEntityPath(u));
      };

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
        photoUrls: normalizeList(req.body.photoUrls),
        videoUrls: normalizeList(req.body.videoUrls),
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

  app.get("/api/threads/:id/viewer-access", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.id);
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      const isAuthor = thread.userId === req.userId;
      let teamRole: string | null = null;
      if (!isAuthor && thread.userId) {
        const r = await storage.getTeamRole(thread.userId, req.userId!);
        teamRole = r ?? null;
      }
      const ownerHasTeamAccess = thread.userId ? await userHasFeature(thread.userId, "team_access") : false;
      const ownerHasSummaryFeature = thread.userId ? await userHasFeature(thread.userId, "customer_diagnostic_summaries") : false;
      const canManageSummary =
        ownerHasSummaryFeature && (isAuthor || (teamRole === "admin" || teamRole === "technician") && ownerHasTeamAccess);
      const canViewSummary =
        ownerHasSummaryFeature && (isAuthor || (!!teamRole && ownerHasTeamAccess));
      res.json({ isAuthor, teamRole, canManageSummary, canViewSummary });
    } catch (error) {
      console.error("Error getting viewer access:", error);
      res.status(500).json({ error: "Failed to load viewer access" });
    }
  });

  app.patch("/api/threads/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      if (!(await hasThreadAccess(thread, req.userId!, req.userRole, ["owner", "admin", "technician"]))) {
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
      if (!(await hasThreadAccess(thread, req.userId!, req.userRole, ["owner", "admin"]))) {
        return res.status(403).json({ error: "Forbidden" });
      }

      let replyMedia: Array<{ userId: string | null; photoUrls: string[] | null; videoUrls: string[] | null }> = [];
      try {
        replyMedia = await db
          .select({
            userId: threadReplies.userId,
            photoUrls: threadReplies.photoUrls,
            videoUrls: threadReplies.videoUrls,
          })
          .from(threadReplies)
          .where(eq(threadReplies.threadId, req.params.id));
      } catch (prefetchErr) {
        console.error("Error prefetching reply media for cleanup:", prefetchErr);
      }

      await storage.deleteThread(req.params.id);

      try {
        const objectSvc = new ObjectStorageService();
        const items: Array<{ url: string | null | undefined; ownerUserId: string | null | undefined }> = [];
        for (const url of thread.photoUrls ?? []) items.push({ url, ownerUserId: thread.userId });
        for (const url of thread.videoUrls ?? []) items.push({ url, ownerUserId: thread.userId });
        for (const r of replyMedia) {
          for (const url of r.photoUrls ?? []) items.push({ url, ownerUserId: r.userId });
          for (const url of r.videoUrls ?? []) items.push({ url, ownerUserId: r.userId });
        }
        await objectSvc.deleteOwnedObjects(items, {
          isStillReferenced: (url) => isObjectStillReferenced(url),
        });
      } catch (cleanupErr) {
        console.error("Error cleaning up thread objects:", cleanupErr);
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting thread:", error);
      res.status(500).json({ error: "Failed to delete thread" });
    }
  });

  app.patch("/api/threads/:id/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const thread = await storage.getThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      if (!(await hasThreadAccess(thread, req.userId!, req.userRole, ["owner", "admin", "technician"]))) {
        return res.status(403).json({ error: "Only the case owner or shop team can change status" });
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
      if (!(await hasThreadAccess(thread, req.userId!, req.userRole, ["owner", "admin", "technician"]))) {
        return res.status(403).json({ error: "Only the case owner or shop team can mark solved" });
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
}
