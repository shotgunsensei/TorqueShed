import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  FlatList,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FeedVehicle {
  id: string;
  nickname: string | null;
  year: string | null;
  make: string | null;
  model: string | null;
  notesCount: number;
}

interface FeedThread {
  id: string;
  garageId: string;
  title: string;
  userName: string;
  replyCount: number | null;
  hasSolution: boolean | null;
}

interface FeedListing {
  id: string;
  title: string;
  price: string;
  condition: string;
  userName: string;
}

interface FeedData {
  vehicles: FeedVehicle[];
  bayThreads: FeedThread[];
  garageThreads: FeedThread[];
  recentListings: FeedListing[];
  joinedGarageIds: string[];
  onboardingGoals: string[];
}

const GARAGE_LABELS: Record<string, { name: string; color: string }> = {
  ford: { name: "Ford Bay", color: BrandColors.ford },
  dodge: { name: "Dodge Bay", color: BrandColors.dodge },
  chevy: { name: "Chevy Bay", color: BrandColors.chevy },
  jeep: { name: "Jeep Bay", color: BrandColors.jeep },
  general: { name: "General Bay", color: BrandColors.general },
};

const GOAL_TO_SECTION_ORDER: Record<string, string[]> = {
  build: ["vehicles", "garageThreads", "bayThreads", "listings"],
  diagnose: ["garageThreads", "vehicles", "bayThreads", "listings"],
  community: ["bayThreads", "garageThreads", "listings", "vehicles"],
  trade: ["listings", "bayThreads", "garageThreads", "vehicles"],
  "find-parts": ["listings", "garageThreads", "bayThreads", "vehicles"],
  learn: ["garageThreads", "bayThreads", "vehicles", "listings"],
};

const DEFAULT_SECTION_ORDER = ["vehicles", "bayThreads", "garageThreads", "listings"];

function getSectionOrder(goals: string[]): string[] {
  if (goals.length === 0) return DEFAULT_SECTION_ORDER;
  const primaryGoal = goals[0];
  return GOAL_TO_SECTION_ORDER[primaryGoal] || DEFAULT_SECTION_ORDER;
}

