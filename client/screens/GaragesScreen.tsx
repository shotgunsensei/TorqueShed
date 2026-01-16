import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import { brand, emptyStates, microcopy } from "@/constants/brand";
import type { GaragesStackParamList } from "@/navigation/GaragesStackNavigator";

type NavigationProp = NativeStackNavigationProp<GaragesStackParamList>;

interface GarageItem {
  id: string;
  name: string;
  brandColor: string;
  memberCount: number;
  onlineCount: number;
  latestMessageTime: string;
  hotThreads: number;
}

const STUB_GARAGES: GarageItem[] = [
  { id: "ford", name: "Ford Garage", brandColor: "#003478", memberCount: 1247, onlineCount: 42, latestMessageTime: "2m ago", hotThreads: 3 },
  { id: "dodge", name: "Dodge Garage", brandColor: "#C8102E", memberCount: 892, onlineCount: 28, latestMessageTime: "5m ago", hotThreads: 2 },
  { id: "chevy", name: "Chevy Garage", brandColor: "#F2A900", memberCount: 1089, onlineCount: 35, latestMessageTime: "1m ago", hotThreads: 4 },
  { id: "jeep", name: "Jeep Garage", brandColor: "#006341", memberCount: 756, onlineCount: 21, latestMessageTime: "8m ago", hotThreads: 1 },
  { id: "general", name: "General Garage", brandColor: "#6B6B6B", memberCount: 2341, onlineCount: 67, latestMessageTime: "Just now", hotThreads: 5 },
  { id: "swap-shop", name: "Swap Shop", brandColor: "#FF6B35", memberCount: 1532, onlineCount: 48, latestMessageTime: "3m ago", hotThreads: 2 },
];

function GarageCard({ item, onPress }: { item: GarageItem; onPress: () => void }) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.cardBorder,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.brandBadge, { backgroundColor: item.brandColor }]}>
          <Text style={styles.brandBadgeText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{item.name}</Text>
          <View style={styles.onlineRow}>
            <View style={[styles.onlineDot, { backgroundColor: theme.success }]} />
            <Text style={[styles.onlineText, { color: theme.textSecondary }]}>
              {item.onlineCount} {microcopy.online}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardStats}>
        <View style={styles.statItem}>
          <Feather name="users" size={14} color={theme.textMuted} />
          <Text style={[styles.statText, { color: theme.textMuted }]}>
            {item.memberCount.toLocaleString()}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Feather name="message-circle" size={14} color={theme.textMuted} />
          <Text style={[styles.statText, { color: theme.textMuted }]}>
            {item.latestMessageTime}
          </Text>
        </View>
        {item.hotThreads > 0 ? (
          <View style={[styles.hotBadge, { backgroundColor: theme.primary + "20" }]}>
            <Feather name="zap" size={12} color={theme.primary} />
            <Text style={[styles.hotText, { color: theme.primary }]}>
              {item.hotThreads} {microcopy.hot}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function GaragesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const handleGaragePress = (garage: GarageItem) => {
    navigation.navigate("GarageDetail", {
      garageId: garage.id,
      garageName: garage.name,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={STUB_GARAGES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GarageCard item={item} onPress={() => handleGaragePress(item)} />
        )}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>
            {brand.tagline}
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
  tagline: {
    ...Typography.small,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  brandBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  brandBadgeText: {
    color: "#FFFFFF",
    ...Typography.h3,
  },
  cardTitleRow: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  cardTitle: {
    ...Typography.h4,
    marginBottom: 2,
  },
  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.xs,
  },
  onlineText: {
    ...Typography.caption,
  },
  cardStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statText: {
    ...Typography.caption,
  },
  hotBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  hotText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  separator: {
    height: Spacing.md,
  },
});
