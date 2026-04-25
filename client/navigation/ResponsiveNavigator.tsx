import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform } from "react-native";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import DiagnoseStackNavigator from "@/navigation/DiagnoseStackNavigator";
import CasesStackNavigator from "@/navigation/CasesStackNavigator";
import NotesStackNavigator from "@/navigation/NotesStackNavigator";
import MarketStackNavigator from "@/navigation/MarketStackNavigator";
import MoreStackNavigator from "@/navigation/MoreStackNavigator";
import DesktopSidebar from "@/components/DesktopSidebar";
import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";

export type MainTabParamList = {
  HomeTab: undefined;
  DiagnoseTab: undefined;
  CasesTab: undefined;
  NotesTab: undefined;
  MarketTab: undefined;
  MoreTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_SCREENS = {
  HomeTab: HomeStackNavigator,
  DiagnoseTab: DiagnoseStackNavigator,
  CasesTab: CasesStackNavigator,
  NotesTab: NotesStackNavigator,
  MarketTab: MarketStackNavigator,
  MoreTab: MoreStackNavigator,
} as const;

function MobileTabNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="CasesTab"
      screenOptions={{
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
            web: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Inter_500Medium",
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DiagnoseTab"
        component={DiagnoseStackNavigator}
        options={{
          title: "Diagnose",
          tabBarIcon: ({ color, size }) => (
            <Feather name="activity" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CasesTab"
        component={CasesStackNavigator}
        options={{
          title: "Cases",
          tabBarIcon: ({ color, size }) => (
            <Feather name="clipboard" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="NotesTab"
        component={NotesStackNavigator}
        options={{
          title: "Garage",
          tabBarIcon: ({ color, size }) => (
            <Feather name="tool" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MarketTab"
        component={MarketStackNavigator}
        options={{
          title: "Market",
          tabBarIcon: ({ color, size }) => (
            <Feather name="shopping-bag" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStackNavigator}
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => (
            <Feather name="more-horizontal" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function DesktopNavigator() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<keyof typeof TAB_SCREENS>("CasesTab");

  const handleTabPress = (key: string) => {
    setActiveTab(key as keyof typeof TAB_SCREENS);
  };

  const ActiveScreen = TAB_SCREENS[activeTab];

  return (
    <View style={[styles.desktopContainer, { backgroundColor: theme.backgroundRoot }]}>
      <DesktopSidebar activeTab={activeTab} onTabPress={handleTabPress} />
      <View style={styles.mainContent} key={activeTab}>
        <ActiveScreen />
      </View>
    </View>
  );
}

export default function ResponsiveNavigator() {
  const { isDesktop } = useResponsive();

  if (isDesktop) {
    return <DesktopNavigator />;
  }

  return <MobileTabNavigator />;
}

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    flexDirection: "row",
  },
  mainContent: {
    flex: 1,
  },
});
