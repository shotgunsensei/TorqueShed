import React, { useState, useCallback } from "react";
import { StyleSheet, FlatList, RefreshControl, ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { VehicleCard } from "@/components/VehicleCard";
import { EmptyState } from "@/components/EmptyState";
import { FAB } from "@/components/FAB";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import type { Vehicle } from "@/constants/vehicles";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MyGarageScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: vehicles = [], isLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] }).then(() => {
      setRefreshing(false);
    });
  }, [queryClient]);

  const handleVehiclePress = (vehicle: Vehicle) => {
    navigation.navigate("VehicleDetail", { vehicle });
  };

  const handleAddVehicle = () => {
    navigation.navigate("AddVehicle");
  };

  const renderVehicle = ({ item }: { item: Vehicle }) => (
    <VehicleCard vehicle={item} onPress={() => handleVehiclePress(item)} />
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }
    return (
      <EmptyState
        image={require("../../assets/images/empty-garage.png")}
        title="Your Garage is Empty"
        description="Add your first vehicle to start tracking maintenance and notes"
        actionLabel="Add Vehicle"
        onAction={handleAddVehicle}
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
});
