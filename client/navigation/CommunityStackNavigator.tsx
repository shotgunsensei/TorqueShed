import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import CommunityScreen from "@/screens/CommunityScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type CommunityStackParamList = {
  Community: undefined;
};

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export default function CommunityStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          headerTitle: () => <HeaderTitle title="GearHead" />,
        }}
      />
    </Stack.Navigator>
  );
}
