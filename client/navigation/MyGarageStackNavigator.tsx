import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MyGarageScreen from "@/screens/MyGarageScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type MyGarageStackParamList = {
  MyGarage: undefined;
};

const Stack = createNativeStackNavigator<MyGarageStackParamList>();

export default function MyGarageStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="MyGarage"
        component={MyGarageScreen}
        options={{
          headerTitle: "My Garage",
        }}
      />
    </Stack.Navigator>
  );
}
