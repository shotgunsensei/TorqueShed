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
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import { emptyStates } from "@/constants/brand";
import type { NotesStackParamList } from "@/navigation/NotesStackNavigator";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<NotesStackParamList & RootStackParamList>;

interface VehicleItem {
  id: string;
  nickname: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  vin?: string | null;
  notesCount: number;
}

function VehicleCard({ item, onPress }: { item: VehicleItem; onPress: () => void }) {
  const { theme } = useTheme();

  const vehicleInfo = [item.year, item.make, item.model].filter(Boolean).join(" ");

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
    >
      <View style={styles.cardHeader}>
        <View style={[styles.vehicleIcon, { backgroundColor: theme.primary + "20" }]}>
          <Feather name="truck" size={24} color={theme.primary} />
        </View>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.nickname, { color: theme.text }]}>
            {item.nickname || "Unnamed Vehicle"}
          </Text>
          {vehicleInfo ? (
            <Text style={[styles.vehicleInfo, { color: theme.textSecondary }]}>
              {vehicleInfo}
            </Text>
          ) : null}
        </View>
        <Feather name="chevron-right" size={20} color={theme.textMuted} />
      </View>

      {item.vin ? (
        <View style={[styles.vinRow, { borderTopColor: theme.border }]}>
          <Text style={[styles.vinLabel, { color: theme.textMuted }]}>VIN</Text>
          <Text style={[styles.vinValue, { color: theme.textSecondary }]}>
            {item.vin}
          </Text>
        </View>
      ) : null}

      <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
        <View style={styles.notesCount}>
          <Feather name="file-text" size={14} color={theme.textMuted} />
          <Text style={[styles.notesCountText, { color: theme.textMuted }]}>
            {item.notesCount} notes
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyVehicles({ onAdd }: { onAdd: () => void }) {
  const { theme } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.primary + "15" }]}>
        <Feather name="truck" size={48} color={theme.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        {emptyStates.vehicles.title}
      </Text>
      <Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>
        {emptyStates.vehicles.message}
      </Text>
      <Pressable
        onPress={onAdd}
        style={[styles.emptyButton, { backgroundColor: theme.primary }]}
      >
        <Feather name="plus" size={20} color="#FFFFFF" />
        <Text style={styles.emptyButtonText}>{emptyStates.vehicles.action}</Text>
      </Pressable>
    </View>
  );
}

export default function NotesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const tabBarHeight = useSafeTabBarHeight();

  const { data: vehicles = [], isLoading } = useQuery<VehicleItem[]>({
    queryKey: ["/api/vehicles"],
  });

  const handleVehiclePress = (vehicle: VehicleItem) => {
    const vehicleName = vehicle.nickname || [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle";
    navigation.navigate("VehicleDetail", {
      vehicleId: vehicle.id,
      vehicleName,
    });
  };

  const handleAddVehicle = () => {
    navigation.navigate("AddVehicle");
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
      {vehicles.length > 0 ? (
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <VehicleCard item={item} onPress={() => handleVehiclePress(item)} />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + Spacing.lg + 56 + Spacing.md },
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                Your Vehicles ({vehicles.length})
              </Text>
            </View>
          }
        />
      ) : (
        <EmptyVehicles onAdd={handleAddVehicle} />
      )}
      {vehicles.length > 0 ? (
        <Pressable
          onPress={handleAddVehicle}
          testID="add-vehicle-fab"
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: theme.primary,
              bottom: tabBarHeight + Spacing.lg,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
        >
          <Feather name="plus" size={28} color="#FFFFFF" />
        </Pressable>
      ) : null}
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
  headerSection: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    ...Typography.caption,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleRow: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  nickname: {
    ...Typography.h4,
    marginBottom: 2,
  },
  vehicleInfo: {
    ...Typography.small,
  },
  vinRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  vinLabel: {
    ...Typography.caption,
    marginRight: Spacing.sm,
  },
  vinValue: {
    ...Typography.caption,
    fontFamily: "Inter_500Medium",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  notesCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  notesCountText: {
    ...Typography.caption,
  },
  lastNote: {
    flex: 1,
    ...Typography.caption,
  },
  separator: {
    height: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h2,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptyMessage: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    ...Typography.h4,
  },
});
