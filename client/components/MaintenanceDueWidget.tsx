import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { NotesStackParamList } from "@/navigation/NotesStackNavigator";

type MaintenanceNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<NotesStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;
import { Feather } from "@expo/vector-icons";

import { Card } from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import { LockedFeature } from "@/components/LockedFeature";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface MaintenanceItem {
  noteId: string;
  vehicleId: string;
  vehicleName: string;
  title: string;
  type: string;
  nextDueDate: string | null;
  nextDueMileage: number | null;
  currentMileage: number | null;
  daysRemaining: number | null;
  milesRemaining: number | null;
  isOverdue: boolean;
}

interface MaintenanceResponse {
  items: MaintenanceItem[];
  hasFeature: boolean;
  totalCount: number;
}

interface WidgetProps {
  vehicleId?: string;
  title?: string;
}

export function MaintenanceDueWidget({ vehicleId, title }: WidgetProps = {}) {
  const { theme } = useTheme();
  const navigation = useNavigation<MaintenanceNavProp>();
  const { data: rawData, isLoading, isError } = useQuery<MaintenanceResponse>({
    queryKey: ["/api/vehicles/me/maintenance-due"],
  });

  const data: MaintenanceResponse | undefined = rawData
    ? vehicleId
      ? (() => {
          const items = rawData.items.filter((i) => i.vehicleId === vehicleId);
          return { ...rawData, items, totalCount: items.length };
        })()
      : rawData
    : undefined;

  if (isLoading || isError || !data) return null;
  if (data.totalCount === 0 && data.hasFeature) return null;

  const navigateToSubscription = () => {
    navigation.navigate("Main", { screen: "MoreTab", params: { screen: "Subscription" } });
  };

  if (!data.hasFeature && data.totalCount === 0) {
    return (
      <View style={{ marginBottom: Spacing.md }}>
        <LockedFeature
          feature="maintenance_tracking"
          title="Maintenance Reminders"
          description="Track service intervals and get a heads up when oil changes, brake jobs, or other maintenance is due."
          onUpgrade={navigateToSubscription}
          compact
        />
      </View>
    );
  }

  return (
    <Card style={styles.card} testID="maintenance-due-widget">
      <View style={styles.headerRow}>
        <Feather name="clock" size={16} color={theme.primary} />
        <ThemedText type="h4" style={styles.headerTitle}>{title ?? "Maintenance Due"}</ThemedText>
        <View style={[styles.countPill, { backgroundColor: theme.primary + "20" }]}>
          <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "700" }}>
            {data.totalCount}
          </ThemedText>
        </View>
      </View>

      {data.items.map((item) => {
        const due: string[] = [];
        if (item.daysRemaining !== null) {
          due.push(item.daysRemaining < 0 ? `${Math.abs(item.daysRemaining)}d overdue` : `${item.daysRemaining}d`);
        }
        if (item.milesRemaining !== null) {
          due.push(item.milesRemaining < 0 ? `${Math.abs(item.milesRemaining).toLocaleString()} mi overdue` : `${item.milesRemaining.toLocaleString()} mi`);
        }
        const tone = item.isOverdue ? theme.error : theme.accent;
        return (
          <Pressable
            key={item.noteId}
            onPress={() =>
              navigation.navigate("VehicleDetail", { vehicleId: item.vehicleId, vehicleName: item.vehicleName })
            }
            style={[styles.row, { borderColor: theme.cardBorder }]}
            testID={`maintenance-item-${item.noteId}`}
          >
            <View style={{ flex: 1 }}>
              <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
                {item.title}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textMuted }} numberOfLines={1}>
                {item.vehicleName}
              </ThemedText>
            </View>
            <View style={[styles.duePill, { backgroundColor: tone + "20" }]}>
              <ThemedText type="caption" style={{ color: tone, fontWeight: "700" }}>
                {due.join(" · ") || "Due"}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontWeight: "700",
  },
  countPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  duePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
});

export default MaintenanceDueWidget;
