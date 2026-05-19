// Task #68 — Billing is managed in OperatorOS. This screen is read-only.
import React from "react";
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, Linking, Platform } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useEntitlements, TIER_LABEL } from "@/lib/entitlements";

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

export default function BillingScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const {
    tier,
    isLoading,
    isBillingDelinquent,
    entitlements,
    manageBillingUrl,
    readOnly,
  } = useEntitlements();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const planSlug = entitlements?.planSlug ?? null;
  const subStatus = entitlements?.subscriptionStatus ?? "active";
  const lastSync = entitlements?.lastSyncAt
    ? new Date(entitlements.lastSyncAt).toLocaleString()
    : "Never";

  const statusColor =
    subStatus === "active" || subStatus === "trialing"
      ? theme.success ?? theme.primary
      : subStatus === "past_due"
        ? theme.error
        : theme.textSecondary;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <ThemedText type="h2" style={{ marginBottom: Spacing.xs }}>Billing</ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
        Plans, seats, and payment are managed in OperatorOS — TorqueShed reflects
        whatever access your workspace has been granted there.
      </ThemedText>

      <Card elevation={2} style={styles.card}>
        <View style={styles.row}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Plan</ThemedText>
          <ThemedText type="body" style={{ fontWeight: "700" }} testID="text-current-plan">
            {TIER_LABEL[tier]}
          </ThemedText>
        </View>
        {planSlug ? (
          <View style={styles.row}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>OperatorOS plan</ThemedText>
            <ThemedText type="small">{planSlug}</ThemedText>
          </View>
        ) : null}
        <View style={styles.row}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Status</ThemedText>
          <ThemedText type="body" style={{ color: statusColor, fontWeight: "700" }} testID="text-sub-status">
            {(subStatus ?? "active").replace("_", " ")}
          </ThemedText>
        </View>
        {readOnly ? (
          <View style={styles.row}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Access</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Read-only (viewer)</ThemedText>
          </View>
        ) : null}
        <View style={styles.row}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Last sync</ThemedText>
          <ThemedText type="small">{lastSync}</ThemedText>
        </View>
      </Card>

      {isBillingDelinquent ? (
        <View style={[styles.banner, { backgroundColor: theme.error + "22", borderColor: theme.error }]}>
          <Feather name="alert-circle" size={18} color={theme.error} />
          <ThemedText type="small" style={{ color: theme.text, flex: 1 }}>
            OperatorOS reports your most recent payment failed. Update your billing
            info in OperatorOS to keep premium features active.
          </ThemedText>
        </View>
      ) : null}

      {manageBillingUrl ? (
        <Pressable
          onPress={() => openExternal(manageBillingUrl)}
          style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
          testID="button-manage-in-operatoros"
          accessibilityRole="link"
          accessibilityLabel="Manage billing in OperatorOS"
        >
          <Feather name="external-link" size={16} color="#0D0F12" />
          <ThemedText type="body" style={{ color: "#0D0F12", fontWeight: "700" }}>
            Manage Billing in OperatorOS
          </ThemedText>
        </Pressable>
      ) : (
        <ThemedText type="caption" style={{ color: theme.textMuted, marginTop: Spacing.lg, textAlign: "center" }}>
          OperatorOS billing URL is not configured on the server.
        </ThemedText>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { padding: Spacing.lg, borderRadius: BorderRadius["2xl"], gap: Spacing.sm, marginBottom: Spacing.lg },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    minHeight: 48,
  },
});
