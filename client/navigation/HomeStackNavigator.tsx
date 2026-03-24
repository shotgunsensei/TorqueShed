import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import HomeScreen from "@/screens/HomeScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import { brand } from "@/constants/brand";

export type HomeStackParamList = {
  Home: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();
  const navigation = useNavigation();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
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
    </Stack.Navigator>
  );
}
