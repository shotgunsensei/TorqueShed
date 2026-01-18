import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ResponsiveNavigator from "@/navigation/ResponsiveNavigator";
import ProfileScreen from "@/screens/ProfileScreen";
import AddVehicleScreen from "@/screens/AddVehicleScreen";
import AddNoteScreen from "@/screens/AddNoteScreen";
import SubmitProductScreen from "@/screens/SubmitProductScreen";
import AdminProductsScreen from "@/screens/AdminProductsScreen";
import LoginScreen from "@/screens/LoginScreen";
import SignupScreen from "@/screens/SignupScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Main: undefined;
  Profile: undefined;
  AddVehicle: undefined;
  AddNote: { vehicleId: string };
  SubmitProduct: undefined;
  AdminProducts: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Signup"
            component={SignupScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={ResponsiveNavigator}
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
          <Stack.Screen
            name="AdminProducts"
            component={AdminProductsScreen}
            options={{
              headerTitle: "Manage Products",
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
