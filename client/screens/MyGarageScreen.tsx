import React, { useState, useCallback } from "react";
import { StyleSheet, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { VehicleCard } from "@/components/VehicleCard";
import { EmptyState } from "@/components/EmptyState";
import { FAB } from "@/components/FAB";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { SAMPLE_VEHICLES, type Vehicle } from "@/constants/vehicles";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MyGarageScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>(SAMPLE_VEHICLES);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleVehiclePress = (vehicle: Vehicle) => {
    navigation.navigate("VehicleDetail", { vehicle });
  };

  const handleAddVehicle = () => {
    navigation.navigate("AddVehicle");
  };

  const renderVehicle = ({ item }: { item: Vehicle }) => (
    <VehicleCard vehicle={item} onPress={() => handleVehiclePress(item)} />
  );

  const renderEmpty = () => (
    <EmptyState
      image={require("../../assets/images/empty-garage.png")}
      title="Your Garage is Empty"
      description="Add your first vehicle to start tracking maintenance and notes"
      actionLabel="Add Vehicle"
      onAction={handleAddVehicle}
    />
  );

  return (
    <>
      <FlatList
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl + 80,
          },
          vehicles.length === 0 ? styles.emptyContainer : null,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={vehicles}
        renderItem={renderVehicle}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
      {vehicles.length > 0 ? (
        <FAB icon="plus" onPress={handleAddVehicle} bottom={tabBarHeight + 20} />
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
});
