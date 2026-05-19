import type { Request, Response, NextFunction } from "express";
import type { SubscriptionTier } from "@shared/schema";
import { storage } from "./storage";
import type { AuthenticatedRequest } from "./middleware/auth";
import {
  ACCESS_GRANTING_SUBSCRIPTION_STATUSES,
  snapshotIsModuleDisabled,
  snapshotIsReadOnly,
  snapshotTier,
  type EntitlementSnapshot,
} from "./lib/operatorOsEntitlements";

export type Feature =
  | "advanced_diagnostic_tree"
  | "unlimited_saved_cases"
  | "pdf_repair_plan"
  | "full_parts_checklist"
  | "similar_solved_matching"
  | "priority_ai_followup"
  | "multi_vehicle"
  | "maintenance_tracking"
  | "advanced_repair_history"
  | "cost_tracking"
  | "build_logs"
  | "tool_inventory"
  | "advanced_listing_options"
  | "shop_profile"
  | "service_listings"
  | "lead_capture"
  | "team_access"
  | "credibility_profile"
  | "case_intake_workflow"
  | "customer_diagnostic_summaries";

// Local fallback: when OperatorOS supplies an access_level / plan_slug but
// omits an explicit `target_module_features` array, we expand the tier into
// the canonical TorqueShed feature set. When OperatorOS sends features
// explicitly, they win (so OperatorOS can grant/revoke individual features
// without us shipping new code).
const TIER_FEATURES: Record<SubscriptionTier, Feature[]> = {
  free: [],
  diy_pro: [
    "advanced_diagnostic_tree",
    "unlimited_saved_cases",
    "pdf_repair_plan",
    "full_parts_checklist",
    "similar_solved_matching",
    "priority_ai_followup",
  ],
  garage_pro: [
    "advanced_diagnostic_tree",
    "unlimited_saved_cases",
    "pdf_repair_plan",
    "full_parts_checklist",
    "similar_solved_matching",
    "priority_ai_followup",
    "multi_vehicle",
    "maintenance_tracking",
    "advanced_repair_history",
    "cost_tracking",
    "build_logs",
    "tool_inventory",
    "advanced_listing_options",
  ],
  shop_pro: [
    "advanced_diagnostic_tree",
    "unlimited_saved_cases",
    "pdf_repair_plan",
    "full_parts_checklist",
    "similar_solved_matching",
    "priority_ai_followup",
    "multi_vehicle",
    "maintenance_tracking",
    "advanced_repair_history",
    "cost_tracking",
    "build_logs",
    "tool_inventory",
    "advanced_listing_options",
    "shop_profile",
    "service_listings",
    "lead_capture",
    "team_access",
    "credibility_profile",
    "case_intake_workflow",
    "customer_diagnostic_summaries",
  ],
};

const FEATURE_MIN_TIER: Record<Feature, SubscriptionTier> = (() => {
  const map: Partial<Record<Feature, SubscriptionTier>> = {};
  const order: SubscriptionTier[] = ["free", "diy_pro", "garage_pro", "shop_pro"];
  for (const tier of order) {
    for (const feat of TIER_FEATURES[tier]) {
      if (!map[feat]) map[feat] = tier;
    }
  }
  return map as Record<Feature, SubscriptionTier>;
})();

const TIER_LABEL: Record<SubscriptionTier, string> = {
  free: "Free",
  diy_pro: "DIY Pro",
  garage_pro: "Garage Pro",
  shop_pro: "Shop Pro",
};

// Type guard for the JSON snapshot column.
function asSnapshot(raw: unknown): EntitlementSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.operatoros_user_id !== "string") return null;
  return raw as EntitlementSnapshot;
}

async function loadSnapshot(
  userId: string | undefined | null,
): Promise<EntitlementSnapshot | null> {
  if (!userId) return null;
  const u = await storage.getUser(userId);
  if (!u) return null;
  return asSnapshot(u.entitlementSnapshotJson);
}

export async function getUserTier(userId: string | undefined | null): Promise<SubscriptionTier> {
  const snap = await loadSnapshot(userId);
  return snapshotTier(snap);
}

export async function isUserBillingDelinquent(userId: string | undefined | null): Promise<boolean> {
  const snap = await loadSnapshot(userId);
  // Treat past_due as delinquent (matches legacy behaviour). When OperatorOS
  // omits status the user is considered current.
  return snap?.subscription_status === "past_due";
}

export async function isModuleDisabledForUser(userId: string | undefined | null): Promise<boolean> {
  const snap = await loadSnapshot(userId);
  return snapshotIsModuleDisabled(snap);
}

export async function isUserReadOnly(userId: string | undefined | null): Promise<boolean> {
  const snap = await loadSnapshot(userId);
  return snapshotIsReadOnly(snap);
}

