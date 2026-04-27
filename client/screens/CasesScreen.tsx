import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  TextInput,
  ScrollView,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { StatusBadge } from "@/components/StatusBadge";
import { resolveMediaUrl } from "@/components/MediaPickerRow";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { useToast } from "@/components/Toast";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { CasesStackParamList } from "@/navigation/CasesStackNavigator";

type RootNavProp = NativeStackNavigationProp<RootStackParamList>;
type CasesNavProp = NativeStackNavigationProp<CasesStackParamList>;

interface CaseRow {
  id: string;
  garageId: string;
  userId: string | null;
  title: string;
  content: string;
  hasSolution: boolean | null;
  isPinned: boolean | null;
  replyCount: number | null;
  vehicleId: string | null;
  symptoms: string[] | null;
  obdCodes: string[] | null;
  severity: number | null;
  drivability: number | null;
  status: string | null;
  systemCategory: string | null;
  urgency: string | null;
  rootCause: string | null;
  finalFix: string | null;
  lastActivityAt: string | null;
  createdAt: string | null;
  userName: string;
  vehicleName: string | null;
  photoUrls: string[] | null;
  videoUrls: string[] | null;
}

interface GarageInfo {
  id: string;
  name: string;
  brandColor: string | null;
}

type StatusFilter = "all" | "open" | "testing" | "needs_expert" | "solved" | "pinned";

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { key: "all", label: "All", icon: "list" },
  { key: "open", label: "Open", icon: "circle" },
  { key: "testing", label: "Testing", icon: "activity" },
  { key: "needs_expert", label: "Needs Expert", icon: "alert-circle" },
  { key: "solved", label: "Solved", icon: "check-circle" },
  { key: "pinned", label: "Pinned", icon: "bookmark" },
];

const SYSTEM_FILTERS: Array<{ key: string; label: string }> = [
  { key: "engine", label: "Engine" },
  { key: "electrical", label: "Electrical" },
  { key: "transmission", label: "Transmission" },
  { key: "brakes", label: "Brakes" },
  { key: "suspension", label: "Suspension" },
  { key: "cooling", label: "Cooling" },
  { key: "fuel", label: "Fuel" },
  { key: "exhaust", label: "Exhaust" },
  { key: "hvac", label: "HVAC" },
];

function statusToBadge(status: string | null, hasSolution: boolean | null): {
  label: string;
  variant: "success" | "warning" | "error" | "primary" | "muted" | "default";
  icon: keyof typeof Feather.glyphMap;
} {
  const effective = hasSolution || status === "solved" ? "solved" : status ?? "open";
  switch (effective) {
    case "solved":
      return { label: "Solved", variant: "success", icon: "check-circle" };
    case "testing":
      return { label: "Testing", variant: "primary", icon: "activity" };
    case "needs_expert":
      return { label: "Needs Expert", variant: "warning", icon: "alert-circle" };
    default:
      return { label: "Open", variant: "default", icon: "circle" };
  }
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMins > 0) return `${diffMins}m`;
  return "now";
}

