import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import { microcopy } from "@/constants/brand";

interface ProductItem {
  id: string;
  title: string;
  price: string;
  priceRange?: string;
  category: string;
  vendorName: string;
  affiliateUrl: string;
  hasImage: boolean;
  isTrending: boolean;
}

const STUB_PRODUCTS: ProductItem[] = [
  { id: "1", title: "K&N Cold Air Intake Kit", price: "$349.99", category: "Performance", vendorName: "K&N Engineering", affiliateUrl: "https://www.knfilters.com", hasImage: true, isTrending: true },
  { id: "2", title: "Bilstein 5100 Shock Kit", price: "$599.99", category: "Suspension", vendorName: "Bilstein", affiliateUrl: "https://www.bilstein.com", hasImage: true, isTrending: true },
  { id: "3", title: "Flowmaster Super 44 Muffler", price: "$179.99", category: "Exhaust", vendorName: "Flowmaster", affiliateUrl: "https://www.flowmastermufflers.com", hasImage: true, isTrending: false },
  { id: "4", title: "Rigid Industries LED Light Bar", price: "$449.99", category: "Lighting", vendorName: "Rigid Industries", affiliateUrl: "https://www.rigidindustries.com", hasImage: true, isTrending: true },
  { id: "5", title: "WeatherTech Floor Liners", price: "$189.99", priceRange: "$149 - $229", category: "Interior", vendorName: "WeatherTech", affiliateUrl: "https://www.weathertech.com", hasImage: true, isTrending: false },
  { id: "6", title: "Borla Cat-Back Exhaust System", price: "$899.99", category: "Exhaust", vendorName: "Borla", affiliateUrl: "https://www.borla.com", hasImage: true, isTrending: true },
];

function ProductCard({ item }: { item: ProductItem }) {
  const { theme } = useTheme();

  const handleViewDeal = () => {
    Linking.openURL(item.affiliateUrl);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.cardBorder,
        },
      ]}
    >
      <View style={[styles.imagePlaceholder, { backgroundColor: theme.backgroundTertiary }]}>
        {item.hasImage ? (
          <Feather name="package" size={32} color={theme.textMuted} />
        ) : (
          <Feather name="image" size={32} color={theme.textMuted} />
        )}
        {item.isTrending ? (
          <View style={[styles.trendingBadge, { backgroundColor: theme.primary }]}>
            <Feather name="trending-up" size={12} color="#FFFFFF" />
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
        <Text style={[styles.vendorName, { color: theme.textMuted }]}>
          {item.vendorName}
        </Text>
        <Text style={[styles.price, { color: theme.primary }]}>
          {item.priceRange || item.price}
        </Text>

        <Pressable
          onPress={handleViewDeal}
          style={({ pressed }) => [
            styles.viewDealButton,
            {
              backgroundColor: theme.primary,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Text style={styles.viewDealText}>{microcopy.viewDeal}</Text>
          <Feather name="external-link" size={14} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

export default function TrendingScreen() {
  const { theme } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={STUB_PRODUCTS}
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
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Hot Deals
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h2,
    marginBottom: Spacing.lg,
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
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  trendingBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
    marginBottom: Spacing.xxs,
  },
  vendorName: {
    ...Typography.caption,
    marginBottom: Spacing.xs,
  },
  price: {
    ...Typography.h3,
    marginBottom: Spacing.md,
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
});
