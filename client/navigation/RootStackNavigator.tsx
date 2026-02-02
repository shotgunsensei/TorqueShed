import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ResponsiveNavigator from "@/navigation/ResponsiveNavigator";
import ProfileScreen from "@/screens/ProfileScreen";
import AddVehicleScreen from "@/screens/AddVehicleScreen";
import AddNoteScreen from "@/screens/AddNoteScreen";
import AddListingScreen from "@/screens/AddListingScreen";
import ListingDetailScreen from "@/screens/ListingDetailScreen";
import AddThreadScreen from "@/screens/AddThreadScreen";
import ThreadDetailScreen from "@/screens/ThreadDetailScreen";
import SubmitProductScreen from "@/screens/SubmitProductScreen";
import AdminProductsScreen from "@/screens/AdminProductsScreen";
import GarageDetailScreen from "@/screens/GarageDetailScreen";
import LoginScreen from "@/screens/LoginScreen";
import SignupScreen from "@/screens/SignupScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { screenTitles } from "@/constants/brand";

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Main: undefined;
  Profile: undefined;
  AddVehicle: undefined;
  AddNote: { vehicleId: string };
  AddListing: undefined;
  ListingDetail: { listingId: string };
  AddThread: { garageId: string };
  ThreadDetail: { threadId: string };
  SubmitProduct: undefined;
  AdminProducts: undefined;
  GarageDetail: { garageId: string; garageName: string };
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
              headerTitle: screenTitles.profile,
            }}
          />
          <Stack.Screen
            name="AddVehicle"
            component={AddVehicleScreen}
            options={{
              presentation: "modal",
              headerTitle: screenTitles.addVehicle,
            }}
          />
          <Stack.Screen
            name="AddNote"
            component={AddNoteScreen}
            options={{
              presentation: "modal",
              headerTitle: screenTitles.addNote,
            }}
          />
          <Stack.Screen
            name="AddListing"
            component={AddListingScreen}
            options={{
              presentation: "modal",
              headerTitle: "Post Item",
            }}
          />
          <Stack.Screen
            name="ListingDetail"
            component={ListingDetailScreen}
            options={{
              headerTitle: "Listing",
            }}
          />
          <Stack.Screen
            name="AddThread"
            component={AddThreadScreen}
            options={{
              presentation: "modal",
              headerTitle: "New Thread",
            }}
          />
          <Stack.Screen
            name="ThreadDetail"
            component={ThreadDetailScreen}
            options={{
              headerTitle: "Thread",
            }}
          />
          <Stack.Screen
            name="SubmitProduct"
            component={SubmitProductScreen}
            options={{
              presentation: "modal",
              headerTitle: screenTitles.submitProduct,
            }}
          />
          <Stack.Screen
            name="AdminProducts"
            component={AdminProductsScreen}
            options={{
              headerTitle: screenTitles.adminProducts,
            }}
          />
          <Stack.Screen
            name="GarageDetail"
            component={GarageDetailScreen}
            options={({ route }) => ({
              headerTitle: route.params.garageName,
            })}
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
