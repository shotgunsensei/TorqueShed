// Task #68 — Plans are managed in OperatorOS. This screen is read-only and
// only shows the current tier + a link to OperatorOS to change plan.
import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  useEntitlements,
  TIER_LABEL,
  TIER_ORDER,
  tierIndex,
  type Tier,
} from "@/lib/entitlements";

const TIER_BLURBS: Record<Tier, string> = {
  free: "Basic community access.",
  diy_pro: "Advanced diagnostics, unlimited saved cases, PDF repair plans.",
  garage_pro: "Everything in DIY Pro + multi-vehicle, maintenance, build logs.",
  shop_pro: "Everything in Garage Pro + public shop profile, services, leads, team.",
};

async function openExternal(url: string) {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank");
      return;
    }
    await WebBrowser.openBrowserAsync(url);
  } catch {
    try {
      await Linking.openURL(url);
    } catch {
      /* ignore */
    }
  }
}

export default function SubscriptionScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const { tier, isLoading, manageBillingUrl, entitlements, readOnly } = useEntitlements();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const currentIdx = tierIndex(tier);
  const planSlug = entitlements?.planSlug ?? null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <ThemedText type="h2" style={{ marginBottom: Spacing.xs }}>
        Plans
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
        Your TorqueShed plan is set by your OperatorOS workspace. To change plans
        or add seats, open OperatorOS.
      </ThemedText>

      <Card elevation={2} style={styles.currentCard}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Current plan
        </ThemedText>
        <ThemedText type="h2" style={{ color: theme.primary, fontWeight: "800" }} testID="text-current-tier">
          {TIER_LABEL[tier]}
        </ThemedText>
        {planSlug ? (
          <ThemedText type="caption" style={{ color: theme.textMuted }}>
            OperatorOS plan slug: {planSlug}
          </ThemedText>
        ) : null}
        <View style={styles.detailRow}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Status</ThemedText>
          <ThemedText type="small" testID="text-sub-status">
            {(entitlements?.subscriptionStatus ?? "active").replace("_", " ")}
          </ThemedText>
        </View>
        <View style={styles.detailRow}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Access level</ThemedText>
          <ThemedText type="small" testID="text-access-level">
            {entitlements?.accessLevel ?? "—"}
            {readOnly ? " (read-only)" : ""}
          </ThemedText>
        </View>
        <View style={styles.detailRow}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Role</ThemedText>
          <ThemedText type="small" testID="text-role">{entitlements?.role ?? "user"}</ThemedText>
        </View>
        {entitlements?.features?.length ? (
          <View style={styles.chipWrap} testID="list-features">
            {entitlements.features.map((f) => (
              <View
                key={f}
                style={[styles.chip, { backgroundColor: theme.primary + "22", borderColor: theme.primary }]}
                testID={`chip-feature-${f}`}
              >
                <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "700" }}>
                  {f}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      {TIER_ORDER.map((t) => {
        const isCurrent = t === tier;
        const isLower = tierIndex(t) < currentIdx;
        return (
          <Card
            key={t}
            elevation={isCurrent ? 2 : 1}
            style={[
              styles.tierCard,
              isCurrent
                ? { borderColor: theme.primary, borderWidth: 2 }
                : { borderColor: theme.cardBorder, borderWidth: 1 },
            ]}
            testID={`card-tier-${t}`}
          >
            <View style={styles.tierHeader}>
              <ThemedText type="h3" style={{ fontWeight: "700" }}>
                {TIER_LABEL[t]}
              </ThemedText>
              {isCurrent ? (
                <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                  <ThemedText type="caption" style={{ color: "#0D0F12", fontWeight: "700" }}>
                    CURRENT
                  </ThemedText>
                </View>
              ) : isLower ? (
                <View style={[styles.badge, { backgroundColor: theme.cardBorder }]}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    LOWER
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {TIER_BLURBS[t]}
            </ThemedText>
          </Card>
        );
      })}

      {manageBillingUrl ? (
        <Pressable
          onPress={() => openExternal(manageBillingUrl)}
          style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
          testID="button-manage-in-operatoros"
          accessibilityRole="link"
          accessibilityLabel="Manage plan in OperatorOS"
        >
          <Feather name="external-link" size={16} color="#0D0F12" />
          <ThemedText type="body" style={{ color: "#0D0F12", fontWeight: "700" }}>
            Manage Plan in OperatorOS
          </ThemedText>
        </Pressable>
      ) : (
        <ThemedText type="caption" style={{ color: theme.textMuted, marginTop: Spacing.lg, textAlign: "center" }}>
          OperatorOS URL not configured on the server.
        </ThemedText>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  currentCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
    alignItems: "stretch",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  tierCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    minHeight: 48,
    marginTop: Spacing.lg,
  },
});
