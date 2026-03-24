import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar, getUserRoleDisplay } from "@/components/UserAvatar";
import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { MoreStackParamList } from "@/navigation/MoreStackNavigator";

type MoreNavProp = NativeStackNavigationProp<MoreStackParamList>;

interface MenuItem {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  screen: keyof MoreStackParamList;
  description: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    label: "TorqueAssist",
    icon: "tool",
    screen: "TorqueAssist",
    description: "Diagnostic wizard and checklists",
  },
];

export default function MoreScreen() {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const navigation = useNavigation<MoreNavProp>();
  const tabBarHeight = useSafeTabBarHeight();

  const userRole = getUserRoleDisplay(currentUser?.role);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundRoot,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
    >
      <Pressable
        style={[styles.profileRow, { backgroundColor: theme.backgroundDefault }]}
        onPress={() => {
          const parent = navigation.getParent()?.getParent();
          if (parent) {
            parent.navigate("Profile");
          }
        }}
      >
        <UserAvatar user={currentUser} size="md" />
        <View style={styles.profileInfo}>
          <ThemedText type="h4">{currentUser?.username || "Guest"}</ThemedText>
          {userRole ? (
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              {userRole}
            </ThemedText>
          ) : null}
        </View>
        <Feather name="chevron-right" size={20} color={theme.textMuted} />
      </Pressable>

      <View style={styles.menuList}>
        {MENU_ITEMS.map((item) => (
          <Card
            key={item.screen}
            onPress={() => navigation.navigate(item.screen)}
            testID={`menu-item-${item.screen}`}
          >
            <View style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: theme.primary + "15" }]}>
                <Feather name={item.icon} size={22} color={theme.primary} />
              </View>
              <View style={styles.menuText}>
                <ThemedText type="h4">{item.label}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {item.description}
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textMuted} />
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    marginBottom: Spacing.lg,
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  menuList: {
    gap: Spacing.sm,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  menuText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
});
