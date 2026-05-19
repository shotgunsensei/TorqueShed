import { describe, it, expect } from "vitest";
import {
  snapshotTier,
  snapshotIsModuleDisabled,
  snapshotIsReadOnly,
  snapshotLocalRole,
  buildSnapshotFromClaims,
  type EntitlementSnapshot,
} from "../server/lib/operatorOsEntitlements";

function snap(over: Partial<EntitlementSnapshot> = {}): EntitlementSnapshot {
  return {
    operatoros_user_id: "u_1",
    operatoros_tenant_id: null,
    module_key: "torqueshed",
    enabled: true,
    access_level: "user",
    features: [],
    role: null,
    module_role: null,
    plan_slug: null,
    subscription_status: "active",
    email: null,
    name: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("snapshotTier", () => {
  it("maps access_level → tier when no plan_slug override", () => {
    expect(snapshotTier(snap({ access_level: "none" }))).toBe("free");
    expect(snapshotTier(snap({ access_level: "viewer" }))).toBe("free");
    expect(snapshotTier(snap({ access_level: "user" }))).toBe("diy_pro");
    expect(snapshotTier(snap({ access_level: "admin" }))).toBe("garage_pro");
    expect(snapshotTier(snap({ access_level: "owner" }))).toBe("shop_pro");
  });

  it("plan_slug overrides access_level when set", () => {
    expect(snapshotTier(snap({ access_level: "user", plan_slug: "shop_pro" }))).toBe("shop_pro");
    expect(snapshotTier(snap({ access_level: "owner", plan_slug: "free" }))).toBe("free");
  });

  it("collapses to free when subscription_status revokes access", () => {
    expect(snapshotTier(snap({ access_level: "owner", subscription_status: "canceled" }))).toBe(
      "free",
    );
    expect(snapshotTier(snap({ access_level: "owner", subscription_status: "unpaid" }))).toBe(
      "free",
    );
  });

  it("missing snapshot or disabled snapshot → free", () => {
    expect(snapshotTier(null)).toBe("free");
    expect(snapshotTier(snap({ enabled: false, access_level: "owner" }))).toBe("free");
  });

  it("treats trialing / past_due as still granting access", () => {
    expect(snapshotTier(snap({ access_level: "admin", subscription_status: "trialing" }))).toBe(
      "garage_pro",
    );
    expect(snapshotTier(snap({ access_level: "admin", subscription_status: "past_due" }))).toBe(
      "garage_pro",
    );
  });
});

describe("snapshotIsModuleDisabled", () => {
  it("returns true when enabled=false or access_level=none", () => {
    expect(snapshotIsModuleDisabled(snap({ enabled: false }))).toBe(true);
    expect(snapshotIsModuleDisabled(snap({ access_level: "none" }))).toBe(true);
  });
  it("returns false for normal snapshot or missing snapshot (legacy)", () => {
    expect(snapshotIsModuleDisabled(snap())).toBe(false);
    expect(snapshotIsModuleDisabled(null)).toBe(false);
  });
});

describe("snapshotIsReadOnly", () => {
  it("true only for viewer", () => {
    expect(snapshotIsReadOnly(snap({ access_level: "viewer" }))).toBe(true);
    expect(snapshotIsReadOnly(snap({ access_level: "user" }))).toBe(false);
    expect(snapshotIsReadOnly(null)).toBe(false);
  });
});

describe("snapshotLocalRole", () => {
  it("tenant owner (access_level=owner) → admin", () => {
    expect(snapshotLocalRole(snap({ access_level: "owner" }))).toBe("admin");
    expect(snapshotLocalRole(snap({ role: "owner" }))).toBe("admin");
    expect(snapshotLocalRole(snap({ module_role: "owner" }))).toBe("admin");
  });
  it("module admin → admin", () => {
    expect(snapshotLocalRole(snap({ module_role: "module_admin" }))).toBe("admin");
    expect(snapshotLocalRole(snap({ role: "module_admin" }))).toBe("admin");
  });
  it("tenant_admin + module_admin conjunction → admin", () => {
    expect(
      snapshotLocalRole(snap({ role: "tenant_admin", module_role: "module_admin" })),
    ).toBe("admin");
  });
  it("tenant_admin alone (no module_admin) → user (no over-grant)", () => {
    expect(snapshotLocalRole(snap({ module_role: "tenant_admin" }))).toBe("user");
    expect(snapshotLocalRole(snap({ role: "tenant_admin" }))).toBe("user");
    // access_level=admin without module_admin role is NOT enough
    expect(snapshotLocalRole(snap({ access_level: "admin" }))).toBe("user");
  });
  it("disabled snapshot → user (even if owner)", () => {
    expect(snapshotLocalRole(snap({ enabled: false, access_level: "owner" }))).toBe("user");
    expect(
      snapshotLocalRole(snap({ enabled: false, module_role: "module_admin" })),
    ).toBe("user");
  });
  it("plain user / viewer / none → user", () => {
    expect(snapshotLocalRole(snap({ access_level: "user" }))).toBe("user");
    expect(snapshotLocalRole(snap({ access_level: "viewer" }))).toBe("user");
    expect(snapshotLocalRole(snap({ access_level: "none" }))).toBe("user");
    expect(snapshotLocalRole(null)).toBe("user");
  });
});

describe("buildSnapshotFromClaims", () => {
  it("uses target_module_* fields when present", () => {
    const s = buildSnapshotFromClaims(
      {
        sub: "u_1",
        target_module_key: "TorqueShed",
        target_module_enabled: true,
        target_module_access_level: "owner",
        target_module_features: ["shop_profile", "lead_capture"],
        plan_slug: "shop_pro",
        subscription_status: "active",
      },
      "fallback-module",
    );
    expect(s.module_key).toBe("torqueshed");
    expect(s.access_level).toBe("owner");
    expect(s.features).toEqual(["shop_profile", "lead_capture"]);
    expect(s.plan_slug).toBe("shop_pro");
  });

  it("falls back to enabled=true / access_level=user when claims omit target_module_*", () => {
    const s = buildSnapshotFromClaims({ sub: "u_2" }, "torqueshed");
    expect(s.enabled).toBe(true);
    expect(s.access_level).toBe("user");
    expect(s.module_key).toBe("torqueshed");
    expect(s.features).toEqual([]);
  });

  it("respects target_module_enabled=false", () => {
    const s = buildSnapshotFromClaims(
      { sub: "u_3", target_module_enabled: false },
      "torqueshed",
    );
    expect(s.enabled).toBe(false);
  });
});
