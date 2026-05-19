import type { SubscriptionTier } from "@shared/schema";
import type { OperatorOsAccessLevel } from "./operatorOsSso";

// The canonical shape we persist on users.entitlement_snapshot_json and
// return from /api/entitlements/me. OperatorOS is the source of truth.
export interface EntitlementSnapshot {
  operatoros_user_id: string;
  operatoros_tenant_id: string | null;
  module_key: string;
  enabled: boolean;
  access_level: OperatorOsAccessLevel;
  features: string[];
  role: string | null;
  module_role: string | null;
  plan_slug: string | null;
  subscription_status: string | null;
  email: string | null;
  name: string | null;
  updated_at: string;
}

// Statuses delivered by OperatorOS that still grant access. Anything else
// (`canceled`, `incomplete`, `unpaid`, …) maps to enabled=false at read time.
export const ACCESS_GRANTING_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "ok",
  "in_trial",
  "", // missing/unspecified is treated as "no billing constraint"
]);

// OperatorOS access level → local TorqueShed tier. `viewer` collapses to
// `free` (read-only is enforced separately via isReadOnlyRole below).
const ACCESS_LEVEL_TO_TIER: Record<OperatorOsAccessLevel, SubscriptionTier> = {
  none: "free",
  viewer: "free",
  user: "diy_pro",
  admin: "garage_pro",
  owner: "shop_pro",
};

// Optional plan_slug override → tier. If OperatorOS sends an explicit
// plan_slug that matches a TorqueShed tier name, prefer that mapping so a
// "garage_pro" plan_slug always lands on garage_pro even if access_level is
// `user`. Falls back to ACCESS_LEVEL_TO_TIER.
const PLAN_SLUG_TO_TIER: Record<string, SubscriptionTier> = {
  free: "free",
  diy_pro: "diy_pro",
  garage_pro: "garage_pro",
  shop_pro: "shop_pro",
};

export function snapshotTier(snap: EntitlementSnapshot | null | undefined): SubscriptionTier {
  if (!snap) return "free";
  if (!snap.enabled) return "free";
  if (!ACCESS_GRANTING_SUBSCRIPTION_STATUSES.has(snap.subscription_status ?? "")) {
    return "free";
  }
  if (snap.plan_slug && PLAN_SLUG_TO_TIER[snap.plan_slug]) {
    return PLAN_SLUG_TO_TIER[snap.plan_slug];
  }
  return ACCESS_LEVEL_TO_TIER[snap.access_level] ?? "free";
}

// True when the snapshot indicates the user should NOT have access to the
// app at all (module disabled or access_level=none). Drives the 403
// `module_disabled` response + the client AccessDeniedScreen.
export function snapshotIsModuleDisabled(snap: EntitlementSnapshot | null | undefined): boolean {
  if (!snap) return false; // back-compat: no snapshot yet → allow (legacy flow)
  if (snap.enabled === false) return true;
  if (snap.access_level === "none") return true;
  return false;
}

export function snapshotIsReadOnly(snap: EntitlementSnapshot | null | undefined): boolean {
  if (!snap) return false;
  return snap.access_level === "viewer";
}

// Map OperatorOS role + access_level → local users.role ("admin" | "user").
// Documented mapping from the task plan:
//   - owner / (tenant_admin + module_admin) / module_admin → admin
//   - module_user → user
//   - viewer → user (read-only enforced separately)
//   - none / disabled → user (but module-disabled gate denies them anyway)
export function snapshotLocalRole(snap: EntitlementSnapshot | null | undefined): "admin" | "user" {
  if (!snap || !snap.enabled) return "user";
  if (snap.access_level === "owner" || snap.access_level === "admin") return "admin";
  const rawRole = (snap.module_role || snap.role || "").toLowerCase();
  if (
    rawRole === "owner" ||
    rawRole === "module_admin" ||
    rawRole === "tenant_admin" ||
    rawRole === "admin"
  ) {
    return "admin";
  }
  return "user";
}

// Build a fresh snapshot from a verified SSO claim payload. Unknown fields
// fall back to sensible defaults so the minimal claim set still produces a
// valid snapshot.
export interface SnapshotInputClaims {
  sub: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  module_role?: string | null;
  plan_slug?: string | null;
  organization_id?: string | null;
  tenant_id?: string | null;
  target_module_key?: string | null;
  target_module_enabled?: boolean | null;
  target_module_access_level?: OperatorOsAccessLevel | null;
  target_module_features?: string[] | null;
  subscription_status?: string | null;
}

export function buildSnapshotFromClaims(
  claims: SnapshotInputClaims,
  fallbackModuleKey: string,
): EntitlementSnapshot {
  // When OperatorOS omits the rich entitlement claims (older tokens), default
  // to enabled=true / access_level=user so the launch still works — the
  // server-to-server sync endpoint will replace this with the real snapshot.
  const enabled =
    typeof claims.target_module_enabled === "boolean"
      ? claims.target_module_enabled
      : true;
  const accessLevel: OperatorOsAccessLevel =
    claims.target_module_access_level || "user";
  const features = Array.isArray(claims.target_module_features)
    ? claims.target_module_features.filter((f) => typeof f === "string")
    : [];
  return {
    operatoros_user_id: claims.sub,
    operatoros_tenant_id: claims.tenant_id ?? claims.organization_id ?? null,
    module_key: (claims.target_module_key || fallbackModuleKey || "").toLowerCase(),
    enabled,
    access_level: accessLevel,
    features,
    role: claims.role ?? null,
    module_role: claims.module_role ?? null,
    plan_slug: claims.plan_slug ?? null,
    subscription_status: claims.subscription_status ?? null,
    email: claims.email ?? null,
    name: claims.name ?? null,
    updated_at: new Date().toISOString(),
  };
}
