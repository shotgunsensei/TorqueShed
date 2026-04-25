import React from "react";
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

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

export default function SubscriptionScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { tier: currentTier, isLoading } = useEntitlements();

  const upgradeMutation = useMutation({
    mutationFn: async (tier: Tier) => {
      const res = await apiRequest("POST", "/api/subscription/upgrade", { tier });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      const msg = data?.sandbox ? "Plan updated (sandbox mode)" : "Plan updated";
      toast.show(msg, "success");
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to update plan", "error");
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
                    {t.tier === "free" ? "Downgrade" : `Upgrade to ${t.name}`}
                  </ThemedText>
                </Pressable>
              ) : null}
            </Card>
          );
        })}
      </View>

      <ThemedText type="caption" style={[styles.disclaimer, { color: theme.textMuted }]}>
        Live billing is being finalized. Upgrades on this build are sandbox only and do not charge a real card.
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
  upgradeBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignItems: "center",
  },
  disclaimer: { textAlign: "center", marginTop: Spacing.lg, paddingHorizontal: Spacing.md },
});
