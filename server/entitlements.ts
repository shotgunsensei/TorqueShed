import type { Request, Response, NextFunction } from "express";
import type { SubscriptionTier } from "@shared/schema";
import { storage } from "./storage";
import type { AuthenticatedRequest } from "./middleware/auth";

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

// Statuses that keep premium access. `past_due` keeps read access for paid
// features so the user isn't locked out of their own data while they fix the
// payment method, but write actions should warn (handled in the UI via
// `isBillingDelinquent`).
const ACCESS_GRANTING_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function getUserTier(userId: string | undefined | null): Promise<SubscriptionTier> {
  if (!userId) return "free";
  const sub = await storage.getSubscription(userId);
  if (!sub) return "free";
  if (!ACCESS_GRANTING_STATUSES.has(sub.status)) return "free";
  return (sub.tier as SubscriptionTier) ?? "free";
}

export async function isUserBillingDelinquent(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  const sub = await storage.getSubscription(userId);
  return sub?.status === "past_due";
}

export function tierHasFeature(tier: SubscriptionTier, feature: Feature): boolean {
  return TIER_FEATURES[tier]?.includes(feature) ?? false;
}

export async function userHasFeature(userId: string | undefined | null, feature: Feature): Promise<boolean> {
  const tier = await getUserTier(userId);
  return tierHasFeature(tier, feature);
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
    error: "Your last payment failed. Update your billing to continue using premium features.",
    billingPastDue: true,
    feature,
  });
}

export function requireFeature(feature: Feature) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const tier = await getUserTier(userId);
    if (!tierHasFeature(tier, feature)) {
      const required = minimumTierFor(feature);
      return res.status(402).json({
        error: `This feature requires ${TIER_LABEL[required]} or higher.`,
        upgradeRequired: true,
        feature,
        currentTier: tier,
        requiredTier: required,
        requiredTierLabel: TIER_LABEL[required],
      });
    }
    // Past-due users keep read access but premium write actions are paused.
    if (isWriteMethod(req.method) && (await isUserBillingDelinquent(userId))) {
      return billingPastDueResponse(res, feature);
    }
    (req as AuthenticatedRequest & { _tier?: SubscriptionTier })._tier = tier;
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
    if (!(await userOrTeamHasFeature(userId, feature))) {
      const required = minimumTierFor(feature);
      const tier = await getUserTier(userId);
      return res.status(402).json({
        error: `This feature requires ${TIER_LABEL[required]} or higher.`,
        upgradeRequired: true,
        feature,
        currentTier: tier,
        requiredTier: required,
        requiredTierLabel: TIER_LABEL[required],
      });
    }
    if (isWriteMethod(req.method) && (await isUserBillingDelinquent(userId))) {
      return billingPastDueResponse(res, feature);
    }
    return next();
  };
}
