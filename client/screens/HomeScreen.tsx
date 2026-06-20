import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  FlatList,
  Image,
} from "react-native";
import { resolveImageUri } from "@/utils/objectStorageExpo";
import { resolveMediaUrl } from "@/components/MediaPickerRow";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useHeaderHeight } from "@react-navigation/elements";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import { useResponsive } from "@/hooks/useResponsive";
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
  yearsWrenching: number | null;
  solutionCountTotal: number;
  lastActivityAt?: string;
  createdAt?: string;
  photoUrls?: string[] | null;
}

interface FeedListing {
  id: string;
  title: string;
  price: string;
  condition: string;
  userName: string;
  createdAt?: string;
  imageUrl?: string | null;
  extraImageUrls?: string[] | null;
}

interface FeedData {
  vehicles: FeedVehicle[];
  bayThreads: FeedThread[];
  garageThreads: FeedThread[];
  recentListings: FeedListing[];
  joinedGarageIds: string[];
  onboardingGoals: string[];
}

interface ContinueActivity {
  unresolvedThreads: { id: string; title: string; garageId: string; replyCount: number | null; lastActivityAt: string | null; createdAt: string | null; photoUrls?: string[] | null }[];
  activeListings: { id: string; title: string; price: string; condition: string; createdAt: string | null; imageUrl?: string | null; extraImageUrls?: string[] | null }[];
}

interface RecommendedBay {
  id: string;
  name: string;
  description: string | null;
  brandColor: string | null;
  memberCount: number;
}

function formatTimeAgo(dateStr?: string | null): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function isNewContent(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return new Date(dateStr).getTime() > dayAgo;
}

const GARAGE_LABELS: Record<string, { name: string; color: string }> = {
  ford: { name: "Ford", color: BrandColors.ford },
  dodge: { name: "Dodge/Ram", color: BrandColors.dodge },
  chevy: { name: "GM", color: BrandColors.chevy },
  jeep: { name: "Jeep", color: BrandColors.jeep },
  general: { name: "General", color: BrandColors.general },
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
        <Pressable
          onPress={onSeeAll}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={`See all ${title}`}
          testID={`link-see-all-${title.toLowerCase().replace(/\s+/g, "-")}`}
        >
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
      accessibilityLabel={`Vehicle ${vehicle.nickname || "Unnamed"}, ${[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "no details"}, ${vehicle.notesCount} ${vehicle.notesCount === 1 ? "note" : "notes"}`}
      accessibilityHint="Open this vehicle to add a note"
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

  const timeAgo = formatTimeAgo(thread.lastActivityAt || thread.createdAt);
  const isNew = isNewContent(thread.createdAt);

  const photos = thread.photoUrls ?? [];
  const coverPhoto = photos[0];
  const extraCount = Math.max(0, photos.length - 1);

  return (
    <Card
      style={[styles.horizontalCard, { minWidth: 260 }]}
      onPress={onPress}
      testID={`card-thread-${thread.id}`}
      accessibilityLabel={`${thread.title}. By ${thread.userName}. ${thread.replyCount || 0} ${(thread.replyCount || 0) === 1 ? "reply" : "replies"}.${thread.hasSolution ? " Solved." : ""}${isNew ? " New." : ""}${garageInfo ? ` In ${garageInfo.name}.` : ""}${timeAgo ? ` Last activity ${timeAgo}.` : ""}`}
      accessibilityHint="Open repair case"
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
        {garageInfo ? (
          <View style={[styles.garageTag, { backgroundColor: garageInfo.color + "20" }]}>
            <ThemedText type="caption" style={{ color: garageInfo.color, fontWeight: "600" }}>
              {garageInfo.name}
            </ThemedText>
          </View>
        ) : null}
        {isNew ? <StatusBadge label="New" variant="primary" size="sm" /> : null}
      </View>
      <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: garageInfo || isNew ? Spacing.xs : 0 }}>
        {coverPhoto ? (
          <View style={[styles.threadThumbWrap, { borderColor: theme.cardBorder }]}>
            <Image
              source={{ uri: resolveMediaUrl(coverPhoto) }}
              style={styles.threadThumb}
              testID={`thread-thumb-${thread.id}`}
              accessibilityElementsHidden
              importantForAccessibility="no"
              accessible={false}
              alt=""
            />
            {extraCount > 0 ? (
              <View
                style={styles.thumbCountBadge}
                accessible
                accessibilityLabel={`${extraCount} more ${extraCount === 1 ? "photo" : "photos"}`}
              >
                <ThemedText style={styles.thumbCountText}>+{extraCount}</ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}
        <ThemedText type="h4" numberOfLines={2} style={{ flex: 1 }}>
          {thread.title}
        </ThemedText>
      </View>
      <View style={styles.threadMeta}>
        <ThemedText type="caption" style={{ color: theme.textMuted }}>
          {thread.userName}
        </ThemedText>
        {(thread.solutionCountTotal || 0) >= 3 ? (
          <>
            <View style={[styles.threadMetaDot, { backgroundColor: theme.textMuted }]} />
            <Feather name="award" size={10} color={theme.success} />
          </>
        ) : thread.yearsWrenching ? (
          <>
            <View style={[styles.threadMetaDot, { backgroundColor: theme.textMuted }]} />
            <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 10 }}>
              {thread.yearsWrenching}yr
            </ThemedText>
          </>
        ) : null}
        <View style={[styles.threadMetaDot, { backgroundColor: theme.textMuted }]} />
        <Feather name="message-circle" size={12} color={theme.textMuted} />
        <ThemedText type="caption" style={{ color: theme.textMuted }}>
          {thread.replyCount || 0}
        </ThemedText>
        {thread.hasSolution ? (
          <>
            <View style={[styles.threadMetaDot, { backgroundColor: theme.textMuted }]} />
            <Feather name="check-circle" size={12} color={theme.success} />
            <ThemedText type="caption" style={{ color: theme.success }}>
              Solved
            </ThemedText>
          </>
        ) : null}
        {timeAgo ? (
          <>
            <View style={[styles.threadMetaDot, { backgroundColor: theme.textMuted }]} />
            <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 10 }}>
              {timeAgo}
            </ThemedText>
          </>
        ) : null}
      </View>
    </Card>
  );
}

