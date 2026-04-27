import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, Platform, Linking } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useEntitlements, type Tier, tierIndex } from "@/lib/entitlements";
import { startCheckout, openBillingPortal } from "@/lib/billing";
import { apiRequest } from "@/lib/query-client";
import type { MoreStackParamList } from "@/navigation/MoreStackNavigator";

type Nav = NativeStackNavigationProp<MoreStackParamList>;
type SubscriptionRouteProp = RouteProp<MoreStackParamList, "Subscription">;

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
  const navigation = useNavigation<Nav>();
  const route = useRoute<SubscriptionRouteProp>();
  const upgradeReason = route.params?.reason;
  const queryClient = useQueryClient();
  const { tier: currentTier, isLoading, subscription, isBillingDelinquent, stripeMode, hasStripeCustomer } = useEntitlements();
  const stripeConfigured = subscription?.stripeConfigured ?? false;
  const hasStripeSubscription = subscription?.hasStripeSubscription ?? false;
  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;
  const periodEndDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;
  const [busyTier, setBusyTier] = useState<Tier | null>(null);

  const downgradeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/upgrade", { tier: "free" });
      return res.json();
    },
    onSuccess: async (data, variables) => {
      if (data?.mode === "checkout" && data?.checkoutUrl) {
        toast.show("Opening secure Stripe checkout…", "success");
        await openExternalUrl(data.checkoutUrl);
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
    onError: (error: Error) => toast.show(error.message || "Failed to update plan", "error"),
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

  const handleAction = async (target: Tier) => {
    if (target === currentTier) return;
    if (target === "free") {
      if (subscription?.hasStripeCustomer) {
        setBusyTier(target);
        const result = await openBillingPortal();
        setBusyTier(null);
        if (result.kind === "error") toast.show(result.message, "error");
        return;
      }
      downgradeMutation.mutate();
      return;
    }
    setBusyTier(target);
    const result = await startCheckout(target);
    setBusyTier(null);
    if (result.kind === "missing_config") {
      toast.show("Live billing is not fully configured yet — see Manage Billing.", "error");
      navigation.navigate("Billing");
    } else if (result.kind === "error") {
      toast.show(result.message, "error");
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const currentIndex = tierIndex(currentTier);
  const renewBlurb = subscription?.currentPeriodEnd
    ? `${subscription.cancelAtPeriodEnd ? "Cancels" : "Renews"} ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
    : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      {stripeMode === "missing_config" ? (
        <BillingBanner
          tone="warn"
          icon="alert-triangle"
          title="Live billing isn't fully configured"
          body="Stripe price IDs or webhook secret are missing. Paid upgrades won't go through until an admin finishes setup."
          action={{ label: "Open Billing", onPress: () => navigation.navigate("Billing") }}
        />
      ) : stripeMode === "test" ? (
        <BillingBanner
          tone="info"
          icon="info"
          title="Stripe test mode"
          body="Charges in this environment use test cards (4242 4242 4242 4242). No real money will move."
        />
      ) : null}

      {isBillingDelinquent ? (
        <BillingBanner
          tone="error"
          icon="credit-card"
          title="Payment past due"
          body="We couldn't charge your card. You still have read access, but new premium actions are paused until billing is back in good standing."
          action={{ label: "Manage Billing", onPress: () => navigation.navigate("Billing") }}
        />
      ) : null}

      {upgradeReason ? (
        <BillingBanner
          tone="info"
          icon="zap"
          title="Upgrade to keep going"
          body={upgradeReason}
        />
      ) : null}

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
          const targetIndex = tierIndex(t.tier);
          const isUpgrade = targetIndex > currentIndex;
          const isDowngrade = targetIndex < currentIndex;
          const cta =
            isCurrent
              ? hasStripeCustomer && t.tier !== "free"
                ? "Manage Billing"
                : "Current"
              : isUpgrade
                ? `Upgrade to ${t.name}`
                : isDowngrade
                  ? hasStripeCustomer
                    ? "Manage Billing"
                    : t.tier === "free"
                      ? "Downgrade to Free"
                      : `Switch to ${t.name}`
                  : `Switch to ${t.name}`;

          const disabled =
            (isCurrent && (t.tier === "free" || !hasStripeCustomer)) ||
            busyTier !== null ||
            downgradeMutation.isPending;

          const onPress = () => {
            if (isCurrent) {
              if (hasStripeCustomer) navigation.navigate("Billing");
              return;
            }
            if (isDowngrade && hasStripeCustomer) {
              navigation.navigate("Billing");
              return;
            }
            handleAction(t.tier);
          };

          const muted = t.tier === "free" || (isCurrent && !hasStripeCustomer);
          return (
            <Card
              key={t.tier}
              elevation={2}
              style={isCurrent ? { ...styles.tierCard, borderColor: theme.primary, borderWidth: 2 } : styles.tierCard}
            >
              <View style={styles.tierHeader}>
                <ThemedText type="h3">{t.name}</ThemedText>
                {isCurrent ? (
                  <View style={[styles.currentPill, { backgroundColor: theme.primary + "20" }]}>
                    <ThemedText type="caption" style={{ color: theme.primary }}>
                      {renewBlurb && t.tier !== "free" ? `Current · ${renewBlurb}` : "Current"}
                    </ThemedText>
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
              <Pressable
                style={[
                  styles.upgradeBtn,
                  {
                    backgroundColor: muted ? theme.backgroundTertiary : theme.primary,
                    opacity: disabled ? 0.6 : 1,
                  },
                ]}
                onPress={onPress}
                disabled={disabled}
                testID={`button-tier-${t.tier}`}
              >
                {busyTier === t.tier ? (
                  <ActivityIndicator color={muted ? theme.text : "#0D0F12"} />
                ) : (
                  <ThemedText type="body" style={{ color: muted ? theme.text : "#0D0F12", fontWeight: "600" }}>
                    {cta}
                  </ThemedText>
                )}
              </Pressable>
            </Card>
          );
        })}
      </View>

      {hasStripeCustomer ? (
        <Pressable
          onPress={() => navigation.navigate("Billing")}
          style={[styles.manageLink, { borderColor: theme.cardBorder }]}
          testID="button-open-billing"
        >
          <Feather name="credit-card" size={16} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>
            Manage billing & invoices
          </ThemedText>
        </Pressable>
      ) : null}

      <ThemedText type="caption" style={[styles.disclaimer, { color: theme.textMuted }]}>
        {stripeConfigured
          ? "Secure payments by Stripe. You can cancel anytime from the billing portal."
          : "Stripe is not connected on this environment. Plan changes are sandbox only and do not charge a real card."}
      </ThemedText>
    </ScrollView>
  );
}

function BillingBanner({
  tone,
  icon,
  title,
  body,
  action,
}: {
  tone: "info" | "warn" | "error";
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  const { theme } = useTheme();
  const palette = {
    info: { bg: theme.primary + "18", border: theme.primary, fg: theme.primary },
    warn: { bg: "#F59E0B22", border: "#F59E0B", fg: "#F59E0B" },
    error: { bg: theme.error + "22", border: theme.error, fg: theme.error },
  }[tone];
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
      testID={`banner-billing-${tone}`}
    >
      <Feather name={icon} size={18} color={palette.fg} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <ThemedText type="small" style={{ color: palette.fg, fontWeight: "700" }}>{title}</ThemedText>
        <ThemedText type="small" style={{ color: theme.text, marginTop: 2 }}>{body}</ThemedText>
        {action ? (
          <Pressable onPress={action.onPress} style={{ marginTop: Spacing.xs }}>
            <ThemedText type="small" style={{ color: palette.fg, fontWeight: "700" }}>
              {action.label} ›
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
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
    justifyContent: "center",
    minHeight: 40,
  },
  manageLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  disclaimer: { textAlign: "center", marginTop: Spacing.lg, paddingHorizontal: Spacing.md },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
});

