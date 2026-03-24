import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
  Pressable,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { Image } from "expo-image";
import { NoteCard } from "@/components/NoteCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { FAB } from "@/components/FAB";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { type VehicleNote, type NoteType } from "@/constants/vehicles";
import { emptyStates } from "@/constants/brand";
import { apiRequest } from "@/lib/query-client";
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
  beforeState: string | null;
  afterState: string | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiVehicle {
  id: string;
  userId: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  nickname: string | null;
  imageUrl: string | null;
  isPublic: boolean;
  notesCount: number;
  totalCost: string;
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
    beforeState: apiNote.beforeState,
    afterState: apiNote.afterState,
    createdAt: new Date(apiNote.createdAt),
    isPrivate: apiNote.isPrivate,
  };
}

type RoutePropType = RouteProp<NotesStackParamList, "VehicleDetail">;
type NavigationProp = NativeStackNavigationProp<
  NotesStackParamList & RootStackParamList
>;

type TabKey = "overview" | "all" | "maintenance" | "mod" | "issue";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "info" },
  { key: "all", label: "All", icon: "list" },
  { key: "maintenance", label: "Maintenance", icon: "settings" },
  { key: "mod", label: "Mods", icon: "zap" },
  { key: "issue", label: "Issues", icon: "alert-triangle" },
];