function SectionHeader({
  title,
  icon,
  onSeeAll,
}: {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  onSeeAll?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Feather name={icon} size={18} color={theme.primary} />
        <ThemedText type="h3" style={styles.sectionTitle}>
          {title}
        </ThemedText>
      </View>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <ThemedText type="link" style={{ color: theme.primary, fontSize: 13 }}>
            See All
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function VehicleCard({
  vehicle,
  onPress,
}: {
  vehicle: FeedVehicle;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Card
      style={[styles.horizontalCard, { minWidth: 200 }]}
      onPress={onPress}
      testID={`card-vehicle-${vehicle.id}`}
    >
      <View style={[styles.vehicleIcon, { backgroundColor: theme.primary + "15" }]}>
        <Feather name="truck" size={22} color={theme.primary} />
      </View>
      <ThemedText type="h4" numberOfLines={1}>
        {vehicle.nickname || "Unnamed"}
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
        {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
      </ThemedText>
      <View style={[styles.badge, { backgroundColor: theme.backgroundTertiary }]}>
        <Feather name="file-text" size={12} color={theme.textMuted} />
        <ThemedText type="caption" style={{ color: theme.textMuted }}>
          {vehicle.notesCount} {vehicle.notesCount === 1 ? "note" : "notes"}
        </ThemedText>
      </View>
    </Card>
  );
}

function ThreadCard({
  thread,
  onPress,
}: {
  thread: FeedThread;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const garageInfo = GARAGE_LABELS[thread.garageId];

  return (
    <Card
      style={[styles.horizontalCard, { minWidth: 260 }]}
      onPress={onPress}
      testID={`card-thread-${thread.id}`}
    >
      {garageInfo ? (
        <View style={[styles.garageTag, { backgroundColor: garageInfo.color + "20" }]}>
          <ThemedText type="caption" style={{ color: garageInfo.color, fontWeight: "600" }}>
            {garageInfo.name}
          </ThemedText>
        </View>
      ) : null}
      <ThemedText type="h4" numberOfLines={2} style={{ marginTop: garageInfo ? Spacing.xs : 0 }}>
        {thread.title}
      </ThemedText>
      <View style={styles.threadMeta}>
        <ThemedText type="caption" style={{ color: theme.textMuted }}>
          {thread.userName}
        </ThemedText>
        <View style={styles.threadMetaDot} />
        <Feather name="message-circle" size={12} color={theme.textMuted} />
        <ThemedText type="caption" style={{ color: theme.textMuted }}>
          {thread.replyCount || 0}
        </ThemedText>
        {thread.hasSolution ? (
          <>
            <View style={styles.threadMetaDot} />
            <Feather name="check-circle" size={12} color={theme.success} />
            <ThemedText type="caption" style={{ color: theme.success }}>
              Solved
            </ThemedText>
          </>
        ) : null}
      </View>
    </Card>
  );
}

function ListingCard({
  listing,
  onPress,
}: {
  listing: FeedListing;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Card
      style={[styles.horizontalCard, { minWidth: 180 }]}
      onPress={onPress}
      testID={`card-listing-${listing.id}`}
    >
      <ThemedText type="h4" numberOfLines={2}>
        {listing.title}
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.primary, fontWeight: "700", marginTop: Spacing.xs }}>
        ${listing.price}
      </ThemedText>
      <View style={styles.threadMeta}>
        <View style={[styles.conditionBadge, { backgroundColor: theme.backgroundTertiary }]}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {listing.condition}
          </ThemedText>
        </View>
        <ThemedText type="caption" style={{ color: theme.textMuted }}>
          {listing.userName}
        </ThemedText>
      </View>
    </Card>
  );
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const tabBarHeight = useSafeTabBarHeight();

  const { data, isLoading, isRefetching, refetch } = useQuery<FeedData>({
    queryKey: ["/api/feed"],
  });

  const vehicles = data?.vehicles || [];
  const bayThreads = data?.bayThreads || [];
  const garageThreads = data?.garageThreads || [];
  const recentListings = data?.recentListings || [];
  const onboardingGoals = data?.onboardingGoals || [];
  const sectionOrder = getSectionOrder(onboardingGoals);

  if (isLoading) {
    return <Skeleton.List count={5} />;
  }

  const navigateToTab = (tabName: string) => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate(tabName);
    }
  };

  const sections: Record<string, React.ReactNode> = {
    vehicles: (
      <View style={styles.section} key="vehicles">
        <SectionHeader
          title="Your Vehicles"
          icon="truck"
          onSeeAll={() => navigateToTab("NotesTab")}
        />
        {vehicles.length > 0 ? (
          <FlatList
            horizontal
            data={vehicles}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <VehicleCard
                vehicle={item}
                onPress={() => navigation.navigate("AddNote", { vehicleId: item.id })}
              />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        ) : (
          <Card
            style={styles.promptCard}
            onPress={() => navigation.navigate("AddVehicle")}
            testID="button-add-vehicle-prompt"
          >
            <View style={styles.promptContent}>
              <View style={[styles.promptIcon, { backgroundColor: theme.primary + "15" }]}>
                <Feather name="plus-circle" size={24} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="h4">Add Your First Vehicle</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Track maintenance and modifications
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textMuted} />
            </View>
          </Card>
        )}
      </View>
    ),
    bayThreads: bayThreads.length > 0 ? (
      <View style={styles.section} key="bayThreads">
        <SectionHeader
          title="Recent Activity"
          icon="activity"
          onSeeAll={() => navigateToTab("GaragesTab")}
        />
        <FlatList
          horizontal
          data={bayThreads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ThreadCard
              thread={item}
              onPress={() => navigation.navigate("ThreadDetail", { threadId: item.id })}
            />
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        />
      </View>
    ) : null,
    garageThreads: garageThreads.length > 0 ? (
      <View style={styles.section} key="garageThreads">
        <SectionHeader
          title="For Your Garage"
          icon="check-circle"
          onSeeAll={() => navigateToTab("GaragesTab")}
        />
        <FlatList
          horizontal
          data={garageThreads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ThreadCard
              thread={item}
              onPress={() => navigation.navigate("ThreadDetail", { threadId: item.id })}
            />
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        />
      </View>
    ) : null,
    listings: recentListings.length > 0 ? (
      <View style={styles.section} key="listings">
        <SectionHeader
          title="New in Swap Shop"
          icon="shopping-bag"
          onSeeAll={() => navigateToTab("SwapTab")}
        />
        <FlatList
          horizontal
          data={recentListings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() => navigation.navigate("ListingDetail", { listingId: item.id })}
            />
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        />
      </View>
    ) : null,
  };

  const hasContent = vehicles.length > 0 || bayThreads.length > 0 || garageThreads.length > 0 || recentListings.length > 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingBottom: tabBarHeight + Spacing.xl,
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={theme.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.greeting}>
        <ThemedText type="h2">
          Welcome back{currentUser?.username ? `, ${currentUser.username}` : ""}
        </ThemedText>
      </View>

      {sectionOrder.map((key) => sections[key])}

      {!hasContent ? (
        <EmptyState
          icon="compass"
          title="Your feed is empty"
          message="Add a vehicle, join some Bays, or check out the Swap Shop to get started"
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  greeting: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
  },
  horizontalList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  horizontalCard: {
    padding: Spacing.lg,
    maxWidth: 280,
  },
  vehicleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xxs,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.xs,
  },
  garageTag: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.xs,
  },
  threadMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  threadMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#666",
  },
  conditionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.xs,
  },
  promptCard: {
    marginHorizontal: Spacing.lg,
  },
  promptContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  promptIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});
