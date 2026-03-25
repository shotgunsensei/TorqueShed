import React, { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { useResponsive } from "@/hooks/useResponsive";
import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { Thread } from "@/constants/garages";
import { microcopy, emptyStates } from "@/constants/brand";
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
  yearsWrenching: number | null;
  focusAreas: string[];
  solutionCountTotal: number;
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

interface Contributor {
  id: string;
  username: string;
  replyCount: number;
  yearsWrenching: number | null;
  focusAreas: string[];
}

type TabKey = "all" | "questions" | "solved" | "pinned";

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

function transformToThread(apiThread: ApiThread): Thread & { yearsWrenching: number | null; focusAreas: string[]; solutionCountTotal: number } {
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
    yearsWrenching: apiThread.yearsWrenching,
    focusAreas: apiThread.focusAreas || [],
    solutionCountTotal: apiThread.solutionCountTotal || 0,
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

  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleNewThread = () => {
    navigation.navigate("AddThread", { garageId });
  };

  const { data: garage } = useQuery<ApiGarageDetail>({
    queryKey: [`/api/garages/${garageId}`],
  });

  const { data: apiThreads = [], isLoading: threadsLoading, refetch: refetchThreads, isRefetching } = useQuery<ApiThread[]>({
    queryKey: [`/api/garages/${garageId}/threads`],
  });

  const { data: contributors = [] } = useQuery<Contributor[]>({
    queryKey: [`/api/garages/${garageId}/top-contributors`],
  });

  const toast = useToast();

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
      toast.show(garage?.isJoined ? "Left bay" : "Joined bay", "success");
    },
    onError: () => {
      toast.show("Failed to update membership", "error");
    },
  });

  const threads = useMemo(() => {
    let filtered = apiThreads
      .map(transformToThread)
      .sort((a, b) => {
        if (a.hasSolution !== b.hasSolution) return a.hasSolution ? 1 : -1;
        return b.lastActivityTime - a.lastActivityTime;
      });

    if (activeTab === "questions") {
      filtered = filtered.filter((t) => !t.hasSolution);
    } else if (activeTab === "solved") {
      filtered = filtered.filter((t) => t.hasSolution);
    } else if (activeTab === "pinned") {
      filtered = filtered.filter((_, i) => {
        const orig = apiThreads[i];
        return orig?.isPinned;
      });
      filtered = apiThreads
        .filter((t) => t.isPinned)
        .map(transformToThread);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) => t.title.toLowerCase().includes(q) || t.author.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [apiThreads, activeTab, searchQuery]);

  const renderThread = useCallback(({ item }: { item: Thread & { yearsWrenching: number | null; focusAreas: string[]; solutionCountTotal: number } }) => {
    const isTrustedSolver = (item.solutionCountTotal || 0) >= 3;
    return (
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
          <View style={styles.authorInfo}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              by {item.author}
            </ThemedText>
            {isTrustedSolver ? (
              <View style={[styles.credBadge, { backgroundColor: theme.success + "18" }]}>
                <Feather name="award" size={9} color={theme.success} />
                <ThemedText type="caption" style={{ color: theme.success, fontSize: 10, marginLeft: 2 }}>
                  Trusted Solver
                </ThemedText>
              </View>
            ) : null}
            {item.yearsWrenching ? (
              <View style={[styles.credBadge, { backgroundColor: theme.backgroundTertiary }]}>
                <Feather name="tool" size={9} color={theme.textMuted} />
                <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 10, marginLeft: 2 }}>
                  {item.yearsWrenching}yr
                </ThemedText>
              </View>
            ) : null}
          </View>
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
    );
  }, [theme, navigation]);

  const renderEmptyThreads = () => {
    if (threadsLoading) {
      return <Skeleton.List count={3} />;
    }
    if (activeTab !== "all") {
      const labelMap: Record<string, string> = { solved: "solved", pinned: "pinned", questions: "unsolved" };
      const iconMap: Record<string, string> = { solved: "check-circle", pinned: "bookmark", questions: "help-circle" };
      const label = labelMap[activeTab] || activeTab;
      return (
        <EmptyState
          icon={(iconMap[activeTab] || "message-circle") as any}
          title={`No ${label} threads`}
          description={`There are no ${label} threads in this bay yet`}
        />
      );
    }
    return (
      <EmptyState
        icon="message-circle"
        title={emptyStates.threads.title}
        description={emptyStates.threads.message}
        actionLabel={emptyStates.threads.action}
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
  const brandColor = garage?.brandColor || theme.primary;

  const solvedCount = apiThreads.filter((t) => t.hasSolution).length;

  const tabs: { key: TabKey; label: string; count: number | null }[] = [
    { key: "all", label: "All", count: apiThreads.length },
    { key: "questions", label: "Questions", count: apiThreads.filter((t) => !t.hasSolution).length },
    { key: "solved", label: "Solved", count: solvedCount },
    { key: "pinned", label: "Pinned", count: apiThreads.filter((t) => t.isPinned).length },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        style={[styles.threadList, desktopContentStyle]}
        contentContainerStyle={[
          styles.threadContent,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl + 70,
          },
          threads.length === 0 ? styles.emptyContent : null,
        ]}
        data={threads}
        renderItem={renderThread}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyThreads}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetchThreads}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListHeaderComponent={
          <View>
            <LinearGradient
              colors={[brandColor + "30", brandColor + "08", "transparent"]}
              style={styles.heroHeader}
            >
              <View style={styles.heroContent}>
                <View style={[styles.heroBadge, { backgroundColor: brandColor }]}>
                  <ThemedText type="h2" style={{ color: "#FFFFFF" }}>
                    {(garage?.name || "B").charAt(0)}
                  </ThemedText>
                </View>
                <View style={styles.heroInfo}>
                  <ThemedText type="h3">{garage?.name || "Bay"}</ThemedText>
                  {garage?.description ? (
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                      {garage.description}
                    </ThemedText>
                  ) : null}
                  <View style={styles.heroStats}>
                    <View style={styles.statItem}>
                      <Feather name="users" size={13} color={theme.textMuted} />
                      <ThemedText type="caption" style={{ color: theme.textMuted, marginLeft: 4 }}>
                        {memberCount} {memberCount === 1 ? "member" : "members"}
                      </ThemedText>
                    </View>
                    <View style={styles.statItem}>
                      <Feather name="message-circle" size={13} color={theme.textMuted} />
                      <ThemedText type="caption" style={{ color: theme.textMuted, marginLeft: 4 }}>
                        {garage?.threadCount ?? 0} threads
                      </ThemedText>
                    </View>
                    {solvedCount > 0 ? (
                      <View style={styles.statItem}>
                        <Feather name="check-circle" size={13} color={theme.success} />
                        <ThemedText type="caption" style={{ color: theme.success, marginLeft: 4 }}>
                          {solvedCount} solved
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.joinButton,
                  {
                    backgroundColor: isJoined ? theme.backgroundTertiary : brandColor,
                    borderColor: isJoined ? theme.border : brandColor,
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
            </LinearGradient>

            {contributors.length > 0 ? (
              <View style={styles.contributorsSection}>
                <ThemedText type="caption" style={{ color: theme.textMuted, fontWeight: "600", marginBottom: Spacing.sm }}>
                  TOP CONTRIBUTORS
                </ThemedText>
                <FlatList
                  horizontal
                  data={contributors}
                  keyExtractor={(c) => c.id}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item: c }) => (
                    <View
                      style={[styles.contributorChip, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}
                    >
                      <View style={[styles.contributorAvatar, { backgroundColor: brandColor + "20" }]}>
                        <ThemedText type="caption" style={{ color: brandColor, fontWeight: "700" }}>
                          {c.username.charAt(0).toUpperCase()}
                        </ThemedText>
                      </View>
                      <View>
                        <ThemedText type="caption" style={{ fontWeight: "600" }} numberOfLines={1}>
                          {c.username}
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 10 }}>
                          {c.replyCount} {c.replyCount === 1 ? "reply" : "replies"}
                        </ThemedText>
                      </View>
                    </View>
                  )}
                />
              </View>
            ) : null}

            <View style={[styles.searchBar, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
              <Feather name="search" size={16} color={theme.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search threads..."
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                testID="input-search-threads"
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Feather name="x" size={16} color={theme.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.tabBar}>
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    style={[
                      styles.tab,
                      {
                        backgroundColor: isActive ? brandColor + "20" : "transparent",
                        borderColor: isActive ? brandColor : "transparent",
                      },
                    ]}
                    onPress={() => setActiveTab(tab.key)}
                    testID={`tab-${tab.key}`}
                  >
                    <ThemedText
                      type="caption"
                      style={{
                        color: isActive ? brandColor : theme.textSecondary,
                        fontWeight: isActive ? "700" : "400",
                      }}
                    >
                      {tab.label}
                    </ThemedText>
                    {tab.count !== null && tab.count > 0 ? (
                      <ThemedText
                        type="caption"
                        style={{
                          color: isActive ? brandColor : theme.textMuted,
                          fontSize: 10,
                          marginLeft: 4,
                        }}
                      >
                        {tab.count}
                      </ThemedText>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
      />

      <Pressable
        style={[styles.fabSecondary, { backgroundColor: theme.backgroundSecondary, borderColor: theme.primary, bottom: tabBarHeight + Spacing.lg + 60 }]}
        onPress={() => navigation.navigate("AskForHelp")}
        testID="button-ask-help-bay"
      >
        <Feather name="help-circle" size={22} color={theme.primary} />
      </Pressable>

      <Pressable
        style={[styles.fab, { backgroundColor: brandColor, bottom: tabBarHeight + Spacing.lg }]}
        onPress={handleNewThread}
        testID="button-new-thread"
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  heroHeader: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  heroBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  heroStats: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.xs,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  contributorsSection: {
    marginBottom: Spacing.md,
  },
  contributorChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginRight: Spacing.sm,
    gap: Spacing.sm,
  },
  contributorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  tabBar: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
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
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  credBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  threadStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  replyCount: {
    marginLeft: 4,
    marginRight: Spacing.sm,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabSecondary: {
    position: "absolute",
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
});
