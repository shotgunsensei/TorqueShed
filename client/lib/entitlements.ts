// Task #68 — OperatorOS is the source of truth for plans/entitlements.
// useEntitlements reads from /api/entitlements/me (populated by the
// OperatorOS SSO JWT and the server-to-server sync endpoint). The legacy
// /api/subscription endpoint is no longer used for access decisions.
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
export const FREE_VEHICLE_LIMIT = 1;
export const FREE_LISTING_LIMIT = 3;

// Legacy types kept for screens that still display the old subscription
// shape. With OperatorOS in charge of billing, Stripe-specific fields are
// always stubbed as "missing_config" / false on the client.
export type StripeMode = "live" | "test" | "missing_config";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete";
export type BillingInterval = "month" | "year";

export type AccessLevel = "none" | "viewer" | "user" | "admin" | "owner";

export interface EntitlementSnapshot {
  operatoros_user_id: string;
  operatoros_tenant_id: string | null;
  module_key: string;
  enabled: boolean;
  access_level: AccessLevel;
  features: string[];
  role: string | null;
  module_role: string | null;
  plan_slug: string | null;
  subscription_status: string | null;
  email: string | null;
  name: string | null;
  updated_at: string;
}

export interface EntitlementsResponse {
  managedBy: "operatoros";
  userId: string;
  operatorOsUserId: string | null;
  operatorOsTenantId: string | null;
  enabled: boolean;
  moduleDisabled: boolean;
  readOnly: boolean;
  accessLevel: AccessLevel | null;
  role: string;
  tier: Tier;
  planSlug: string | null;
  subscriptionStatus: string | null;
  features: Feature[];
  snapshot: EntitlementSnapshot | null;
  lastSyncAt: string | null;
  manageBillingUrl: string | null;
}

// Back-compat shape so existing screens (Billing, Subscription, TrialReminder)
// still compile. With OperatorOS as the source of truth, the Stripe-specific
// fields are stubbed; the "real" subscription data lives in OperatorOS.
export interface SubscriptionInfo {
  tier: Tier;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  latestInvoiceStatus: string | null;
  paymentMethodLast4: string | null;
  hasStripeSubscription: boolean;
  stripeConfigured: boolean;
  stripeMode: StripeMode;
  hasStripeCustomer: boolean;
  isBillingDelinquent: boolean;
  webhookConfigured: boolean;
  prices: Record<Tier, { monthly: number; yearly?: number; label: string }>;
  tierPriceIds: Record<Exclude<Tier, "free">, string | null>;
  interval: BillingInterval | null;
  trialEndsAt: string | null;
  trialEligible: boolean;
  trialPeriodDays: number;
  annualPricesConfigured: boolean;
}

function statusFor(raw: string | null | undefined): SubscriptionStatus {
  switch (raw) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
      return raw;
    default:
      return "active";
  }
}

export function useEntitlements() {
  const query = useQuery<EntitlementsResponse>({
    queryKey: ["/api/entitlements/me"],
    staleTime: 60_000,
  });

  const data = query.data;
  const tier: Tier = data?.tier ?? "free";
  const features: Feature[] = data?.features ?? [];
  const isBillingDelinquent = data?.subscriptionStatus === "past_due";

  // Legacy adapter so existing screens (Billing/SubscriptionScreen/
  // TrialReminderBanner) keep working unchanged.
  const subscription: SubscriptionInfo = {
    tier,
    status: statusFor(data?.subscriptionStatus),
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    latestInvoiceStatus: null,
    paymentMethodLast4: null,
    hasStripeSubscription: false,
    stripeConfigured: false,
    stripeMode: "missing_config",
    hasStripeCustomer: false,
    isBillingDelinquent,
    webhookConfigured: false,
    prices: {
      free: { monthly: 0, label: "Free" },
      diy_pro: { monthly: 999, label: "DIY Pro" },
      garage_pro: { monthly: 2900, label: "Garage Pro" },
      shop_pro: { monthly: 7900, label: "Shop Pro" },
    },
    tierPriceIds: { diy_pro: null, garage_pro: null, shop_pro: null },
    interval: null,
    trialEndsAt: null,
    trialEligible: false,
    trialPeriodDays: 14,
    annualPricesConfigured: false,
  };

  return {
    tier,
    isPaid: tier !== "free",
    stripeConfigured: false,
    stripeMode: "missing_config" as StripeMode,
    isBillingDelinquent,
    hasStripeCustomer: false,
    isLoading: query.isLoading,
    moduleDisabled: data?.moduleDisabled ?? false,
    readOnly: data?.readOnly ?? false,
    accessLevel: data?.accessLevel ?? null,
    role: data?.role ?? "user",
    manageBillingUrl: data?.manageBillingUrl ?? null,
    entitlements: data ?? null,
    hasFeature: (key: Feature) => features.includes(key),
    subscription,
    refetch: query.refetch,
  };
}
