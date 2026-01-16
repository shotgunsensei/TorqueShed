import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import ProfileScreen from "@/screens/ProfileScreen";
import AddVehicleScreen from "@/screens/AddVehicleScreen";
import AddNoteScreen from "@/screens/AddNoteScreen";
import SubmitProductScreen from "@/screens/SubmitProductScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type RootStackParamList = {
  Main: undefined;
  Profile: undefined;
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
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: "Profile",
        }}
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
