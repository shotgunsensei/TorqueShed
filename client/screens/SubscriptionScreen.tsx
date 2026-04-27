import React from "react";
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, Platform, Linking } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useEntitlements, type Tier } from "@/lib/entitlements";
import { apiRequest } from "@/lib/query-client";

interface TierCard {
  tier: Tier;
  name: string;
  price: string;
  tagline: string;
  features: string[];
}

const TIERS: TierCard[] = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
    tagline: "Get help from the community",
    features: [
      "Basic case creation",
      "Basic Torque Assist summary",
      "Community replies",
      "Up to 3 saved cases",
      "Basic parts & tool suggestions",
    ],
  },
  {
    tier: "diy_pro",
    name: "DIY Pro",
    price: "$9.99 / month",
    tagline: "For weekend wrenchers",
    features: [
      "Advanced diagnostic tree",
      "Unlimited saved cases",
      "PDF repair plan export",
      "Full parts & tool checklist",
      "Similar solved case matching",
      "Priority follow-up questions",
    ],
  },
  {
    tier: "garage_pro",
    name: "Garage Pro",
    price: "$29 / month",
    tagline: "For multi-vehicle households",
    features: [
      "Everything in DIY Pro",
      "Multiple vehicles",
      "Maintenance tracking",
      "Advanced repair history",
      "Cost tracking & build logs",
      "Saved tool inventory",
      "Advanced marketplace listings",
    ],
  },
  {
    tier: "shop_pro",
    name: "Shop Pro",
    price: "$79 / month",
    tagline: "For independent shops",
    features: [
      "Everything in Garage Pro",
      "Public shop profile",
      "Service listings",
      "Lead capture",
      "Team / member access",
      "Public credibility profile",
      "Customer-facing diagnostic summaries",
    ],
  },
];

async function openExternalUrl(url: string) {
  try {
    if (Platform.OS === "web") {
      // On web, open in a new tab so users return to the app naturally.
      if (typeof window !== "undefined") {
        window.open(url, "_blank");
        return;
      }
    }
    await WebBrowser.openBrowserAsync(url);
  } catch {
    try {
      await Linking.openURL(url);
    } catch {
      // ignore
    }
  }
}

export default function SubscriptionScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { tier: currentTier, isLoading, subscription } = useEntitlements();
  const stripeConfigured = subscription?.stripeConfigured ?? false;
  const hasStripeSubscription = subscription?.hasStripeSubscription ?? false;
  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;
  const periodEndDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;

  const upgradeMutation = useMutation({
    mutationFn: async (tier: Tier) => {
      const res = await apiRequest("POST", "/api/subscription/upgrade", { tier });
      return res.json();
    },
    onSuccess: async (data, variables) => {
      if (data?.mode === "checkout" && data?.checkoutUrl) {
        toast.show("Opening secure Stripe checkout…", "success");
        await openExternalUrl(data.checkoutUrl);
        // Refresh after the user returns to pick up new subscription state.
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
        }, 1500);
        return;
      }
      if (data?.mode === "portal" && data?.portalUrl) {
        toast.show("Opening billing portal to manage your plan…", "success");
        await openExternalUrl(data.portalUrl);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
        }, 1500);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      const msg =
        variables === "free"
          ? "Switched to the Free plan"
          : data?.sandbox
          ? "Plan updated (sandbox mode)"
          : "Plan updated";
      toast.show(msg, "success");
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to update plan", "error");
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/portal", {});
      return res.json();
    },
    onSuccess: async (data) => {
      if (data?.url) {
        await openExternalUrl(data.url);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
        }, 1500);
      }
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to open billing portal", "error");
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <ThemedText type="h2" style={styles.title}>Plans built for the way you wrench</ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
        Free covers casework. Upgrade only when you need premium diagnostics, exports, or shop tools.
      </ThemedText>

      {hasStripeSubscription ? (
        <>
          {periodEndDate ? (
            <ThemedText
              type="caption"
              style={[styles.renewalNote, { color: cancelAtPeriodEnd ? theme.primary : theme.textSecondary }]}
              testID="text-renewal-note"
            >
              {cancelAtPeriodEnd
                ? `Cancels on ${periodEndDate.toLocaleDateString()}`
                : `Renews on ${periodEndDate.toLocaleDateString()}`}
            </ThemedText>
          ) : null}
          <Pressable
            style={[styles.manageBtn, { backgroundColor: theme.backgroundTertiary, borderColor: theme.border }]}
            onPress={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            testID="button-manage-billing"
          >
            <Feather name="credit-card" size={16} color={theme.text} style={{ marginRight: Spacing.sm }} />
            <ThemedText type="body" style={{ color: theme.text, fontWeight: "600" }}>
              {portalMutation.isPending ? "Opening…" : "Manage billing & invoices"}
            </ThemedText>
          </Pressable>
        </>
      ) : null}

      <View style={styles.tierList}>
        {TIERS.map((t) => {
          const isCurrent = t.tier === currentTier;
          return (
            <Card key={t.tier} elevation={2} style={isCurrent ? { ...styles.tierCard, borderColor: theme.primary, borderWidth: 2 } : styles.tierCard}>
              <View style={styles.tierHeader}>
                <ThemedText type="h3">{t.name}</ThemedText>
                {isCurrent ? (
                  <View style={[styles.currentPill, { backgroundColor: theme.primary + "20" }]}>
                    <ThemedText type="caption" style={{ color: theme.primary }}>Current</ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText type="h4" style={{ color: theme.primary, marginTop: Spacing.xs }}>{t.price}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xxs, marginBottom: Spacing.md }}>
                {t.tagline}
              </ThemedText>
              {t.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Feather name="check" size={16} color={theme.primary} style={{ marginRight: Spacing.sm }} />
                  <ThemedText type="small" style={{ flex: 1 }}>{f}</ThemedText>
                </View>
              ))}
              {!isCurrent ? (
                <Pressable
                  style={[styles.upgradeBtn, { backgroundColor: t.tier === "free" ? theme.backgroundTertiary : theme.primary }]}
                  onPress={() => upgradeMutation.mutate(t.tier)}
                  disabled={upgradeMutation.isPending}
                  testID={`upgrade-${t.tier}`}
                >
                  <ThemedText type="body" style={{ color: t.tier === "free" ? theme.text : "#0D0F12", fontWeight: "600" }}>
                    {t.tier === "free"
                      ? hasStripeSubscription
                        ? "Cancel via portal"
                        : "Downgrade"
                      : `Upgrade to ${t.name}`}
                  </ThemedText>
                </Pressable>
              ) : null}
            </Card>
          );
        })}
      </View>

      <ThemedText type="caption" style={[styles.disclaimer, { color: theme.textMuted }]}>
        {stripeConfigured
          ? "Secure payments by Stripe. You can cancel anytime from the billing portal."
          : "Stripe is not connected on this environment. Plan changes are sandbox only and do not charge a real card."}
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { marginBottom: Spacing.xs },
  subtitle: { marginBottom: Spacing.lg },
  tierList: { gap: Spacing.md },
  tierCard: { padding: Spacing.lg, borderRadius: BorderRadius["2xl"] },
  tierHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  currentPill: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xxs, borderRadius: BorderRadius.full },
  featureRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs },
  renewalNote: { textAlign: "center", marginBottom: Spacing.sm },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.lg,
  },
  upgradeBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignItems: "center",
  },
  disclaimer: { textAlign: "center", marginTop: Spacing.lg, paddingHorizontal: Spacing.md },
});
