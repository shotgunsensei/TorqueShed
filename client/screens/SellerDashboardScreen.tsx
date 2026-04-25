import React from "react";
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface DashListing {
  id: string;
  title: string;
  price: string | null;
  category: string | null;
  isDraft: boolean;
  attachedCaseId: string | null;
}

interface DashboardData {
  activeListings: DashListing[];
  drafts: DashListing[];
  totalListings: number;
  attachedCasesCount: number;
  tier: "free" | "diy_pro" | "garage_pro" | "shop_pro";
  listingLimit: number | null;
  atLimit: boolean;
}

export default function SellerDashboardScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();

  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/seller-dashboard"],
  });

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <EmptyState
          icon="alert-circle"
          title="Couldn't load dashboard"
          description="Pull to retry."
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      </View>
    );
  }

  const Stat = ({ label, value, icon }: { label: string; value: string; icon: keyof typeof Feather.glyphMap }) => (
    <Card elevation={2} style={styles.stat}>
      <Feather name={icon} size={18} color={theme.primary} />
      <ThemedText type="h3" style={{ marginTop: Spacing.xs }}>{value}</ThemedText>
      <ThemedText type="caption" style={{ color: theme.textMuted }}>{label}</ThemedText>
    </Card>
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing["2xl"] }}
    >
      <ThemedText type="h2">Seller dashboard</ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.xxs, marginBottom: Spacing.lg }}>
        Manage your marketplace listings and the cases they're attached to.
      </ThemedText>

      <View style={styles.statsRow}>
        <Stat label="Active" value={String(data.activeListings.length)} icon="package" />
        <Stat label="Drafts" value={String(data.drafts.length)} icon="edit-3" />
        <Stat label="Attached cases" value={String(data.attachedCasesCount)} icon="link" />
      </View>

      {data.atLimit ? (
        <Card elevation={2} style={{ ...styles.upsell, borderColor: theme.primary, borderWidth: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs }}>
            <Feather name="alert-circle" size={18} color={theme.primary} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Free-tier limit reached</ThemedText>
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            You've hit the {data.listingLimit}-listing free cap. Upgrade to Garage Pro for unlimited listings and advanced features.
          </ThemedText>
          <Pressable
            onPress={() => navigation.navigate("Subscription")}
            style={[styles.upsellBtn, { backgroundColor: theme.primary }]}
          >
            <ThemedText type="body" style={{ color: "#0D0F12", fontWeight: "700" }}>See plans</ThemedText>
          </Pressable>
        </Card>
      ) : null}

      <ThemedText type="h4" style={styles.sectionLabel}>Active listings</ThemedText>
      {data.activeListings.length === 0 ? (
        <EmptyState
          icon="package"
          title="No active listings"
          description="List a part, tool, or service to get started."
          actionLabel="New Listing"
          onAction={() => navigation.navigate("AddListing")}
        />
      ) : (
        data.activeListings.map((l) => (
          <Pressable
            key={l.id}
            onPress={() => navigation.navigate("ListingDetail", { listingId: l.id })}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <Card elevation={2} style={styles.listingRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>{l.title}</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textMuted, marginTop: 2 }}>
                  {l.category ?? "uncategorized"}{l.attachedCaseId ? " · attached to case" : ""}
                </ThemedText>
              </View>
              {l.price ? <ThemedText type="body" style={{ color: theme.primary }}>${l.price}</ThemedText> : null}
            </Card>
          </Pressable>
        ))
      )}

      {data.drafts.length > 0 ? (
        <>
          <ThemedText type="h4" style={styles.sectionLabel}>Drafts</ThemedText>
          {data.drafts.map((l) => (
            <Card key={l.id} elevation={1} style={styles.listingRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>{l.title || "Untitled draft"}</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>{l.category ?? "uncategorized"}</ThemedText>
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  stat: { flex: 1, padding: Spacing.md, alignItems: "flex-start", borderRadius: BorderRadius.lg },
  upsell: { padding: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing.lg },
  upsellBtn: { paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, alignItems: "center" },
  sectionLabel: { marginTop: Spacing.lg, marginBottom: Spacing.sm },
  listingRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, marginBottom: Spacing.sm, borderRadius: BorderRadius.lg, gap: Spacing.sm },
});
