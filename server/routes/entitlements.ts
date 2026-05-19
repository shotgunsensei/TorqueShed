// OperatorOS is the source of truth for plans/entitlements (task #68).
// - GET /api/entitlements/me — returns the cached snapshot for the signed-in user.
// - POST /api/operatoros/entitlements/sync — service-to-service push from OperatorOS.
import type { Express, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { getOperatorOsServiceToken } from "../lib/operatorOsSso";
import {
  snapshotIsModuleDisabled,
  snapshotIsReadOnly,
  snapshotLocalRole,
  snapshotTier,
  type EntitlementSnapshot,
} from "../lib/operatorOsEntitlements";
import { userFeatures } from "../entitlements";

const accessLevelSchema = z.enum(["none", "viewer", "user", "admin", "owner"]);

// Accept both the canonical nested shape and a flat shape OperatorOS may
// send. Returns a normalized EntitlementSnapshot.
const syncBodySchema = z.object({
  operatoros_user_id: z.string().min(1),
  operatoros_tenant_id: z.string().nullish(),
  module_key: z.string().min(1),
  enabled: z.boolean(),
  access_level: accessLevelSchema,
  features: z.array(z.string()).optional(),
  role: z.string().nullish(),
  module_role: z.string().nullish(),
  plan_slug: z.string().nullish(),
  subscription_status: z.string().nullish(),
  email: z.string().nullish(),
  name: z.string().nullish(),
});

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export function register(app: Express): void {
  app.get("/api/entitlements/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });
      const snap = (user.entitlementSnapshotJson as EntitlementSnapshot | null) ?? null;
      const tier = snapshotTier(snap);
      const features = await userFeatures(user.id);
      res.json({
        managedBy: "operatoros",
        userId: user.id,
        operatorOsUserId: user.operatorOsUserId,
        operatorOsTenantId: user.operatorOsTenantId,
        enabled: snap ? snap.enabled : true,
        moduleDisabled: snapshotIsModuleDisabled(snap),
        readOnly: snapshotIsReadOnly(snap),
        accessLevel: snap?.access_level ?? null,
        role: user.role ?? "user",
        tier,
        planSlug: snap?.plan_slug ?? null,
        subscriptionStatus: snap?.subscription_status ?? null,
        features,
        snapshot: snap,
        lastSyncAt: user.lastEntitlementSyncAt?.toISOString() ?? null,
        manageBillingUrl: process.env.OPERATOROS_BASE_URL || null,
      });
    } catch (error) {
      console.error("[entitlements] /me failed", error);
      res.status(500).json({ error: "Failed to load entitlements" });
    }
  });

  app.post("/api/operatoros/entitlements/sync", async (req: Request, res: Response) => {
    const expected = getOperatorOsServiceToken();
    if (!expected) {
      return res.status(503).json({ error: "OPERATOROS_SERVICE_TOKEN not configured" });
    }
    const header = req.header("X-OperatorOS-Service-Token") ?? "";
    if (!constantTimeEqual(header, expected)) {
      return res.status(401).json({ code: "unauthorized" });
    }
    const parsed = syncBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors.map((e) => e.message).join(", ") });
    }
    const body = parsed.data;
    const user = await storage.getUserByOperatorOsId(body.operatoros_user_id);
    if (!user) {
      return res.status(404).json({ code: "user_not_found" });
    }
    const featuresExplicit = Array.isArray(body.features);
    const snapshot: EntitlementSnapshot = {
      operatoros_user_id: body.operatoros_user_id,
      operatoros_tenant_id: body.operatoros_tenant_id ?? null,
      module_key: body.module_key.toLowerCase(),
      enabled: body.enabled,
      access_level: body.access_level,
      features: featuresExplicit ? (body.features as string[]) : [],
      featuresExplicit,
      role: body.role ?? null,
      module_role: body.module_role ?? null,
      plan_slug: body.plan_slug ?? null,
      subscription_status: body.subscription_status ?? null,
      email: body.email ?? null,
      name: body.name ?? null,
      updated_at: new Date().toISOString(),
    };
    const localRole = snapshotLocalRole(snapshot);
    const updated = await storage.updateUserEntitlementSnapshot(user.id, snapshot, localRole);
    res.json({
      ok: true,
      userId: updated?.id ?? user.id,
      tier: snapshotTier(snapshot),
      role: localRole,
      enabled: snapshot.enabled,
    });
  });
}
