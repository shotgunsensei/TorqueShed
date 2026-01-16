import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import PartsFinderScreen from "@/screens/PartsFinderScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type PartsFinderStackParamList = {
  PartsFinder: undefined;
};

const Stack = createNativeStackNavigator<PartsFinderStackParamList>();

export default function PartsFinderStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="PartsFinder"
        component={PartsFinderScreen}
        options={{
          headerTitle: "Parts Finder",
        }}
      />
    </Stack.Navigator>
  );
}
