import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import GarageDetailScreen from "@/screens/GarageDetailScreen";
import VehicleDetailScreen from "@/screens/VehicleDetailScreen";
import AddVehicleScreen from "@/screens/AddVehicleScreen";
import AddNoteScreen from "@/screens/AddNoteScreen";
import SubmitProductScreen from "@/screens/SubmitProductScreen";
import { GarageBadge } from "@/components/GarageBadge";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import type { Garage } from "@/constants/garages";
import type { Vehicle } from "@/constants/vehicles";

export type RootStackParamList = {
  Main: undefined;
  GarageDetail: { garage: Garage };
  VehicleDetail: { vehicle: Vehicle };
  AddVehicle: undefined;
  AddNote: { vehicleId: string };
  SubmitProduct: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GarageDetail"
        component={GarageDetailScreen}
        options={({ route }) => ({
          headerTitle: route.params.garage.name,
          headerLeft: undefined,
        })}
      />
      <Stack.Screen
        name="VehicleDetail"
        component={VehicleDetailScreen}
        options={({ route }) => ({
          headerTitle:
            route.params.vehicle.nickname ||
            `${route.params.vehicle.make} ${route.params.vehicle.model}`,
        })}
      />
      <Stack.Screen
        name="AddVehicle"
        component={AddVehicleScreen}
        options={{
          presentation: "modal",
          headerTitle: "Add Vehicle",
        }}
      />
      <Stack.Screen
        name="AddNote"
        component={AddNoteScreen}
        options={{
          presentation: "modal",
          headerTitle: "Add Note",
        }}
      />
      <Stack.Screen
        name="SubmitProduct"
        component={SubmitProductScreen}
        options={{
          presentation: "modal",
          headerTitle: "Submit Product",
        }}
      />
    </Stack.Navigator>
  );
}