function formatPrice(price: string): string {
  const trimmed = price.trim();
  return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
}

function ListingCard({
  listing,
  onPress,
}: {
  listing: FeedListing;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const listingTimeAgo = formatTimeAgo(listing.createdAt);
  const listingIsNew = isNewContent(listing.createdAt);

  const extraCount = Array.isArray(listing.extraImageUrls) ? listing.extraImageUrls.length : 0;

  return (
    <Card
      style={[styles.horizontalCard, { minWidth: 180 }]}
      onPress={onPress}
      testID={`card-listing-${listing.id}`}
      accessibilityLabel={`${listing.title}, ${formatPrice(listing.price)}, condition ${listing.condition}, by ${listing.userName}${listingTimeAgo ? `, ${listingTimeAgo}` : ""}${listingIsNew ? ", new" : ""}`}
      accessibilityHint="Open listing"
    >
      {listing.imageUrl ? (
        <View style={[styles.listingCover, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundTertiary }]}>
          <Image
            source={{ uri: resolveImageUri(listing.imageUrl) || undefined }}
            style={styles.listingCoverImage}
            testID={`listing-cover-${listing.id}`}
            accessibilityElementsHidden
            importantForAccessibility="no"
            accessible={false}
            alt=""
          />
          {extraCount > 0 ? (
            <View
              style={styles.thumbCountBadge}
              accessible
              accessibilityLabel={`${extraCount} more ${extraCount === 1 ? "photo" : "photos"}`}
            >
              <ThemedText style={styles.thumbCountText}>+{extraCount}</ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}
      {listingIsNew ? (
        <View style={{ marginBottom: Spacing.xs }}>
          <StatusBadge label="New" variant="primary" size="sm" />
        </View>
      ) : null}
      <ThemedText type="h4" numberOfLines={2}>
        {listing.title}
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.primary, fontWeight: "700", marginTop: Spacing.xs }}>
        {formatPrice(listing.price)}
      </ThemedText>
      <View style={styles.threadMeta}>
        <StatusBadge label={listing.condition} variant="muted" size="sm" />
        <ThemedText type="caption" style={{ color: theme.textMuted }}>
          {listing.userName}
        </ThemedText>
        {listingTimeAgo ? (
          <>
            <View style={[styles.threadMetaDot, { backgroundColor: theme.textMuted }]} />
            <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 10 }}>
              {listingTimeAgo}
            </ThemedText>
          </>
        ) : null}
      </View>
    </Card>
  );
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const tabBarHeight = useSafeTabBarHeight();
  const headerHeight = useHeaderHeight();
  const { isDesktop } = useResponsive();

  const { data, isLoading, isError, isRefetching, refetch } = useQuery<FeedData>({
    queryKey: ["/api/feed"],
  });

  const { data: solvedData } = useQuery<FeedThread[]>({
    queryKey: ["/api/feed/solved-this-week"],
    enabled: !!data,
  });

  const { data: recommendedBays } = useQuery<RecommendedBay[]>({
    queryKey: ["/api/feed/recommended-bays"],
    enabled: !!data,
  });

  const { data: continueData } = useQuery<ContinueActivity>({
    queryKey: ["/api/feed/continue-activity"],
    enabled: !!data,
  });

  const vehicles = data?.vehicles || [];
  const bayThreads = data?.bayThreads || [];
  const garageThreads = data?.garageThreads || [];
  const recentListings = data?.recentListings || [];
  const onboardingGoals = data?.onboardingGoals || [];
  const solvedThisWeek = solvedData || [];
  const continueActivity = continueData;
  const recommended = recommendedBays || [];
  const sectionOrder = getSectionOrder(onboardingGoals);

  if (isLoading) {
    return <Skeleton.List count={5} />;
  }

  if (isError) {
    return (
      <EmptyState
        icon="alert-circle"
        title="Couldn't Load Feed"
        description="Something went wrong loading your feed. Pull down to try again."
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  const navigateToTab = (tabName: string, params?: object) => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate(tabName, params);
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
            accessibilityLabel="Add your first vehicle"
            accessibilityHint="Open the add vehicle screen"
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
    bayThreads: (
      <View style={styles.section} key="bayThreads">
        <SectionHeader
          title="Active Repair Cases"
          icon="activity"
          onSeeAll={() => navigateToTab("CasesTab")}
        />
        {bayThreads.length > 0 ? (
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
        ) : (
          <Card
            style={styles.promptCard}
            onPress={() => navigateToTab("CasesTab")}
            testID="card-prompt-join-bay"
            accessibilityLabel="Browse case categories"
            accessibilityHint="Open repair cases"
          >
            <View style={styles.promptContent}>
              <View style={[styles.promptIcon, { backgroundColor: theme.primary + "15" }]}>
                <Feather name="message-circle" size={24} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="h4">Search Solved Cases</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Filter active and solved cases by vehicle, code, or system
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textMuted} />
            </View>
          </Card>
        )}
      </View>
    ),
    garageThreads: (
      <View style={styles.section} key="garageThreads">
        <SectionHeader
          title="Solved for Your Garage"
          icon="check-circle"
          onSeeAll={() => navigateToTab("CasesTab")}
        />
        {garageThreads.length > 0 ? (
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
        ) : (
          <Card
            style={styles.promptCard}
            testID="card-empty-solved-threads"
            accessibilityLabel="No solved cases yet. Solved cases matching your vehicles will appear here."
          >
            <View style={styles.promptContent}>
              <View style={[styles.promptIcon, { backgroundColor: theme.primary + "15" }]}>
                <Feather name="check-circle" size={24} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="h4">No solved cases yet</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Solved cases matching your vehicles will appear here
                </ThemedText>
              </View>
            </View>
          </Card>
        )}
      </View>
    ),
    listings: (
      <View style={styles.section} key="listings">
        <SectionHeader
          title="Parts & Tools That May Help"
          icon="shopping-bag"
          onSeeAll={() => navigateToTab("MarketTab", { screen: "Market", params: { segment: "swap" } })}
        />
        {recentListings.length > 0 ? (
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
        ) : (
          <Card
            style={styles.promptCard}
            onPress={() => navigateToTab("MarketTab", { screen: "Market", params: { segment: "swap" } })}
            testID="card-prompt-browse-swap"
            accessibilityLabel="Browse part and tool listings"
            accessibilityHint="Find parts or tools for a repair"
          >
            <View style={styles.promptContent}>
              <View style={[styles.promptIcon, { backgroundColor: theme.primary + "15" }]}>
                <Feather name="shopping-bag" size={24} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="h4">Browse Parts & Tools</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Find parts or tools tied to real repair work
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textMuted} />
            </View>
          </Card>
        )}
      </View>
    ),
  };

  const hasUnresolved = (continueActivity?.unresolvedThreads?.length ?? 0) > 0;
  const hasActiveListings = (continueActivity?.activeListings?.length ?? 0) > 0;
  const hasContinueActivity = hasUnresolved || hasActiveListings;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        maxWidth: isDesktop ? 1180 : undefined,
        alignSelf: isDesktop ? "center" : undefined,
        width: isDesktop ? "100%" : undefined,
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
        <View style={styles.greetingRow}>
          <ThemedText type="h2" style={{ flex: 1 }}>
            Welcome back{currentUser?.username ? `, ${currentUser.username}` : ""}
          </ThemedText>
          <Pressable
            onPress={() => navigation.navigate("NewCase")}
            style={[styles.helpButton, { backgroundColor: theme.primary + "15", borderColor: theme.primary }]}
            testID="button-ask-help"
            accessibilityRole="button"
            accessibilityLabel="Open a repair case"
            accessibilityHint="Start a repair case with symptoms, evidence, and codes"
          >
            <Feather name="help-circle" size={16} color={theme.primary} />
            <ThemedText type="caption" style={{ color: theme.primary, fontFamily: "Inter_500Medium", marginLeft: 4 }}>
              Start Case
            </ThemedText>
          </Pressable>
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
          Open a repair case, capture evidence, run the next test, and save the verified fix.
        </ThemedText>
      </View>

      {hasContinueActivity ? (
        <View style={styles.section}>
          <SectionHeader title="Continue Your Activity" icon="clock" />
          {hasUnresolved ? (
            continueActivity!.unresolvedThreads.map((t) => {
              const tPhotos = t.photoUrls ?? [];
              const tCover = tPhotos[0];
              const tExtra = Math.max(0, tPhotos.length - 1);
              return (
              <Card
                key={t.id}
                style={styles.activityCard}
                onPress={() => navigation.navigate("ThreadDetail", { threadId: t.id })}
                testID={`card-continue-thread-${t.id}`}
                accessibilityLabel={`Open repair case: ${t.title}, ${t.replyCount || 0} ${(t.replyCount || 0) === 1 ? "reply" : "replies"}${formatTimeAgo(t.lastActivityAt || t.createdAt) ? `, ${formatTimeAgo(t.lastActivityAt || t.createdAt)}` : ""}`}
                accessibilityHint="Open repair case"
              >
                <View style={styles.promptContent}>
                  {tCover ? (
                    <View style={[styles.activityThumbWrap, { borderColor: theme.cardBorder }]}>
                      <Image
                        source={{ uri: resolveMediaUrl(tCover) }}
                        style={styles.threadThumb}
                        testID={`continue-thread-thumb-${t.id}`}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                        accessible={false}
                        alt=""
                      />
                      {tExtra > 0 ? (
                        <View
                          style={styles.thumbCountBadge}
                          accessible
                          accessibilityLabel={`${tExtra} more ${tExtra === 1 ? "photo" : "photos"}`}
                        >
                          <ThemedText style={styles.thumbCountText}>+{tExtra}</ThemedText>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View style={[styles.promptIcon, { backgroundColor: theme.accent + "15", width: 36, height: 36, borderRadius: 18 }]}>
                      <Feather name="message-circle" size={18} color={theme.accent} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" numberOfLines={1} style={{ fontFamily: "Inter_500Medium" }}>
                      {t.title}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textMuted }}>
                      {t.replyCount || 0} {(t.replyCount || 0) === 1 ? "reply" : "replies"} {formatTimeAgo(t.lastActivityAt || t.createdAt)}
                    </ThemedText>
                  </View>
                  <StatusBadge label="Unsolved" variant="warning" size="sm" />
                </View>
              </Card>
              );
            })
          ) : null}
          {hasActiveListings ? (
            continueActivity!.activeListings.map((l) => {
              const lExtra = Array.isArray(l.extraImageUrls) ? l.extraImageUrls.length : 0;
              return (
              <Card
                key={l.id}
                style={styles.activityCard}
                onPress={() => navigation.navigate("ListingDetail", { listingId: l.id })}
                testID={`card-continue-listing-${l.id}`}
                accessibilityLabel={`Active listing: ${l.title}, $${l.price}, ${l.condition}`}
                accessibilityHint="Open listing"
              >
                <View style={styles.promptContent}>
                  {l.imageUrl ? (
                    <View style={[styles.activityThumbWrap, { borderColor: theme.cardBorder }]}>
                      <Image
                        source={{ uri: resolveImageUri(l.imageUrl) || undefined }}
                        style={styles.threadThumb}
                        testID={`continue-listing-thumb-${l.id}`}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                        accessible={false}
                        alt=""
                      />
                      {lExtra > 0 ? (
                        <View
                          style={styles.thumbCountBadge}
                          accessible
                          accessibilityLabel={`${lExtra} more ${lExtra === 1 ? "photo" : "photos"}`}
                        >
                          <ThemedText style={styles.thumbCountText}>+{lExtra}</ThemedText>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View style={[styles.promptIcon, { backgroundColor: theme.primary + "15", width: 36, height: 36, borderRadius: 18 }]}>
                      <Feather name="tag" size={18} color={theme.primary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" numberOfLines={1} style={{ fontFamily: "Inter_500Medium" }}>
                      {l.title}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textMuted }}>
                      ${l.price} - {l.condition}
                    </ThemedText>
                  </View>
                  <StatusBadge label="Active" variant="success" size="sm" />
                </View>
              </Card>
              );
            })
          ) : null}
        </View>
      ) : null}

      {sectionOrder.map((key) => sections[key])}

      {solvedThisWeek.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Solved This Week" icon="check-circle" />
          <FlatList
            horizontal
            data={solvedThisWeek}
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
      ) : null}

      {recommended.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="Recommended Categories"
            icon="compass"
            onSeeAll={() => navigateToTab("CasesTab")}
          />
          {recommended.map((bay) => {
            const bayInfo = GARAGE_LABELS[bay.id];
            const color = bayInfo?.color || theme.primary;
            return (
              <Card
                key={bay.id}
                style={styles.activityCard}
                onPress={() => navigation.navigate("GarageDetail", { garageId: bay.id, garageName: bay.name })}
                testID={`card-recommended-bay-${bay.id}`}
                accessibilityLabel={`${bay.name}, ${bay.memberCount} ${bay.memberCount === 1 ? "member" : "members"}${bay.description ? `. ${bay.description}` : ""}`}
                accessibilityHint="Open this repair category"
              >
                <View style={styles.promptContent}>
                  <View style={[styles.promptIcon, { backgroundColor: color + "15", width: 40, height: 40, borderRadius: 20 }]}>
                    <Feather name="users" size={20} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" style={{ fontFamily: "Inter_500Medium" }}>
                      {bay.name}
                    </ThemedText>
                    {bay.description ? (
                      <ThemedText type="caption" numberOfLines={1} style={{ color: theme.textSecondary }}>
                        {bay.description}
                      </ThemedText>
                    ) : null}
                    <ThemedText type="caption" style={{ color: theme.textMuted }}>
                      {bay.memberCount} {bay.memberCount === 1 ? "member" : "members"}
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.textMuted} />
                </View>
              </Card>
            );
          })}
        </View>
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
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },
  helpButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
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
  threadThumbWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    borderWidth: 1,
  },
  activityThumbWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    borderWidth: 1,
  },
  threadThumb: {
    width: "100%",
    height: "100%",
  },
  thumbCountBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  thumbCountText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  listingCover: {
    width: "100%",
    height: 100,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  listingCoverImage: {
    width: "100%",
    height: "100%",
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
  },
  conditionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.xs,
  },
  activityCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
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
