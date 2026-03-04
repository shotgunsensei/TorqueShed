import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { Spacing, Typography, BorderRadius, Colors } from "@/constants/theme";
import { microcopy } from "@/constants/brand";
import { getApiUrl } from "@/lib/query-client";

interface Product {
  id: string;
  title: string;
  description: string | null;
  whyItMatters: string | null;
  price: string | null;
  priceRange: string | null;
  category: string;
  affiliateLink: string | null;
  vendor: string | null;
  imageUrl: string | null;
  isSponsored: boolean;
  submissionStatus: "pending" | "approved" | "featured";
  featuredExpiration: string | null;
  createdAt: string;
}


function ProductCard({ item }: { item: Product }) {
  const { theme } = useTheme();

  const trackClick = async () => {
    try {
      const url = new URL(`/api/products/${item.id}/click`, getApiUrl());
      await fetch(url.toString(), { method: "POST" });
    } catch {}
  };

  const handleViewDeal = async () => {
    if (item.affiliateLink) {
      await trackClick();
      Linking.openURL(item.affiliateLink);
    }
  };

  const isFeatured = item.submissionStatus === "featured";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: isFeatured ? theme.accent : theme.cardBorder,
          borderWidth: isFeatured ? 2 : 1,
        },
      ]}
      testID={`product-card-${item.id}`}
    >
      <View style={[styles.imagePlaceholder, { backgroundColor: theme.backgroundTertiary }]}>
        <Feather name="package" size={32} color={theme.textMuted} />
        {isFeatured ? (
          <View style={[styles.featuredBadge, { backgroundColor: theme.accent }]}>
            <Feather name="star" size={10} color="#FFFFFF" />
            <Text style={styles.featuredText}>Featured</Text>
          </View>
        ) : item.isSponsored ? (
          <View style={[styles.sponsoredBadge, { backgroundColor: theme.accent }]}>
            <Text style={styles.sponsoredText}>Sponsored</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardContent}>
        <View style={[styles.categoryBadge, { backgroundColor: theme.backgroundTertiary }]}>
          <Text style={[styles.categoryText, { color: theme.textSecondary }]}>
            {item.category}
          </Text>
        </View>
        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.vendor ? (
          <Text style={[styles.vendorName, { color: theme.textMuted }]}>
            {item.vendor}
          </Text>
        ) : null}
        
        {item.whyItMatters ? (
          <View style={[styles.whyItMattersBox, { backgroundColor: theme.backgroundTertiary }]}>
            <Feather name="info" size={12} color={theme.primary} style={styles.infoIcon} />
            <Text style={[styles.whyItMattersText, { color: theme.textSecondary }]} numberOfLines={2}>
              {item.whyItMatters}
            </Text>
          </View>
        ) : null}

        <Text style={[styles.price, { color: theme.primary }]}>
          {item.priceRange || item.price || "Check price"}
        </Text>

        {item.affiliateLink ? (
          <Pressable
            onPress={handleViewDeal}
            style={({ pressed }) => [
              styles.viewDealButton,
              {
                backgroundColor: theme.primary,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            testID={`view-deal-${item.id}`}
          >
            <Text style={styles.viewDealText}>{microcopy.viewDeal}</Text>
            <Feather name="external-link" size={14} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View style={[styles.noLinkNote, { borderColor: theme.border }]}>
            <Text style={[styles.noLinkText, { color: theme.textMuted }]}>
              Search vendor for pricing
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TrendingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isDesktop, width } = useResponsive();

  const numColumns = isDesktop ? (width >= 1280 ? 4 : 3) : 2;

  const { data: products, isLoading, error } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const displayProducts = products || [];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          key={`products-${numColumns}`}
          data={displayProducts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ProductCard item={item} />}
          numColumns={numColumns}
          columnWrapperStyle={displayProducts.length > 0 ? styles.row : undefined}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom: isDesktop ? Spacing.xl : insets.bottom + 80 + Spacing.lg,
              maxWidth: isDesktop ? 1400 : undefined,
              alignSelf: isDesktop ? "center" : undefined,
              width: isDesktop ? "100%" : undefined,
            },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={null}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="package" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No products available yet
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
  },
  row: {
    gap: Spacing.md,
  },
  card: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  imagePlaceholder: {
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  sponsoredBadge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  featuredBadge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  featuredText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  sponsoredText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "700",
  },
  cardContent: {
    padding: Spacing.md,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xs,
  },
  categoryText: {
    ...Typography.caption,
  },
  cardTitle: {
    ...Typography.h4,
    fontSize: 14,
    marginBottom: Spacing.xxs,
  },
  vendorName: {
    ...Typography.caption,
    marginBottom: Spacing.xs,
  },
  whyItMattersBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  infoIcon: {
    marginRight: Spacing.xs,
    marginTop: 1,
  },
  whyItMattersText: {
    ...Typography.caption,
    flex: 1,
    lineHeight: 16,
  },
  price: {
    ...Typography.h4,
    marginBottom: Spacing.sm,
  },
  viewDealButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  viewDealText: {
    color: "#FFFFFF",
    ...Typography.small,
    fontWeight: "600",
  },
  noLinkNote: {
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    alignItems: "center",
  },
  noLinkText: {
    ...Typography.caption,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
  },
});
