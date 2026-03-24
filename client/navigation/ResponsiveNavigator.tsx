import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform } from "react-native";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import GaragesStackNavigator from "@/navigation/GaragesStackNavigator";
import SwapShopStackNavigator from "@/navigation/SwapShopStackNavigator";
import NotesStackNavigator from "@/navigation/NotesStackNavigator";
import PartsStackNavigator from "@/navigation/PartsStackNavigator";
import TrendingStackNavigator from "@/navigation/TrendingStackNavigator";
import DesktopSidebar from "@/components/DesktopSidebar";
import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";

export type MainTabParamList = {
  HomeTab: undefined;
  GaragesTab: undefined;
  SwapTab: undefined;
  NotesTab: undefined;
  PartsTab: undefined;
  TrendingTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_SCREENS = {
  HomeTab: HomeStackNavigator,
  GaragesTab: GaragesStackNavigator,
  SwapTab: SwapShopStackNavigator,
  NotesTab: NotesStackNavigator,
  PartsTab: PartsStackNavigator,
  TrendingTab: TrendingStackNavigator,
} as const;

function MobileTabNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
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
        name="GaragesTab"
        component={GaragesStackNavigator}
        options={{
          title: "Bays",
          tabBarIcon: ({ color, size }) => (
            <Feather name="message-circle" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SwapTab"
        component={SwapShopStackNavigator}
        options={{
          title: "Swap Shop",
          tabBarIcon: ({ color, size }) => (
            <Feather name="shopping-bag" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="NotesTab"
        component={NotesStackNavigator}
        options={{
          title: "Notes",
          tabBarIcon: ({ color, size }) => (
            <Feather name="file-text" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="PartsTab"
        component={PartsStackNavigator}
        options={{
          title: "TorqueAssist",
          tabBarIcon: ({ color, size }) => (
            <Feather name="tool" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TrendingTab"
        component={TrendingStackNavigator}
        options={{
          title: "Tool & Gear",
          tabBarIcon: ({ color, size }) => (
            <Feather name="box" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function DesktopNavigator() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<keyof typeof TAB_SCREENS>("HomeTab");

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
