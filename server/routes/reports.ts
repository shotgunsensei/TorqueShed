// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { createReportSchema } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "../middleware/auth";
import { db } from "../db";
import { reports, threads, threadReplies, swapShopListings } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export function register(app: Express): void {
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
}
