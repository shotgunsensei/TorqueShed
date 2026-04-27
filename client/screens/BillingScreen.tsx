import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useEntitlements, TIER_LABEL } from "@/lib/entitlements";
import { openBillingPortal, startCheckout } from "@/lib/billing";
import type { MoreStackParamList } from "@/navigation/MoreStackNavigator";

type Nav = NativeStackNavigationProp<MoreStackParamList>;

export default function BillingScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const { tier, subscription, isLoading, hasStripeCustomer, isBillingDelinquent, stripeMode } = useEntitlements();
  const [busy, setBusy] = useState<"portal" | "checkout" | null>(null);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const handlePortal = async () => {
    setBusy("portal");
    const result = await openBillingPortal();
    setBusy(null);
    if (result.kind === "error") toast.show(result.message, "error");
  };

  const handleCheckoutDiy = async () => {
    setBusy("checkout");
    const result = await startCheckout("diy_pro");
    setBusy(null);
    if (result.kind === "missing_config") {
      toast.show("Live billing isn't configured yet.", "error");
    } else if (result.kind === "error") {
      toast.show(result.message, "error");
    }
  };

  const renewBlurb = subscription?.currentPeriodEnd
    ? `${subscription.cancelAtPeriodEnd ? "Cancels" : "Renews"} ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
    : "No renewal scheduled";

  const statusColor =
    subscription?.status === "active" || subscription?.status === "trialing"
      ? theme.success ?? theme.primary
      : subscription?.status === "past_due"
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
        Manage your TorqueShed subscription, payment method, and invoices.
      </ThemedText>

      <Card elevation={2} style={styles.card}>
        <View style={styles.row}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Plan</ThemedText>
          <ThemedText type="body" style={{ fontWeight: "700" }}>{TIER_LABEL[tier]}</ThemedText>
        </View>
        <View style={styles.row}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Status</ThemedText>
          <ThemedText type="body" style={{ color: statusColor, fontWeight: "700" }}>
            {(subscription?.status ?? "active").replace("_", " ")}
          </ThemedText>
        </View>
        <View style={styles.row}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Billing cycle</ThemedText>
          <ThemedText type="small">{renewBlurb}</ThemedText>
        </View>
        <View style={styles.row}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Stripe mode</ThemedText>
          <ThemedText type="small">
            {stripeMode === "live" ? "Live" : stripeMode === "test" ? "Test" : "Not configured"}
          </ThemedText>
        </View>
      </Card>

      {isBillingDelinquent ? (
        <View style={[styles.banner, { backgroundColor: theme.error + "22", borderColor: theme.error }]}>
          <Feather name="alert-circle" size={18} color={theme.error} />
          <ThemedText type="small" style={{ color: theme.text, flex: 1 }}>
            Your most recent payment failed. Update your card in the billing portal to keep premium features active.
          </ThemedText>
        </View>
      ) : null}

      {hasStripeCustomer ? (
        <Pressable
          onPress={handlePortal}
          disabled={busy !== null}
          style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: busy ? 0.6 : 1 }]}
          testID="button-open-portal"
        >
          {busy === "portal" ? (
            <ActivityIndicator color="#0D0F12" />
          ) : (
            <>
              <Feather name="external-link" size={16} color="#0D0F12" />
              <ThemedText type="body" style={{ color: "#0D0F12", fontWeight: "700" }}>
                Open Stripe Billing Portal
              </ThemedText>
            </>
          )}
        </Pressable>
      ) : (
        <Pressable
          onPress={handleCheckoutDiy}
          disabled={busy !== null || stripeMode === "missing_config"}
          style={[
            styles.primaryBtn,
            {
              backgroundColor: theme.primary,
              opacity: busy || stripeMode === "missing_config" ? 0.6 : 1,
            },
          ]}
          testID="button-start-checkout"
        >
          {busy === "checkout" ? (
            <ActivityIndicator color="#0D0F12" />
          ) : (
            <>
              <Feather name="zap" size={16} color="#0D0F12" />
              <ThemedText type="body" style={{ color: "#0D0F12", fontWeight: "700" }}>
                Subscribe to DIY Pro
              </ThemedText>
            </>
          )}
        </Pressable>
      )}

      <Pressable
        onPress={() => navigation.navigate("Subscription")}
        style={[styles.secondaryBtn, { borderColor: theme.cardBorder }]}
        testID="button-compare-plans"
      >
        <ThemedText type="small" style={{ color: theme.text, fontWeight: "600" }}>
          Compare all plans
        </ThemedText>
      </Pressable>

      {stripeMode === "missing_config" ? (
        <ThemedText type="caption" style={{ color: theme.textMuted, marginTop: Spacing.lg, textAlign: "center" }}>
          Live billing isn't fully configured yet. An admin needs to add Stripe price IDs and webhook secret on the server.
        </ThemedText>
      ) : null}
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
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
});
