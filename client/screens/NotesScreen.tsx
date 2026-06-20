import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import { emptyStates } from "@/constants/brand";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/Card";
import { FAB } from "@/components/FAB";
import { Skeleton } from "@/components/Skeleton";
import { MaintenanceDueWidget } from "@/components/MaintenanceDueWidget";
import { LimitPill } from "@/components/LimitPill";
import { useEntitlements, FREE_VEHICLE_LIMIT } from "@/lib/entitlements";
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
  totalCost: string;
}

function VehicleCard({ item, onPress }: { item: VehicleItem; onPress: () => void }) {
  const { theme } = useTheme();

  const vehicleInfo = [item.year, item.make, item.model].filter(Boolean).join(" ");

  return (
    <Card
      elevation={2}
      onPress={onPress}
      style={styles.card}
      testID={`vehicle-card-${item.id}`}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.vehicleIcon, { backgroundColor: theme.primary + "20" }]}>
          <Feather name="tool" size={24} color={theme.primary} />
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
            {item.notesCount} {item.notesCount === 1 ? "entry" : "entries"}
          </Text>
        </View>
        {parseFloat(item.totalCost) > 0 ? (
          <View style={styles.notesCount}>
            <Feather name="dollar-sign" size={14} color={theme.primary} />
            <Text style={[styles.notesCountText, { color: theme.primary }]}>
              {parseFloat(item.totalCost).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} invested
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

export default function NotesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const tabBarHeight = useSafeTabBarHeight();
  const { isTablet, isDesktop } = useResponsive();
  const { hasFeature } = useEntitlements();
  const hasMultiVehicle = hasFeature("multi_vehicle");

  const { data: vehicles = [], isLoading, isError, refetch, isRefetching } = useQuery<VehicleItem[]>({
    queryKey: ["/api/vehicles"],
  });

  const atVehicleLimit = !hasMultiVehicle && vehicles.length >= FREE_VEHICLE_LIMIT;
  const columns = isDesktop ? 3 : isTablet ? 2 : 1;

  const handleVehiclePress = (vehicle: VehicleItem) => {
    const vehicleName = vehicle.nickname || [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle";
    navigation.navigate("VehicleDetail", {
      vehicleId: vehicle.id,
      vehicleName,
    });
  };

  const goToVehicleUpgrade = () => {
    navigation.navigate("Main", {
      screen: "MoreTab",
      params: {
        screen: "Subscription",
        params: {
          reason: `You're tracking ${vehicles.length} of ${FREE_VEHICLE_LIMIT} vehicle${FREE_VEHICLE_LIMIT === 1 ? "" : "s"} on your current plan. Upgrade to Garage Pro for unlimited vehicles, maintenance schedules, and build logs.`,
          feature: "multi_vehicle",
        },
      },
    });
  };

  const handleAddVehicle = () => {
    if (atVehicleLimit) {
      goToVehicleUpgrade();
      return;
    }
    navigation.navigate("AddVehicle");
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <Skeleton.List count={3} style={{ paddingTop: Spacing.xl }} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <EmptyState
          icon="alert-circle"
          title="Couldn't Load Vehicles"
          description="Something went wrong loading your garage. Tap below to try again."
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {vehicles.length > 0 ? (
        <FlatList
          key={`vehicles-${columns}`}
          data={vehicles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <VehicleCard item={item} onPress={() => handleVehiclePress(item)} />
          )}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom: tabBarHeight + Spacing.lg + 56 + Spacing.md,
              maxWidth: isDesktop ? 1180 : undefined,
              alignSelf: isDesktop ? "center" : undefined,
              width: isDesktop ? "100%" : undefined,
            },
          ]}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? styles.vehicleGridRow : undefined}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <MaintenanceDueWidget />
              <View style={styles.builderRow}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Your Builds ({vehicles.length})
                </Text>
                {!hasMultiVehicle ? (
                  <LimitPill
                    used={vehicles.length}
                    limit={FREE_VEHICLE_LIMIT}
                    noun="vehicle"
                    onPressAtLimit={goToVehicleUpgrade}
                    testID="limit-pill-vehicles"
                  />
                ) : null}
              </View>
            </View>
          }
        />
      ) : (
        <EmptyState
          icon="truck"
          title={emptyStates.vehicles.title}
          description={emptyStates.vehicles.message}
          actionLabel={emptyStates.vehicles.action}
          onAction={handleAddVehicle}
        />
      )}
      {vehicles.length > 0 ? (
        <FAB
          icon={atVehicleLimit ? "lock" : "plus"}
          onPress={handleAddVehicle}
          bottom={tabBarHeight + Spacing.lg}
        />
      ) : null}
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
  headerSection: {
    marginBottom: Spacing.md,
  },
  builderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.caption,
  },
  card: {
    flex: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
    padding: 0,
  },
  vehicleGridRow: {
    gap: Spacing.md,
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
  separator: {
    height: Spacing.md,
  },
});
