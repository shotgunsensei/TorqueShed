import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { HeaderButton } from "@react-navigation/elements";

import SourceScreen from "@/screens/SourceScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";

export type SourceStackParamList = {
  Source: undefined;
};

const Stack = createNativeStackNavigator<SourceStackParamList>();

export default function SourceStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();
  const navigation = useNavigation();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Source"
        component={SourceScreen}
        options={{
          headerTitle: "Source",
          headerRight: () => (
            <HeaderButton
              onPress={() => (navigation as any).navigate("Profile")}
            >
              <Feather name="user" size={22} color={theme.text} />
            </HeaderButton>
          ),
        }}
      />
    </Stack.Navigator>
  );
}
