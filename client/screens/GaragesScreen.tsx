import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import { brand } from "@/constants/brand";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ApiGarage {
  id: string;
  name: string;
  description: string | null;
  brandColor: string | null;
  memberCount: number;
  threadCount: number;
  isJoined: boolean;
  latestActivityAt: string | null;
}

function formatTimeAgo(dateString: string | null): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return "Just now";
}

function GarageCard({ item, onPress }: { item: ApiGarage; onPress: () => void }) {
  const { theme } = useTheme();
  const brandColor = item.brandColor || theme.primary;
  const latestActivity = formatTimeAgo(item.latestActivityAt);

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
      <LinearGradient
        colors={[brandColor, brandColor + "00"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.heroAccent, { borderTopLeftRadius: BorderRadius.md, borderTopRightRadius: BorderRadius.md }]}
      />

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={[styles.brandBadge, { backgroundColor: brandColor }]}>
            <Text style={styles.brandBadgeText}>{item.name.charAt(0)}</Text>
          </View>
          <View style={styles.cardTitleRow}>
            <View style={styles.titleWithBadge}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{item.name}</Text>
              {item.isJoined ? (
                <View style={[styles.joinedBadge, { backgroundColor: theme.success + "20" }]}>
                  <Feather name="check" size={10} color={theme.success} />
                </View>
              ) : null}
            </View>
            {item.description ? (
              <Text style={[styles.descriptionText, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.cardStats}>
          <View style={styles.statsLeft}>
            <View style={styles.statItem}>
              <Feather name="users" size={13} color={theme.textMuted} />
              <Text style={[styles.statText, { color: theme.textMuted }]}>
                {item.memberCount.toLocaleString()}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Feather name="message-circle" size={13} color={theme.textMuted} />
              <Text style={[styles.statText, { color: theme.textMuted }]}>
                {item.threadCount}
              </Text>
            </View>
          </View>
          {latestActivity ? (
            <Text style={[styles.activityText, { color: theme.textMuted }]}>
              Active {latestActivity}
            </Text>
          ) : null}
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

  const { data: garages = [], isLoading, isError, refetch, isRefetching } = useQuery<ApiGarage[]>({
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
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <Skeleton.List count={5} style={{ paddingTop: isDesktop ? Spacing.xl : headerHeight + Spacing.lg }} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <EmptyState
          icon="alert-circle"
          title="Couldn't Load Bays"
          description="Something went wrong. Tap below to try again."
          actionLabel="Retry"
          onAction={() => refetch()}
        />
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
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListHeaderComponent={
          <View style={numColumns > 1 ? styles.gridHeader : undefined}>
            <Text style={[styles.tagline, { color: theme.textSecondary }]}>
              {brand.tagline}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="users"
            title="No Bays Available"
            description="Bays haven't been set up yet. Pull down to refresh."
            actionLabel="Retry"
            onAction={() => refetch()}
          />
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
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  heroAccent: {
    height: 4,
  },
  cardBody: {
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
  titleWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  cardTitle: {
    ...Typography.h4,
  },
  descriptionText: {
    ...Typography.caption,
    marginTop: 2,
  },
  cardStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    ...Typography.caption,
  },
  activityText: {
    ...Typography.caption,
    fontSize: 11,
  },
  joinedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  gridHeader: {
    width: "100%",
    marginBottom: Spacing.md,
  },
});
