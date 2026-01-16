import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MarketplaceScreen from "@/screens/MarketplaceScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type MarketplaceStackParamList = {
  Marketplace: undefined;
};

const Stack = createNativeStackNavigator<MarketplaceStackParamList>();

export default function MarketplaceStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{
          headerTitle: "Marketplace",
        }}
      />
    </Stack.Navigator>
  );
}
