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
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
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

const FALLBACK_PRODUCTS: Product[] = [
  { id: "1", title: "K&N Cold Air Intake Kit", description: "High-flow performance air intake for improved horsepower and throttle response", whyItMatters: "More air = more power. Fits most trucks and SUVs.", price: "$349.99", priceRange: null, category: "Performance", vendor: "K&N Engineering", affiliateLink: "https://www.knfilters.com", imageUrl: null, isSponsored: false, submissionStatus: "approved", featuredExpiration: null, createdAt: new Date().toISOString() },
  { id: "2", title: "Bilstein 5100 Shock Kit", description: "Premium monotube shocks for lifted trucks, adjustable ride height", whyItMatters: "Smoother ride, better control on and off road.", price: "$599.99", priceRange: null, category: "Suspension", vendor: "Bilstein", affiliateLink: "https://www.bilstein.com", imageUrl: null, isSponsored: true, submissionStatus: "featured", featuredExpiration: null, createdAt: new Date().toISOString() },
  { id: "3", title: "Flowmaster Super 44 Muffler", description: "Aggressive deep tone exhaust with improved flow", whyItMatters: "That rumble you want without droning on highways.", price: "$179.99", priceRange: null, category: "Exhaust", vendor: "Flowmaster", affiliateLink: "https://www.flowmastermufflers.com", imageUrl: null, isSponsored: false, submissionStatus: "approved", featuredExpiration: null, createdAt: new Date().toISOString() },
  { id: "4", title: "Rigid Industries LED Light Bar", description: "20-inch spot/flood combo LED bar, 20,000 lumens", whyItMatters: "See everything. Built tough for off-road abuse.", price: "$449.99", priceRange: null, category: "Lighting", vendor: "Rigid Industries", affiliateLink: "https://www.rigidindustries.com", imageUrl: null, isSponsored: true, submissionStatus: "featured", featuredExpiration: null, createdAt: new Date().toISOString() },
  { id: "5", title: "WeatherTech Floor Liners", description: "Custom-fit floor protection for all weather conditions", whyItMatters: "Save your carpets from mud, snow, and spills.", price: "$189.99", priceRange: "$149 - $229", category: "Interior", vendor: "WeatherTech", affiliateLink: "https://www.weathertech.com", imageUrl: null, isSponsored: false, submissionStatus: "approved", featuredExpiration: null, createdAt: new Date().toISOString() },
  { id: "6", title: "Borla Cat-Back Exhaust System", description: "Stainless steel performance exhaust system with deep tone", whyItMatters: "Quality sound and added horsepower. Lifetime warranty.", price: "$899.99", priceRange: null, category: "Exhaust", vendor: "Borla", affiliateLink: "https://www.borla.com", imageUrl: null, isSponsored: false, submissionStatus: "approved", featuredExpiration: null, createdAt: new Date().toISOString() },
];

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
  const tabBarHeight = useBottomTabBarHeight();

  const { data: products, isLoading, error } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const displayProducts = products && products.length > 0 ? products : FALLBACK_PRODUCTS;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={displayProducts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ProductCard item={item} />}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + Spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Tool & Gear
              </Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                Curated picks for your garage. No algorithms, just good gear.
              </Text>
            </View>
          }
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
