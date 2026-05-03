import React from "react";
import { View, FlatList, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LimitPill } from "@/components/LimitPill";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useEntitlements, FREE_LISTING_LIMIT } from "@/lib/entitlements";

interface Listing {
  id: string;
  title: string;
  price: string | null;
  category: string | null;
  isDraft: boolean;
}

export default function MyListingsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { tier } = useEntitlements();
  const isFreeTier = tier === "free";

  const { data = [], isLoading, isError, refetch } = useQuery<Listing[]>({
    queryKey: ["/api/listings/me"],
  });

  const activeCount = data.filter((l) => !l.isDraft).length;
  const atListingLimit = isFreeTier && activeCount >= FREE_LISTING_LIMIT;

  const goToListingUpgrade = () =>
    navigation.navigate("Main", {
      screen: "MoreTab",
      params: {
        screen: "Subscription",
        params: {
          reason: `Free accounts can post up to ${FREE_LISTING_LIMIT} active listings. Upgrade to Garage Pro for unlimited listings, drafts, and advanced photo galleries.`,
          feature: "advanced_listing_options",
        },
      },
    });

  const handleNewListing = () => {
    if (atListingLimit) {
      goToListingUpgrade();
      return;
    }
    navigation.navigate("AddListing");
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      style={{ backgroundColor: theme.backgroundRoot }}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing["2xl"] }}
      ListHeaderComponent={
        isFreeTier ? (
          <View style={styles.headerRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Active listings
            </ThemedText>
            <LimitPill
              used={activeCount}
              limit={FREE_LISTING_LIMIT}
              noun="active"
              onPressAtLimit={goToListingUpgrade}
              testID="limit-pill-listings"
            />
          </View>
        ) : null
      }
      ListFooterComponent={
        data.length > 0 ? (
          <Pressable
            onPress={handleNewListing}
            style={({ pressed }) => [
              styles.addBtn,
              {
                backgroundColor: atListingLimit ? theme.backgroundTertiary : theme.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            testID="button-new-listing"
          >
            <Feather
              name={atListingLimit ? "lock" : "plus"}
              size={16}
              color={atListingLimit ? theme.primary : "#0D0F12"}
            />
            <ThemedText
              type="body"
              style={{
                color: atListingLimit ? theme.primary : "#0D0F12",
                fontWeight: "700",
                marginLeft: Spacing.xs,
              }}
            >
              {atListingLimit ? "Upgrade to post more" : "New Listing"}
            </ThemedText>
            {atListingLimit ? (
              <View style={[styles.proPill, { backgroundColor: theme.primary }]}>
                <ThemedText type="caption" style={{ color: "#0D0F12", fontWeight: "800" }}>
                  PRO
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => navigation.navigate("ListingDetail", { listingId: item.id })}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <Card elevation={2} style={styles.row}>
            <View style={{ flex: 1 }}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>{item.title}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textMuted }}>
                {item.category ?? "uncategorized"}{item.isDraft ? " · draft" : ""}
              </ThemedText>
            </View>
            {item.price ? <ThemedText type="body" style={{ color: theme.primary }}>${item.price}</ThemedText> : null}
          </Card>
        </Pressable>
      )}
      ListEmptyComponent={
        isError ? (
          <EmptyState icon="alert-circle" title="Couldn't load listings" description="Pull to refresh or try again." actionLabel="Retry" onAction={() => refetch()} />
        ) : (
          <EmptyState
            icon="package"
            title="No listings yet"
            description="List a spare part, tool, or service to make some space in your garage."
            actionLabel={atListingLimit ? "Upgrade to post more" : "New Listing"}
            onAction={handleNewListing}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", padding: Spacing.md, marginBottom: Spacing.sm, borderRadius: BorderRadius.lg, gap: Spacing.sm },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
  proPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginLeft: 4,
  },
});
