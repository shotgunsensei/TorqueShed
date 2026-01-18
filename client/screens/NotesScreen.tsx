import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import { emptyStates, microcopy } from "@/constants/brand";
import type { NotesStackParamList } from "@/navigation/NotesStackNavigator";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<NotesStackParamList & RootStackParamList>;

interface VehicleItem {
  id: string;
  nickname: string;
  year: number;
  make: string;
  model: string;
  vin?: string;
  notesCount: number;
  lastNote?: string;
}

const STUB_VEHICLES: VehicleItem[] = [
  { id: "1", nickname: "Big Red", year: 2019, make: "Ford", model: "F-150 Lariat", vin: "1FTEW1EP7KFC12345", notesCount: 12, lastNote: "Oil change - 5W-30 Motorcraft" },
  { id: "2", nickname: "Project Car", year: 1993, make: "Ford", model: "Mustang GT", notesCount: 28, lastNote: "Installed Coyote swap harness" },
];

function VehicleCard({ item, onPress }: { item: VehicleItem; onPress: () => void }) {
  const { theme } = useTheme();

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
            {item.nickname}
          </Text>
          <Text style={[styles.vehicleInfo, { color: theme.textSecondary }]}>
            {item.year} {item.make} {item.model}
          </Text>
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
        {item.lastNote ? (
          <Text style={[styles.lastNote, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.lastNote}
          </Text>
        ) : null}
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

  const handleVehiclePress = (vehicle: VehicleItem) => {
    navigation.navigate("VehicleDetail", {
      vehicleId: vehicle.id,
      vehicleName: vehicle.nickname || `${vehicle.make} ${vehicle.model}`,
    });
  };

  const handleAddVehicle = () => {
    navigation.navigate("AddVehicle");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {STUB_VEHICLES.length > 0 ? (
        <FlatList
          data={STUB_VEHICLES}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <VehicleCard item={item} onPress={() => handleVehiclePress(item)} />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + Spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <Pressable
              onPress={handleAddVehicle}
              style={[styles.addButton, { backgroundColor: theme.primary }]}
            >
              <Feather name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>{microcopy.addVehicle}</Text>
            </Pressable>
          }
        />
      ) : (
        <EmptyVehicles onAdd={handleAddVehicle} />
      )}
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
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  addButtonText: {
    color: "#FFFFFF",
    ...Typography.h4,
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
