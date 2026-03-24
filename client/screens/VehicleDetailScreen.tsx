import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { NoteCard } from "@/components/NoteCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { FAB } from "@/components/FAB";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { type VehicleNote, type NoteType } from "@/constants/vehicles";
import { emptyStates } from "@/constants/brand";
import type { NotesStackParamList } from "@/navigation/NotesStackNavigator";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

interface ApiNote {
  id: string;
  vehicleId: string;
  title: string;
  content: string;
  type: string | null;
  cost: string | null;
  mileage: number | null;
  partsUsed: string[] | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

function transformToNote(apiNote: ApiNote): VehicleNote {
  return {
    id: apiNote.id,
    vehicleId: apiNote.vehicleId,
    title: apiNote.title,
    content: apiNote.content,
    type: (apiNote.type as NoteType) || "general",
    cost: apiNote.cost,
    mileage: apiNote.mileage,
    partsUsed: apiNote.partsUsed,
    createdAt: new Date(apiNote.createdAt),
    isPrivate: apiNote.isPrivate,
  };
}

type RoutePropType = RouteProp<NotesStackParamList, "VehicleDetail">;
type NavigationProp = NativeStackNavigationProp<
  NotesStackParamList & RootStackParamList
>;

type TabKey = "all" | "maintenance" | "mod" | "issue";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "list" },
  { key: "maintenance", label: "Maintenance", icon: "settings" },
  { key: "mod", label: "Mods", icon: "zap" },
  { key: "issue", label: "Issues", icon: "alert-triangle" },
];

function formatCost(val: string): string {
  const num = parseFloat(val);
  if (isNaN(num) || num === 0) return "$0";
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function VehicleDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  const { vehicleId, vehicleName } = route.params;
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const {
    data: apiNotes = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<ApiNote[]>({
    queryKey: [`/api/vehicles/${vehicleId}/notes`],
  });

  const notes = useMemo(() => apiNotes.map(transformToNote), [apiNotes]);

  const filteredNotes = useMemo(() => {
    if (activeTab === "all") return notes;
    return notes.filter((n) => n.type === activeTab);
  }, [notes, activeTab]);

  const stats = useMemo(() => {
    let totalCost = 0;
    let maintenanceCount = 0;
    let modCount = 0;
    let issueCount = 0;
    for (const n of notes) {
      if (n.cost) {
        const val = parseFloat(n.cost);
        if (!isNaN(val)) totalCost += val;
      }
      if (n.type === "maintenance") maintenanceCount++;
      else if (n.type === "mod") modCount++;
      else if (n.type === "issue") issueCount++;
    }
    return { totalCost, maintenanceCount, modCount, issueCount };
  }, [notes]);

  const handleAddNote = () => {
    navigation.navigate("AddNote", { vehicleId });
  };

  const renderOverview = () => (
    <View style={styles.overviewSection}>
      <View
        style={[
          styles.vehicleImage,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <Feather name="truck" size={48} color={theme.textSecondary} />
      </View>

      <View style={styles.statsRow}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.statValue, { color: theme.primary }]}>
            {formatCost(String(stats.totalCost))}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Total Invested
          </Text>
        </View>
        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.statValue, { color: theme.text }]}>
            {notes.length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Journal Entries
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View
          style={[
            styles.miniStat,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.cardBorder },
          ]}
        >
          <Feather name="settings" size={14} color={theme.textSecondary} />
          <Text style={[styles.miniStatText, { color: theme.text }]}>
            {stats.maintenanceCount}
          </Text>
          <Text style={[styles.miniStatLabel, { color: theme.textMuted }]}>
            Maint.
          </Text>
        </View>
        <View
          style={[
            styles.miniStat,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.cardBorder },
          ]}
        >
          <Feather name="zap" size={14} color={theme.textSecondary} />
          <Text style={[styles.miniStatText, { color: theme.text }]}>
            {stats.modCount}
          </Text>
          <Text style={[styles.miniStatLabel, { color: theme.textMuted }]}>
            Mods
          </Text>
        </View>
        <View
          style={[
            styles.miniStat,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.cardBorder },
          ]}
        >
          <Feather name="alert-triangle" size={14} color={theme.textSecondary} />
          <Text style={[styles.miniStatText, { color: theme.text }]}>
            {stats.issueCount}
          </Text>
          <Text style={[styles.miniStatLabel, { color: theme.textMuted }]}>
            Issues
          </Text>
        </View>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={[styles.tabBar, { borderColor: theme.border }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[
              styles.tab,
              isActive
                ? { backgroundColor: theme.primary + "20", borderColor: theme.primary }
                : { borderColor: "transparent" },
            ]}
            testID={`tab-${tab.key}`}
          >
            <Feather
              name={tab.icon as any}
              size={14}
              color={isActive ? theme.primary : theme.textMuted}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: isActive ? theme.primary : theme.textMuted },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      {renderOverview()}
      {renderTabs()}
      {filteredNotes.length > 0 ? (
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          {activeTab === "all"
            ? `All Entries (${filteredNotes.length})`
            : `${TABS.find((t) => t.key === activeTab)?.label} (${filteredNotes.length})`}
        </Text>
      ) : null}
    </View>
  );

  const renderNote = ({ item }: { item: VehicleNote }) => (
    <NoteCard note={item} onPress={() => {}} />
  );

  const renderEmpty = () => {
    if (isLoading) {
      return <Skeleton.List count={3} />;
    }
    const emptyMessage =
      activeTab === "all"
        ? emptyStates.notes.message
        : `No ${TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} entries yet.`;
    return (
      <EmptyState
        icon={activeTab === "all" ? "file-text" : (TABS.find((t) => t.key === activeTab)?.icon as any) || "file-text"}
        title={activeTab === "all" ? emptyStates.notes.title : `No ${TABS.find((t) => t.key === activeTab)?.label}`}
        description={emptyMessage}
        actionLabel={emptyStates.notes.action}
        onAction={handleAddNote}
      />
    );
  };

  return (
    <>
      <FlatList
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl + 80,
          },
          filteredNotes.length === 0 && !isLoading ? styles.emptyContainer : null,
        ]}
        data={filteredNotes}
        renderItem={renderNote}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      />
      {notes.length > 0 ? (
        <FAB icon="plus" onPress={handleAddNote} bottom={insets.bottom + 20} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  emptyContainer: {
    flex: 1,
  },
  header: {
    marginBottom: Spacing.md,
  },
  vehicleImage: {
    height: 160,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  overviewSection: {
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  statValue: {
    ...Typography.h2,
    marginBottom: 2,
  },
  statLabel: {
    ...Typography.caption,
  },
  miniStat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  miniStatText: {
    ...Typography.body,
    fontFamily: "Inter_500Medium",
  },
  miniStatLabel: {
    ...Typography.caption,
  },
  tabBar: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    borderBottomWidth: 1,
    paddingBottom: Spacing.md,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  tabLabel: {
    ...Typography.caption,
    fontFamily: "Inter_500Medium",
  },
  sectionLabel: {
    ...Typography.caption,
    marginBottom: Spacing.sm,
  },
});
