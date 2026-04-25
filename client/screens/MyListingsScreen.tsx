import React from "react";
import { View, FlatList, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

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

  const { data = [], isLoading, isError, refetch } = useQuery<Listing[]>({
    queryKey: ["/api/listings/me"],
  });

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
            actionLabel="New Listing"
            onAction={() => navigation.navigate("AddListing")}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", padding: Spacing.md, marginBottom: Spacing.sm, borderRadius: BorderRadius.lg, gap: Spacing.sm },
});
