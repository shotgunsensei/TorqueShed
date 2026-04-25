import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { HeaderButton } from "@react-navigation/elements";

import CasesScreen from "@/screens/CasesScreen";
import GaragesScreen from "@/screens/GaragesScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export type CasesStackParamList = {
  Cases: { filter?: string; garageId?: string } | undefined;
  Bays: undefined;
};

const Stack = createNativeStackNavigator<CasesStackParamList>();

type RootNavProp = NativeStackNavigationProp<RootStackParamList>;
type CasesNavProp = NativeStackNavigationProp<CasesStackParamList>;

function HeaderRightActions() {
  const { theme } = useTheme();
  const navigation = useNavigation<CasesNavProp & RootNavProp>();

  return (
    <>
      <HeaderButton onPress={() => navigation.navigate("Bays")}>
        <Feather name="grid" size={20} color={theme.text} />
      </HeaderButton>
      <HeaderButton onPress={() => navigation.navigate("Profile")}>
        <Feather name="user" size={22} color={theme.text} />
      </HeaderButton>
    </>
  );
}

export default function CasesStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Cases"
        component={CasesScreen}
        options={{
          headerTitle: "Cases",
          headerRight: () => <HeaderRightActions />,
        }}
      />
      <Stack.Screen
        name="Bays"
        component={GaragesScreen}
        options={{
          headerTitle: "Browse Bays",
        }}
      />
    </Stack.Navigator>
  );
}
