// AUTO-GENERATED from server/routes.ts split. See task #51.
import type { Express, Request, Response } from "express";
import { ZodError } from "zod";
import { updateProfileSchema, updateNotificationPrefsSchema } from "@shared/schema";
import { storage, type ProfileUpdate } from "../storage";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "../middleware/auth";
import { db } from "../db";
import { users, threadReplies } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { getUserTier } from "../entitlements";

export function register(app: Express): void {
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
        email: user.email ?? null,
        emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
        notificationsEnabled: user.notificationsEnabled ?? true,
        dailyLeadDigestEnabled: user.dailyLeadDigestEnabled ?? false,
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

  app.get("/api/users/me/notifications", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const [row] = await db
        .select({
          email: users.email,
          expoPushToken: users.expoPushToken,
          notificationsEnabled: users.notificationsEnabled,
          dailyLeadDigestEnabled: users.dailyLeadDigestEnabled,
          emailVerifiedAt: users.emailVerifiedAt,
        })
        .from(users)
        .where(eq(users.id, req.userId!));
      if (!row) return res.status(404).json({ error: "User not found" });
      const tier = await getUserTier(req.userId!);
      res.json({
        ...row,
        emailVerifiedAt: row.emailVerifiedAt ? row.emailVerifiedAt.toISOString() : null,
        canUseLeadDigest: tier === "shop_pro",
      });
    } catch (error) {
      console.error("Error loading notification prefs:", error);
      res.status(500).json({ error: "Failed to load notification preferences" });
    }
  });

  app.patch("/api/users/me/notifications", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = updateNotificationPrefsSchema.parse(req.body);
      const updates: Record<string, unknown> = {};
      let emailChanged = false;
      let normalizedEmail: string | null | undefined = undefined;
      if (parsed.email !== undefined) {
        normalizedEmail = parsed.email === "" ? null : parsed.email.toLowerCase().trim();
        updates.email = normalizedEmail;
      }
      if (parsed.expoPushToken !== undefined) updates.expoPushToken = parsed.expoPushToken === "" ? null : parsed.expoPushToken;
      if (parsed.notificationsEnabled !== undefined) updates.notificationsEnabled = parsed.notificationsEnabled;
      if (parsed.dailyLeadDigestEnabled !== undefined) updates.dailyLeadDigestEnabled = parsed.dailyLeadDigestEnabled;
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid updates provided" });
      }
      if (normalizedEmail !== undefined) {
        const [existing] = await db.select({ email: users.email }).from(users).where(eq(users.id, req.userId!));
        const prev = (existing?.email ?? null)?.toLowerCase() ?? null;
        const next = normalizedEmail ? normalizedEmail.toLowerCase() : null;
        if (prev !== next) {
          emailChanged = true;
          updates.emailVerifiedAt = null;
        }
      }
      await db.update(users).set(updates).where(eq(users.id, req.userId!));
      if (emailChanged) {
        await storage.invalidateEmailVerifications(req.userId!);
      }
      const [refreshed] = await db
        .select({
          email: users.email,
          expoPushToken: users.expoPushToken,
          notificationsEnabled: users.notificationsEnabled,
          dailyLeadDigestEnabled: users.dailyLeadDigestEnabled,
        })
        .from(users)
        .where(eq(users.id, req.userId!));
      res.json(refreshed ?? {});
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
      }
      console.error("Error updating notification prefs:", error);
      res.status(500).json({ error: "Failed to update notification preferences" });
    }
  });

  app.post("/api/admin/maintenance-reminders/run", requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const { runMaintenanceRemindersOnce } = await import("../maintenance-reminders");
      const stats = await runMaintenanceRemindersOnce();
      res.json(stats);
    } catch (error) {
      console.error("Error running maintenance reminders:", error);
      res.status(500).json({ error: "Failed to run reminders" });
    }
  });

  app.post("/api/admin/lead-digest/run", requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const { runLeadDigestOnce } = await import("../lead-digest");
      const stats = await runLeadDigestOnce();
      res.json(stats);
    } catch (error) {
      console.error("Error running lead digest:", error);
      res.status(500).json({ error: "Failed to run lead digest" });
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
      const fullProfile = await storage.getFullUserProfile(req.params.id);
      if (!fullProfile) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(fullProfile);
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

  app.get("/api/users/:id/trust-badges", async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const badges: { key: string; label: string; icon: string }[] = [];

      const solutionCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(threadReplies)
        .where(and(eq(threadReplies.userId, userId), eq(threadReplies.isSolution, true)));
      const solvedCount = solutionCount[0]?.count || 0;

      if (solvedCount >= 3) {
        badges.push({ key: "trusted-solver", label: "Trusted Solver", icon: "award" });
      }

      const userVehicles = await storage.getVehiclesByUser(userId);
      const hasVinVehicle = userVehicles.some((v) => v.vin && v.vin.length >= 11);
      if (hasVinVehicle) {
        badges.push({ key: "verified-owner", label: "Verified Owner", icon: "shield" });
      }

      const replyCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(threadReplies)
        .where(eq(threadReplies.userId, userId));
      const totalReplies = replyCount[0]?.count || 0;

      if (totalReplies >= 10) {
        badges.push({ key: "active-contributor", label: "Active Contributor", icon: "message-circle" });
      }

      res.json({
        badges,
        stats: { solvedCount, replyCount: totalReplies, vehicleCount: userVehicles.length },
      });
    } catch (error) {
      console.error("Error fetching trust badges:", error);
      res.status(500).json({ error: "Failed to fetch trust badges" });
    }
  });
}
