import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import NotesScreen from "@/screens/NotesScreen";
import VehicleDetailScreen from "@/screens/VehicleDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";

export type NotesStackParamList = {
  Notes: undefined;
  VehicleDetail: { vehicleId: string; vehicleName: string };
};

const Stack = createNativeStackNavigator<NotesStackParamList>();

export default function NotesStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();
  const navigation = useNavigation();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Notes"
        component={NotesScreen}
        options={{
          headerTitle: "My Vehicles",
          headerRight: () => (
            <Pressable
              onPress={() => (navigation as any).navigate("Profile")}
              hitSlop={8}
            >
              <Feather name="user" size={22} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen
        name="VehicleDetail"
        component={VehicleDetailScreen}
        options={({ route }) => ({
          headerTitle: route.params.vehicleName,
        })}
      />
    </Stack.Navigator>
  );
}
