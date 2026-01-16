import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import { emptyStates, microcopy } from "@gearhead/shared";

interface SwapItem {
  id: string;
  title: string;
  price: string;
  location: string;
  condition: "New" | "Used" | "Rebuilt";
  seller: string;
  postedTime: string;
  hasImage: boolean;
}

const STUB_SWAP_ITEMS: SwapItem[] = [
  { id: "1", title: "Coyote 5.0L Engine - Complete", price: "$4,500", location: "Austin, TX", condition: "Used", seller: "WrenchMonkey", postedTime: "2h ago", hasImage: true },
  { id: "2", title: "Fox Body K-Member", price: "$350", location: "Dallas, TX", condition: "Rebuilt", seller: "FoxBodyFan", postedTime: "5h ago", hasImage: true },
  { id: "3", title: "T56 Magnum 6-Speed", price: "$2,800", location: "Houston, TX", condition: "Used", seller: "GearheadGary", postedTime: "1d ago", hasImage: true },
  { id: "4", title: "Ford 9\" Rear End - 3.55 Gears", price: "$1,200", location: "San Antonio, TX", condition: "Rebuilt", seller: "NineInch9", postedTime: "2d ago", hasImage: false },
  { id: "5", title: "Tremec T45 5-Speed", price: "$800", location: "Phoenix, AZ", condition: "Used", seller: "TransGuy", postedTime: "3d ago", hasImage: true },
];

function SwapItemCard({ item }: { item: SwapItem }) {
  const { theme } = useTheme();

  const getConditionColor = () => {
    switch (item.condition) {
      case "New": return theme.success;
      case "Used": return theme.primary;
      case "Rebuilt": return theme.warning;
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.cardBorder,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.cardContent}>
        <View style={[styles.imagePlaceholder, { backgroundColor: theme.backgroundTertiary }]}>
          {item.hasImage ? (
            <Feather name="image" size={24} color={theme.textMuted} />
          ) : (
            <Feather name="camera-off" size={24} color={theme.textMuted} />
          )}
        </View>
        <View style={styles.cardDetails}>
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.cardPrice, { color: theme.primary }]}>
            {item.price}
          </Text>
          <View style={styles.cardMeta}>
            <View style={[styles.conditionBadge, { backgroundColor: getConditionColor() + "20" }]}>
              <Text style={[styles.conditionText, { color: getConditionColor() }]}>
                {item.condition}
              </Text>
            </View>
            <Text style={[styles.locationText, { color: theme.textMuted }]}>
              {item.location}
            </Text>
          </View>
          <View style={styles.sellerRow}>
            <Feather name="user" size={12} color={theme.textMuted} />
            <Text style={[styles.sellerText, { color: theme.textSecondary }]}>
              {item.seller}
            </Text>
            <Text style={[styles.timeText, { color: theme.textMuted }]}>
              {item.postedTime}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function SwapShopScreen() {
  const { theme } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={STUB_SWAP_ITEMS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SwapItemCard item={item} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <Pressable
            style={[styles.postButton, { backgroundColor: theme.primary }]}
          >
            <Feather name="plus" size={20} color="#FFFFFF" />
            <Text style={styles.postButtonText}>{microcopy.post} Item</Text>
          </Pressable>
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
  postButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  postButtonText: {
    color: "#FFFFFF",
    ...Typography.h4,
  },
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardContent: {
    flexDirection: "row",
  },
  imagePlaceholder: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  cardDetails: {
    flex: 1,
    padding: Spacing.md,
  },
  cardTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xxs,
  },
  cardPrice: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  conditionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.full,
  },
  conditionText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  locationText: {
    ...Typography.caption,
  },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  sellerText: {
    ...Typography.caption,
  },
  timeText: {
    ...Typography.caption,
    marginLeft: "auto",
  },
  separator: {
    height: Spacing.md,
  },
});
