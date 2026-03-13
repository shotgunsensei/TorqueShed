import React, { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { Thread } from "@/constants/garages";
import { microcopy } from "@/constants/brand";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

interface ApiThread {
  id: string;
  garageId: string;
  userId: string;
  title: string;
  content: string;
  hasSolution: boolean;
  isPinned: boolean;
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
  userName: string;
}

interface ApiGarageDetail {
  id: string;
  name: string;
  description: string | null;
  brandColor: string | null;
  memberCount: number;
  threadCount: number;
  isJoined: boolean;
}

function formatTimeAgo(dateString: string): string {
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

function transformToThread(apiThread: ApiThread): Thread {
  const lastActivityTime = new Date(apiThread.lastActivityAt).getTime();
  const createdAt = new Date(apiThread.createdAt).getTime();
  const isNew = Date.now() - lastActivityTime < 24 * 60 * 60 * 1000;
  
  return {
    id: apiThread.id,
    garageId: apiThread.garageId,
    title: apiThread.title,
    author: apiThread.userName,
    replies: apiThread.replyCount,
    lastActivity: formatTimeAgo(apiThread.lastActivityAt),
    lastActivityTime,
    hasSolution: apiThread.hasSolution,
    isNew,
    createdAt,
  };
}

type RoutePropType = RouteProp<RootStackParamList, "GarageDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function GarageDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useSafeTabBarHeight();
  const { theme } = useTheme();
  const { isDesktop } = useResponsive();
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { garageId } = route.params;

  const handleNewThread = () => {
    navigation.navigate("AddThread", { garageId });
  };

  const { data: garage } = useQuery<ApiGarageDetail>({
    queryKey: [`/api/garages/${garageId}`],
  });

  const { data: apiThreads = [], isLoading: threadsLoading } = useQuery<ApiThread[]>({
    queryKey: [`/api/garages/${garageId}/threads`],
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (garage?.isJoined) {
        return apiRequest("DELETE", `/api/garages/${garageId}/join`);
      } else {
        return apiRequest("POST", `/api/garages/${garageId}/join`);
      }
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: [`/api/garages/${garageId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/garages"] });
    },
  });

  const threads = useMemo(() => {
    return apiThreads
      .map(transformToThread)
      .sort((a, b) => {
        if (a.hasSolution !== b.hasSolution) return a.hasSolution ? 1 : -1;
        return b.lastActivityTime - a.lastActivityTime;
      });
  }, [apiThreads]);

  const renderThread = useCallback(({ item }: { item: Thread }) => (
    <Pressable
      style={({ pressed }) => [
        styles.threadCard,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: item.isNew ? theme.primary + "40" : theme.cardBorder,
          borderLeftWidth: item.isNew ? 3 : 1,
          borderLeftColor: item.isNew ? theme.primary : theme.cardBorder,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
      onPress={() => navigation.navigate("ThreadDetail", { threadId: item.id })}
      testID={`thread-card-${item.id}`}
    >
      <View style={styles.threadHeader}>
        <ThemedText type="h4" numberOfLines={2} style={styles.threadTitle}>
          {item.title}
        </ThemedText>
        <View style={styles.threadBadges}>
          {item.isNew ? (
            <View style={[styles.badge, { backgroundColor: theme.primary + "20" }]}>
              <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "600" }}>
                {microcopy.new}
              </ThemedText>
            </View>
          ) : null}
          {item.hasSolution ? (
            <View style={[styles.badge, { backgroundColor: theme.success + "20" }]}>
              <Feather name="check-circle" size={10} color={theme.success} />
              <ThemedText type="caption" style={{ color: theme.success, fontWeight: "600", marginLeft: 2 }}>
                {microcopy.solved}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.threadMeta}>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          by {item.author}
        </ThemedText>
        <View style={styles.threadStats}>
          <Feather name="message-circle" size={12} color={theme.textSecondary} />
          <ThemedText
            type="caption"
            style={[styles.replyCount, { color: theme.textSecondary }]}
          >
            {item.replies}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {item.lastActivity}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  ), [theme, navigation]);

  const renderEmptyThreads = () => {
    if (threadsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }
    return (
      <EmptyState
        image={require("../../assets/images/empty-threads.png")}
        title="No Discussions Yet"
        description="Start a new thread and get the conversation going"
        actionLabel="New Thread"
        onAction={handleNewThread}
      />
    );
  };

  const desktopContentStyle = isDesktop ? {
    maxWidth: 800,
    alignSelf: "center" as const,
    width: "100%" as const,
  } : {};

  const isJoined = garage?.isJoined ?? false;
  const memberCount = garage?.memberCount ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        style={[styles.threadList, desktopContentStyle]}
        contentContainerStyle={[
          styles.threadContent,
          { 
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
          threads.length === 0 ? styles.emptyContent : null,
        ]}
        data={threads}
        renderItem={renderThread}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyThreads}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={[styles.garageStats, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
              <View style={styles.statItem}>
                <Feather name="users" size={14} color={theme.textMuted} />
                <ThemedText type="caption" style={{ color: theme.textMuted, marginLeft: 4 }}>
                  {memberCount} {memberCount === 1 ? "member" : "members"}
                </ThemedText>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.joinButton,
                  {
                    backgroundColor: isJoined ? theme.backgroundTertiary : theme.primary,
                    borderColor: isJoined ? theme.border : theme.primary,
                    opacity: pressed || joinMutation.isPending ? 0.8 : 1,
                  },
                ]}
                onPress={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
                testID="button-join-garage"
              >
                <Feather
                  name={isJoined ? "check" : "plus"}
                  size={13}
                  color={isJoined ? theme.text : "#FFFFFF"}
                />
                <ThemedText
                  type="caption"
                  style={{ color: isJoined ? theme.text : "#FFFFFF", fontWeight: "600", marginLeft: 4 }}
                >
                  {isJoined ? "Joined" : "Join Bay"}
                </ThemedText>
              </Pressable>
            </View>

            <Pressable
              style={[styles.newThreadButton, { backgroundColor: theme.primary }]}
              onPress={handleNewThread}
              testID="button-new-thread"
            >
              <Feather name="plus" size={18} color="#FFFFFF" />
              <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                New Thread
              </ThemedText>
            </Pressable>
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
  threadList: {
    flex: 1,
  },
  threadContent: {
    paddingHorizontal: Spacing.lg,
  },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
  },
  garageStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  newThreadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  threadCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  threadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  threadTitle: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  threadBadges: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  threadMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  threadStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  replyCount: {
    marginLeft: 4,
    marginRight: Spacing.sm,
  },
});