function formatCost(val: string): string {
  const num = parseFloat(val);
  if (isNaN(num) || num === 0) return "$0";
  return `$${num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export default function VehicleDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { vehicleId, vehicleName } = route.params;
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const {
    data: apiNotes = [],
    isLoading: notesLoading,
    refetch: refetchNotes,
    isRefetching: notesRefetching,
  } = useQuery<ApiNote[]>({
    queryKey: [`/api/vehicles/${vehicleId}/notes`],
  });

  const { data: vehicle, refetch: refetchVehicle } = useQuery<ApiVehicle>({
    queryKey: [`/api/vehicles/${vehicleId}`],
  });

  const togglePublicMutation = useMutation({
    mutationFn: async (isPublic: boolean) => {
      return apiRequest("PATCH", `/api/vehicles/${vehicleId}`, { isPublic });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to update", "error");
    },
  });

  const notes = useMemo(() => apiNotes.map(transformToNote), [apiNotes]);

  const filteredNotes = useMemo(() => {
    if (activeTab === "overview" || activeTab === "all") return notes;
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

  const refetch = () => {
    refetchNotes();
    refetchVehicle();
  };

  const isRefetching = notesRefetching;

  const renderTabs = () => (
    <View style={[styles.tabBar, { borderColor: theme.border }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const count =
          tab.key === "all"
            ? notes.length
            : tab.key === "maintenance"
              ? stats.maintenanceCount
              : tab.key === "mod"
                ? stats.modCount
                : tab.key === "issue"
                  ? stats.issueCount
                  : null;
        return (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[
              styles.tab,
              isActive
                ? {
                    backgroundColor: theme.primary + "20",
                    borderColor: theme.primary,
                  }
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
              {count !== null ? ` (${count})` : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderOverviewTab = () => {
    const vehicleInfo = [vehicle?.year, vehicle?.make, vehicle?.model]
      .filter(Boolean)
      .join(" ");

    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl + 80,
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
      >
        {renderTabs()}

        {vehicle?.imageUrl ? (
          <Image
            source={{ uri: vehicle.imageUrl }}
            style={[styles.vehicleImage, { width: "100%" }]}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              styles.vehicleImage,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Feather name="truck" size={48} color={theme.textSecondary} />
          </View>
        )}

        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <ThemedText type="h3">{vehicleName}</ThemedText>
          {vehicleInfo ? (
            <Text style={[styles.infoSubtext, { color: theme.textSecondary }]}>
              {vehicleInfo}
            </Text>
          ) : null}
          {vehicle?.vin ? (
            <View style={styles.vinRow}>
              <Text style={[styles.vinLabel, { color: theme.textMuted }]}>
                VIN
              </Text>
              <Text style={[styles.vinValue, { color: theme.textSecondary }]}>
                {vehicle.vin}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.cardBorder,
              },
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
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.cardBorder,
              },
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
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <Feather name="settings" size={14} color="#3B82F6" />
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
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <Feather name="zap" size={14} color="#8B5CF6" />
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
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <Feather name="alert-triangle" size={14} color="#EF4444" />
            <Text style={[styles.miniStatText, { color: theme.text }]}>
              {stats.issueCount}
            </Text>
            <Text style={[styles.miniStatLabel, { color: theme.textMuted }]}>
              Issues
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.privacyCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.privacyInfo}>
            <Feather
              name={vehicle?.isPublic ? "globe" : "lock"}
              size={18}
              color={theme.textSecondary}
            />
            <View style={styles.privacyText}>
              <Text style={[styles.privacyTitle, { color: theme.text }]}>
                {vehicle?.isPublic ? "Public Build" : "Private Build"}
              </Text>
              <Text
                style={[styles.privacyDesc, { color: theme.textSecondary }]}
              >
                {vehicle?.isPublic
                  ? "Others can view this build"
                  : "Only you can see this build"}
              </Text>
            </View>
          </View>
          <Switch
            value={vehicle?.isPublic ?? false}
            onValueChange={(val) => togglePublicMutation.mutate(val)}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor="#FFFFFF"
            disabled={togglePublicMutation.isPending}
          />
        </View>

        {notes.length > 0 ? (
          <View style={styles.recentSection}>
            <ThemedText type="h4" style={styles.recentTitle}>
              Recent Entries
            </ThemedText>
            {notes.slice(0, 3).map((note) => (
              <NoteCard key={note.id} note={note} onPress={() => {}} />
            ))}
            {notes.length > 3 ? (
              <Pressable
                onPress={() => setActiveTab("all")}
                style={styles.viewAllRow}
              >
                <Text style={[styles.viewAllText, { color: theme.primary }]}>
                  View all {notes.length} entries
                </Text>
                <Feather name="arrow-right" size={16} color={theme.primary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    );
  };

  const handleDiagnose = () => {
    (navigation as any).navigate("MoreTab", { screen: "TorqueAssist" });
  };

  const handleAskForHelp = () => {
    (navigation as any).navigate("AskForHelp");
  };

  const renderNotesTab = () => {
    const renderNote = ({ item }: { item: VehicleNote }) => (
      <NoteCard
        note={item}
        onPress={() => {}}
        onDiagnose={item.type === "issue" ? handleDiagnose : undefined}
        onAskForHelp={item.type === "issue" ? handleAskForHelp : undefined}
      />
    );

    const tabConfig = TABS.find((t) => t.key === activeTab);
    const tabLabel = activeTab === "all" ? "Entries" : tabConfig?.label || "Entries";

    const renderEmpty = () => {
      if (notesLoading) {
        return <Skeleton.List count={3} />;
      }
      return (
        <EmptyState
          icon={(tabConfig?.icon as any) || "file-text"}
          title={activeTab === "all" ? emptyStates.notes.title : `No ${tabLabel}`}
          description={activeTab === "all" ? emptyStates.notes.message : `No ${tabLabel.toLowerCase()} entries yet.`}
          actionLabel={emptyStates.notes.action}
          onAction={handleAddNote}
        />
      );
    };

    return (
      <FlatList
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl + 80,
          },
          filteredNotes.length === 0 && !notesLoading
            ? styles.emptyContainer
            : null,
        ]}
        data={filteredNotes}
        renderItem={renderNote}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {renderTabs()}
            <Text
              style={[styles.sectionLabel, { color: theme.textSecondary }]}
            >
              {tabLabel} ({filteredNotes.length})
            </Text>
          </View>
        }
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
    );
  };

  return (
    <>
      {activeTab === "overview" ? renderOverviewTab() : renderNotesTab()}
      <FAB icon="plus" onPress={handleAddNote} bottom={insets.bottom + 20} />
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
  listHeader: {
    marginBottom: Spacing.md,
  },
  vehicleImage: {
    height: 160,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  infoSubtext: {
    ...Typography.small,
    marginTop: 4,
  },
  vinRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  vinLabel: {
    ...Typography.caption,
    marginRight: Spacing.sm,
  },
  vinValue: {
    ...Typography.caption,
    fontFamily: "Inter_500Medium",
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
  privacyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  privacyInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
  },
  privacyText: {
    flex: 1,
  },
  privacyTitle: {
    ...Typography.body,
    fontFamily: "Inter_500Medium",
  },
  privacyDesc: {
    ...Typography.caption,
    marginTop: 2,
  },
  recentSection: {
    marginBottom: Spacing.lg,
  },
  recentTitle: {
    marginBottom: Spacing.md,
  },
  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  viewAllText: {
    ...Typography.body,
    fontFamily: "Inter_500Medium",
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
