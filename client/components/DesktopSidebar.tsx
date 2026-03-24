import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar, getUserRoleDisplay } from "@/components/UserAvatar";
import logoImage from "../../assets/logo.png";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import { brand } from "@/constants/brand";

interface NavItem {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

const NAV_ITEMS: NavItem[] = [
  { key: "HomeTab", label: "Home", icon: "home" },
  { key: "GaragesTab", label: "Bays", icon: "message-circle" },
  { key: "SwapTab", label: "Swap Shop", icon: "shopping-bag" },
  { key: "NotesTab", label: "Garage", icon: "tool" },
  { key: "MoreTab", label: "More", icon: "more-horizontal" },
];

interface DesktopSidebarProps {
  activeTab: string;
  onTabPress: (tabKey: string) => void;
}

export default function DesktopSidebar({ activeTab, onTabPress }: DesktopSidebarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();

  const displayName = currentUser?.username || "Guest User";
  const userRole = getUserRoleDisplay(currentUser?.role);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundSecondary,
          borderRightColor: theme.border,
          paddingTop: insets.top + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.lg,
        },
      ]}
    >
      <View style={styles.header}>
        <Image source={logoImage} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.appName, { color: theme.text }]}>{brand.name}</Text>
        <Text style={[styles.tagline, { color: theme.textMuted }]}>{brand.tagline}</Text>
      </View>

      <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => onTabPress(item.key)}
              style={({ pressed }) => [
                styles.navItem,
                {
                  backgroundColor: isActive
                    ? theme.primary + "20"
                    : pressed
                    ? theme.backgroundTertiary
                    : "transparent",
                  borderLeftColor: isActive ? theme.primary : "transparent",
                },
              ]}
            >
              <Feather
                name={item.icon}
                size={20}
                color={isActive ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.navLabel,
                  { color: isActive ? theme.primary : theme.text },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <UserAvatar user={currentUser} size="md" />
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.text }]}>{displayName}</Text>
          {userRole ? (
            <Text style={[styles.userRole, { color: theme.textMuted }]}>{userRole}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 260,
    borderRightWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: Spacing.sm,
  },
  appName: {
    ...Typography.h3,
    marginBottom: 2,
  },
  tagline: {
    ...Typography.caption,
    textAlign: "center",
  },
  navList: {
    flex: 1,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderLeftWidth: 3,
    marginBottom: Spacing.xs,
  },
  navLabel: {
    ...Typography.body,
    marginLeft: Spacing.md,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  userName: {
    ...Typography.body,
    fontWeight: "600",
  },
  userRole: {
    ...Typography.caption,
  },
});
