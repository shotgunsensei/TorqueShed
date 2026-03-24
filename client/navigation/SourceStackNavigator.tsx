import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { HeaderButton } from "@react-navigation/elements";

import SourceScreen from "@/screens/SourceScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export type SourceStackParamList = {
  Source: undefined;
};

const Stack = createNativeStackNavigator<SourceStackParamList>();

type RootNavProp = NativeStackNavigationProp<RootStackParamList>;

function ProfileButton() {
  const { theme } = useTheme();
  const navigation = useNavigation<RootNavProp>();

  return (
    <HeaderButton onPress={() => navigation.navigate("Profile")}>
      <Feather name="user" size={22} color={theme.text} />
    </HeaderButton>
  );
}

export default function SourceStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Source"
        component={SourceScreen}
        options={{
          headerTitle: "Source",
          headerRight: () => <ProfileButton />,
        }}
      />
    </Stack.Navigator>
  );
}
