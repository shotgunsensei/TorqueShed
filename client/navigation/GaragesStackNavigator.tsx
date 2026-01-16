import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import GaragesScreen from "@/screens/GaragesScreen";
import GarageDetailScreen from "@/screens/GarageDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import { brand } from "@/constants/brand";

export type GaragesStackParamList = {
  Garages: undefined;
  GarageDetail: { garageId: string; garageName: string };
};

const Stack = createNativeStackNavigator<GaragesStackParamList>();

export default function GaragesStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();
  const navigation = useNavigation();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Garages"
        component={GaragesScreen}
        options={{
          headerTitle: brand.name,
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
        name="GarageDetail"
        component={GarageDetailScreen}
        options={({ route }) => ({
          headerTitle: route.params.garageName,
        })}
      />
    </Stack.Navigator>
  );
}