export function tierHasFeature(tier: SubscriptionTier, feature: Feature): boolean {
  return TIER_FEATURES[tier]?.includes(feature) ?? false;
}

// Resolve the effective Feature[] for a user from their snapshot: OperatorOS
// explicit features win; otherwise expand from the access-level/plan tier.
function effectiveFeaturesFromSnapshot(snap: EntitlementSnapshot | null): Feature[] {
  if (!snap || !snap.enabled) return [];
  if (
    !ACCESS_GRANTING_SUBSCRIPTION_STATUSES.has(snap.subscription_status ?? "")
  ) {
    return [];
  }
  // When OperatorOS sends an explicit features array (even empty), it wins —
  // that lets them intentionally revoke individual features without us
  // shipping new code. Only fall back to tier expansion when features is
  // absent (null/undefined), signalled by `featuresExplicit !== true`.
  if (snap.featuresExplicit === true && Array.isArray(snap.features)) {
    return snap.features.filter((f): f is Feature => f in FEATURE_MIN_TIER);
  }
  return TIER_FEATURES[snapshotTier(snap)] ?? [];
}

export async function userFeatures(userId: string | undefined | null): Promise<Feature[]> {
  const snap = await loadSnapshot(userId);
  return effectiveFeaturesFromSnapshot(snap);
}

export async function userHasFeature(userId: string | undefined | null, feature: Feature): Promise<boolean> {
  const snap = await loadSnapshot(userId);
  return effectiveFeaturesFromSnapshot(snap).includes(feature);
}

export function minimumTierFor(feature: Feature): SubscriptionTier {
  return FEATURE_MIN_TIER[feature];
}

export function tierLabel(tier: SubscriptionTier): string {
  return TIER_LABEL[tier];
}

function isWriteMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function billingPastDueResponse(res: Response, feature: Feature) {
  return res.status(402).json({
    error: "Your subscription is past due in OperatorOS. Update billing there to continue using premium features.",
    billingPastDue: true,
    feature,
  });
}

export function requireFeature(feature: Feature) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const snap = await loadSnapshot(userId);
    if (snapshotIsModuleDisabled(snap)) {
      return res.status(403).json({ code: "module_disabled", managedBy: "operatoros" });
    }
    const features = effectiveFeaturesFromSnapshot(snap);
    if (!features.includes(feature)) {
      const required = minimumTierFor(feature);
      const tier = snapshotTier(snap);
      return res.status(402).json({
        error: `This feature requires ${TIER_LABEL[required]} or higher.`,
        upgradeRequired: true,
        managedBy: "operatoros",
        feature,
        currentTier: tier,
        requiredTier: required,
        requiredTierLabel: TIER_LABEL[required],
      });
    }
    if (isWriteMethod(req.method) && snap?.subscription_status === "past_due") {
      return billingPastDueResponse(res, feature);
    }
    (req as AuthenticatedRequest & { _tier?: SubscriptionTier })._tier = snapshotTier(snap);
    return next();
  };
}

export async function userOrTeamHasFeature(userId: string, feature: Feature): Promise<boolean> {
  if (await userHasFeature(userId, feature)) return true;
  const owners = await storage.getOwnersForTeamMember(userId);
  for (const o of owners) {
    if (await userHasFeature(o.ownerUserId, feature)) return true;
  }
  return false;
}

export function requireFeatureOrTeam(feature: Feature) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const snap = await loadSnapshot(userId);
    if (snapshotIsModuleDisabled(snap)) {
      return res.status(403).json({ code: "module_disabled", managedBy: "operatoros" });
    }
    if (!(await userOrTeamHasFeature(userId, feature))) {
      const required = minimumTierFor(feature);
      const tier = snapshotTier(snap);
      return res.status(402).json({
        error: `This feature requires ${TIER_LABEL[required]} or higher.`,
        upgradeRequired: true,
        managedBy: "operatoros",
        feature,
        currentTier: tier,
        requiredTier: required,
        requiredTierLabel: TIER_LABEL[required],
      });
    }
    if (isWriteMethod(req.method) && snap?.subscription_status === "past_due") {
      return billingPastDueResponse(res, feature);
    }
    return next();
  };
}

// Express middleware: 403 `module_disabled` for any authenticated request
// whose snapshot has enabled=false / access_level=none. Mounted on the
// `/api/*` router so it covers every route except the SSO callback and the
// public landing page. Anonymous requests fall through to per-route auth.
export async function moduleEnabledGate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = (req as AuthenticatedRequest).userId;
  if (!userId) return next();
  try {
    if (await isModuleDisabledForUser(userId)) {
      return res.status(403).json({ code: "module_disabled", managedBy: "operatoros" });
    }
  } catch {
    // Don't block on transient DB errors.
  }
  return next();
}
