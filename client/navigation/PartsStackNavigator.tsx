import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import PartsScreen from "@/screens/PartsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";

export type PartsStackParamList = {
  Parts: undefined;
};

const Stack = createNativeStackNavigator<PartsStackParamList>();

export default function PartsStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();
  const navigation = useNavigation();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Parts"
        component={PartsScreen}
        options={{
          headerTitle: "TorqueAssist",
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
