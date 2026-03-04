import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import { brand } from "@/constants/brand";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ApiGarage {
  id: string;
  name: string;
  description: string | null;
  brandColor: string | null;
  memberCount: number;
  threadCount: number;
}

function GarageCard({ item, onPress }: { item: ApiGarage; onPress: () => void }) {
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
      testID={`garage-card-${item.id}`}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.brandBadge, { backgroundColor: item.brandColor || theme.primary }]}>
          <Text style={styles.brandBadgeText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{item.name}</Text>
          {item.description ? (
            <Text style={[styles.descriptionText, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.cardStats}>
        <View style={styles.statItem}>
          <Feather name="users" size={14} color={theme.textMuted} />
          <Text style={[styles.statText, { color: theme.textMuted }]}>
            {item.memberCount.toLocaleString()} {item.memberCount === 1 ? "member" : "members"}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Feather name="message-circle" size={14} color={theme.textMuted} />
          <Text style={[styles.statText, { color: theme.textMuted }]}>
            {item.threadCount} {item.threadCount === 1 ? "thread" : "threads"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function GaragesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { isDesktop, width } = useResponsive();

  const numColumns = isDesktop ? (width >= 1280 ? 3 : 2) : 1;

  const { data: garages = [], isLoading } = useQuery<ApiGarage[]>({
    queryKey: ["/api/garages"],
  });

  const handleGaragePress = (garage: ApiGarage) => {
    navigation.navigate("GarageDetail", {
      garageId: garage.id,
      garageName: garage.name,
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        key={`garages-${numColumns}`}
        data={garages}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        renderItem={({ item }) => (
          <View style={numColumns > 1 ? { flex: 1, padding: Spacing.xs } : undefined}>
            <GarageCard item={item} onPress={() => handleGaragePress(item)} />
          </View>
        )}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: isDesktop ? Spacing.xl : headerHeight + Spacing.lg,
            paddingBottom: isDesktop ? Spacing.xl : insets.bottom + 80 + Spacing.lg,
            maxWidth: isDesktop ? 1200 : undefined,
            alignSelf: isDesktop ? "center" : undefined,
            width: isDesktop ? "100%" : undefined,
          },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={numColumns > 1 ? styles.gridHeader : undefined}>
            <Text style={[styles.tagline, { color: theme.textSecondary }]}>
              {brand.tagline}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
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
  descriptionText: {
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
  gridHeader: {
    width: "100%",
    marginBottom: Spacing.md,
  },
});