function CaseCard({
  item,
  garage,
  onPress,
}: {
  item: CaseRow;
  garage: GarageInfo | undefined;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const badge = statusToBadge(item.status, item.hasSolution);
  const brandColor = garage?.brandColor || theme.primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.cardBorder,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      testID={`case-card-${item.id}`}
    >
      <View style={[styles.cardAccent, { backgroundColor: brandColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <StatusBadge label={badge.label} variant={badge.variant} icon={badge.icon} size="sm" />
            {item.isPinned ? (
              <StatusBadge label="Pinned" variant="muted" icon="bookmark" size="sm" />
            ) : null}
            {item.systemCategory ? (
              <StatusBadge label={item.systemCategory} variant="muted" size="sm" />
            ) : null}
            {item.urgency === "stranded" || item.urgency === "high" ? (
              <StatusBadge
                label={item.urgency === "stranded" ? "Stranded" : "High urgency"}
                variant="error"
                icon="zap"
                size="sm"
              />
            ) : null}
          </View>
          <Text style={[styles.timeText, { color: theme.textMuted }]}>
            {formatTimeAgo(item.lastActivityAt ?? item.createdAt)}
          </Text>
        </View>

        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
          {item.title}
        </Text>

        {(item.photoUrls && item.photoUrls.length > 0) || (item.videoUrls && item.videoUrls.length > 0) ? (
          <View style={styles.thumbStrip}>
            {(item.photoUrls ?? []).slice(0, 3).map((p, i) => (
              <Image
                key={`tp-${i}`}
                source={{ uri: resolveMediaUrl(p) }}
                style={[styles.thumb, { borderColor: theme.cardBorder }]}
                testID={`case-thumb-${item.id}-${i}`}
              />
            ))}
            {(item.videoUrls ?? []).length > 0 ? (
              <View style={[styles.thumb, styles.videoBadge, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundTertiary }]}>
                <Feather name="film" size={16} color={theme.textMuted} />
              </View>
            ) : null}
            {((item.photoUrls?.length ?? 0) + (item.videoUrls?.length ?? 0)) > 4 ? (
              <Text style={[styles.codeMore, { color: theme.textMuted }]}>
                +{(item.photoUrls?.length ?? 0) + (item.videoUrls?.length ?? 0) - 4}
              </Text>
            ) : null}
          </View>
        ) : null}

        {item.vehicleName ? (
          <View style={styles.metaRow}>
            <Feather name="truck" size={12} color={theme.textMuted} />
            <Text style={[styles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.vehicleName}
            </Text>
          </View>
        ) : null}

        {item.obdCodes && item.obdCodes.length > 0 ? (
          <View style={styles.codesRow}>
            {item.obdCodes.slice(0, 4).map((code) => (
              <View key={code} style={[styles.codeChip, { backgroundColor: theme.backgroundTertiary }]}>
                <Text style={[styles.codeChipText, { color: theme.text }]}>{code}</Text>
              </View>
            ))}
            {item.obdCodes.length > 4 ? (
              <Text style={[styles.codeMore, { color: theme.textMuted }]}>
                +{item.obdCodes.length - 4}
              </Text>
            ) : null}
          </View>
        ) : null}

        {item.hasSolution && item.rootCause ? (
          <View style={[styles.rootCauseBox, { backgroundColor: theme.backgroundTertiary, borderColor: theme.success }]}>
            <Feather name="check-circle" size={12} color={theme.success} />
            <Text style={[styles.rootCauseText, { color: theme.text }]} numberOfLines={2}>
              {item.rootCause}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardFooterRow}>
          <View style={styles.footerStats}>
            {garage ? (
              <View style={styles.footerStat}>
                <Feather name="grid" size={12} color={theme.textMuted} />
                <Text style={[styles.footerStatText, { color: theme.textMuted }]}>
                  {garage.name}
                </Text>
              </View>
            ) : null}
            <View style={styles.footerStat}>
              <Feather name="message-circle" size={12} color={theme.textMuted} />
              <Text style={[styles.footerStatText, { color: theme.textMuted }]}>
                {item.replyCount ?? 0}
              </Text>
            </View>
          </View>
          <Text style={[styles.byText, { color: theme.textMuted }]} numberOfLines={1}>
            by {item.userName}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  testID,
  highlight,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  testID?: string;
  highlight?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        {
          backgroundColor: highlight ? theme.primary : theme.backgroundSecondary,
          borderColor: highlight ? theme.primary : theme.cardBorder,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Feather name={icon} size={18} color={highlight ? "#fff" : theme.text} />
      <Text
        style={[
          styles.quickActionLabel,
          { color: highlight ? "#fff" : theme.text },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function CasesScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { isDesktop } = useResponsive();
  const rootNav = useNavigation<RootNavProp>();
  const casesNav = useNavigation<CasesNavProp>();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [systemFilter, setSystemFilter] = useState<string | null>(null);
  const [garageFilter, setGarageFilter] = useState<string | null>(null);

  const { data: garages = [] } = useQuery<GarageInfo[]>({
    queryKey: ["/api/garages"],
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("filter", statusFilter);
    if (systemFilter) params.set("system", systemFilter);
    if (garageFilter) params.set("garageId", garageFilter);
    if (search.trim()) params.set("search", search.trim());
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [statusFilter, systemFilter, garageFilter, search]);

  const {
    data: cases = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<CaseRow[]>({
    queryKey: [`/api/threads${queryParams}`],
  });

  const garageById = useMemo(() => {
    const map = new Map<string, GarageInfo>();
    for (const g of garages) map.set(g.id, g);
    return map;
  }, [garages]);

  const handleScanCode = () => {
    toast.show("Scan Code is coming soon — paste codes manually for now", "info");
  };

  const renderCaseItem = ({ item }: { item: CaseRow }) => (
    <CaseCard
      item={item}
      garage={garageById.get(item.garageId)}
      onPress={() => rootNav.navigate("ThreadDetail", { threadId: item.id })}
    />
  );

  const headerComponent = (
    <View style={styles.headerWrap}>
      <View style={[styles.searchRow, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
        <Feather name="search" size={16} color={theme.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search cases, OBD codes, vehicles"
          placeholderTextColor={theme.textMuted}
          style={[styles.searchInput, { color: theme.text }]}
          testID="input-search-cases"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x-circle" size={16} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.quickActionsRow}>
        <QuickAction
          icon="plus-circle"
          label="New Case"
          highlight
          testID="button-new-case"
          onPress={() => rootNav.navigate("NewCase")}
        />
        <QuickAction
          icon="activity"
          label="TorqueAssist"
          testID="button-torque-assist"
          onPress={() => rootNav.navigate("Main")}
        />
        <QuickAction
          icon="camera"
          label="Scan Code"
          testID="button-scan-code"
          onPress={handleScanCode}
        />
        <QuickAction
          icon="tag"
          label="Sell Part"
          testID="button-sell-part"
          onPress={() => rootNav.navigate("AddListing")}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipScrollContent}
      >
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key;
          return (
            <Pressable
              key={f.key}
              testID={`chip-status-${f.key}`}
              onPress={() => setStatusFilter(f.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.primary : theme.backgroundSecondary,
                  borderColor: active ? theme.primary : theme.cardBorder,
                },
              ]}
            >
              <Feather name={f.icon} size={12} color={active ? "#fff" : theme.text} />
              <Text style={[styles.chipText, { color: active ? "#fff" : theme.text }]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipScrollContent}
      >
        <Pressable
          onPress={() => setSystemFilter(null)}
          style={[
            styles.chip,
            {
              backgroundColor: systemFilter === null ? theme.text : theme.backgroundSecondary,
              borderColor: systemFilter === null ? theme.text : theme.cardBorder,
            },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              { color: systemFilter === null ? theme.backgroundRoot : theme.text },
            ]}
          >
            All systems
          </Text>
        </Pressable>
        {SYSTEM_FILTERS.map((f) => {
          const active = systemFilter === f.key;
          return (
            <Pressable
              key={f.key}
              testID={`chip-system-${f.key}`}
              onPress={() => setSystemFilter(active ? null : f.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.text : theme.backgroundSecondary,
                  borderColor: active ? theme.text : theme.cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? theme.backgroundRoot : theme.text },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipScrollContent}
      >
        <Pressable
          onPress={() => setGarageFilter(null)}
          style={[
            styles.chip,
            {
              backgroundColor: garageFilter === null ? theme.backgroundTertiary : theme.backgroundSecondary,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Feather name="grid" size={12} color={theme.text} />
          <Text style={[styles.chipText, { color: theme.text }]}>All bays</Text>
        </Pressable>
        {garages.map((g) => {
          const active = garageFilter === g.id;
          const tint = g.brandColor || theme.primary;
          return (
            <Pressable
              key={g.id}
              testID={`chip-bay-${g.id}`}
              onPress={() => setGarageFilter(active ? null : g.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? tint : theme.backgroundSecondary,
                  borderColor: active ? tint : theme.cardBorder,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? "#fff" : theme.text }]}>
                {g.name}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => casesNav.navigate("Bays")}
          style={[styles.chip, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}
        >
          <Feather name="external-link" size={12} color={theme.text} />
          <Text style={[styles.chipText, { color: theme.text }]}>Browse all bays</Text>
        </Pressable>
      </ScrollView>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={{ paddingTop: isDesktop ? Spacing.xl : headerHeight + Spacing.lg }}>
          {headerComponent}
        </View>
        <Skeleton.List count={4} style={{ paddingHorizontal: Spacing.lg }} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={{ paddingTop: isDesktop ? Spacing.xl : headerHeight + Spacing.lg }}>
          {headerComponent}
        </View>
        <EmptyState
          icon="alert-circle"
          title="Couldn't Load Cases"
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
        data={cases}
        keyExtractor={(item) => item.id}
        renderItem={renderCaseItem}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: isDesktop ? Spacing.xl : headerHeight + Spacing.lg,
            paddingBottom: isDesktop ? Spacing.xl : insets.bottom + 80 + Spacing.lg,
            maxWidth: isDesktop ? 900 : undefined,
            alignSelf: isDesktop ? "center" : undefined,
            width: isDesktop ? "100%" : undefined,
          },
        ]}
        ListHeaderComponent={headerComponent}
        ListEmptyComponent={
          <EmptyState
            icon="clipboard"
            title="No cases yet"
            description={
              statusFilter !== "all" || systemFilter !== null || garageFilter !== null || search
                ? "Try clearing your filters."
                : "Start a repair case or ask Torque Assist."
            }
            actionLabel="New Case"
            onAction={() => rootNav.navigate("NewCase")}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.lg },
  headerWrap: { gap: Spacing.md, marginBottom: Spacing.md },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  searchInput: { flex: 1, ...Typography.body, paddingVertical: 0 },
  quickActionsRow: { flexDirection: "row", gap: Spacing.sm },
  quickAction: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 64,
  },
  quickActionLabel: { ...Typography.caption, fontWeight: "600" },
  chipScroll: {},
  chipScrollContent: { gap: Spacing.sm, paddingRight: Spacing.lg },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: { ...Typography.caption, fontWeight: "600" },
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.md,
    flexDirection: "row",
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: Spacing.lg, gap: Spacing.sm },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardHeaderLeft: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 },
  timeText: { ...Typography.caption, fontSize: 11 },
  cardTitle: { ...Typography.h4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { ...Typography.caption, flex: 1 },
  codesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  codeChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  codeChipText: { ...Typography.caption, fontFamily: "monospace", fontWeight: "600", fontSize: 11 },
  codeMore: { ...Typography.caption, fontSize: 11, alignSelf: "center" },
  thumbStrip: { flexDirection: "row", gap: 6, marginTop: 4, alignItems: "center" },
  thumb: { width: 56, height: 56, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  videoBadge: { alignItems: "center", justifyContent: "center" },
  rootCauseBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  rootCauseText: { ...Typography.caption, flex: 1, fontWeight: "500" },
  cardFooterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerStats: { flexDirection: "row", gap: Spacing.md },
  footerStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerStatText: { ...Typography.caption, fontSize: 11 },
  byText: { ...Typography.caption, fontSize: 11, maxWidth: 140 },
});
