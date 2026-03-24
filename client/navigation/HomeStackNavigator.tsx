import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import HomeScreen from "@/screens/HomeScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import { brand } from "@/constants/brand";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export type HomeStackParamList = {
  Home: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

type RootNavProp = NativeStackNavigationProp<RootStackParamList>;

function ProfileButton() {
  const { theme } = useTheme();
  const navigation = useNavigation<RootNavProp>();

  return (
    <Pressable
      onPress={() => navigation.navigate("Profile")}
      hitSlop={8}
    >
      <Feather name="user" size={22} color={theme.text} />
    </Pressable>
  );
}

export default function HomeStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: brand.name,
          headerRight: () => <ProfileButton />,
        }}
      />
    </Stack.Navigator>
  );
}
