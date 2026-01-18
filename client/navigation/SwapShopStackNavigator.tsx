import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import SwapShopScreen from "@/screens/SwapShopScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import { screenTitles } from "@/constants/brand";

export type SwapShopStackParamList = {
  SwapShop: undefined;
};

const Stack = createNativeStackNavigator<SwapShopStackParamList>();

export default function SwapShopStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();
  const navigation = useNavigation();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="SwapShop"
        component={SwapShopScreen}
        options={{
          headerTitle: screenTitles.swapShop,
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
