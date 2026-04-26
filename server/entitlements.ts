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

export async function getUserTier(userId: string | undefined | null): Promise<SubscriptionTier> {
  if (!userId) return "free";
  const sub = await storage.getSubscription(userId);
  if (!sub) return "free";
  if (sub.status !== "active" && sub.status !== "trialing") return "free";
  return (sub.tier as SubscriptionTier) ?? "free";
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

export function requireFeature(feature: Feature) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const tier = await getUserTier(userId);
    if (tierHasFeature(tier, feature)) {
      (req as AuthenticatedRequest & { _tier?: SubscriptionTier })._tier = tier;
      return next();
    }
    const required = minimumTierFor(feature);
    return res.status(402).json({
      error: `This feature requires ${TIER_LABEL[required]} or higher.`,
      upgradeRequired: true,
      feature,
      currentTier: tier,
      requiredTier: required,
      requiredTierLabel: TIER_LABEL[required],
    });
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
    if (await userOrTeamHasFeature(userId, feature)) {
      return next();
    }
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
  };
}
