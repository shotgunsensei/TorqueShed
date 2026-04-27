import { useQuery } from "@tanstack/react-query";

export type Tier = "free" | "diy_pro" | "garage_pro" | "shop_pro";

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

const TIER_FEATURES: Record<Tier, Feature[]> = {
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

export const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  diy_pro: "DIY Pro",
  garage_pro: "Garage Pro",
  shop_pro: "Shop Pro",
};

export const TIER_ORDER: Tier[] = ["free", "diy_pro", "garage_pro", "shop_pro"];

export function tierIndex(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

export const FREE_SAVED_THREAD_LIMIT = 3;

export type StripeMode = "live" | "test" | "missing_config";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete";

export interface SubscriptionInfo {
  tier: Tier;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeSubscription: boolean;
  stripeConfigured: boolean;
  stripeMode: StripeMode;
  hasStripeCustomer: boolean;
  isBillingDelinquent: boolean;
  webhookConfigured: boolean;
  prices: Record<Tier, { monthly: number; label: string }>;
  tierPriceIds: Record<Exclude<Tier, "free">, string | null>;
}

export function useEntitlements() {
  const query = useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscription"],
    staleTime: 60_000,
  });

  const tier: Tier = query.data?.tier ?? "free";
  const features = TIER_FEATURES[tier] ?? [];

  return {
    tier,
    isPaid: tier !== "free",
    stripeConfigured: query.data?.stripeConfigured ?? false,
    stripeMode: query.data?.stripeMode ?? "missing_config",
    isBillingDelinquent: query.data?.isBillingDelinquent ?? false,
    hasStripeCustomer: query.data?.hasStripeCustomer ?? false,
    isLoading: query.isLoading,
    hasFeature: (key: Feature) => features.includes(key),
    subscription: query.data,
    refetch: query.refetch,
  };
}
