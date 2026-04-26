import React from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/Toast";
import { UserAvatar, getUserRoleDisplay } from "@/components/UserAvatar";
import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useEntitlements } from "@/lib/entitlements";
import type { MoreStackParamList } from "@/navigation/MoreStackNavigator";

type MoreNavProp = NativeStackNavigationProp<MoreStackParamList>;

interface MenuItem {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
  action: "stack" | "tab" | "toast";
  screen?: keyof MoreStackParamList;
  tab?: string;
  toastMessage?: string;
  badgeKey?: "leads";
}

const MENU_GROUPS: { title: string; items: MenuItem[] }[] = [
  {
    title: "Diagnostics",
    items: [
      { label: "TorqueAssist", icon: "tool", action: "stack", screen: "TorqueAssist", description: "Diagnostic wizard and checklists" },
      { label: "Bays", icon: "grid", action: "tab", tab: "CasesTab", description: "Browse brand-specific community garages" },
      { label: "Tool Inventory", icon: "briefcase", action: "stack", screen: "ToolInventory", description: "Catalog the tools you own (Garage Pro)" },
      { label: "Saved Cases", icon: "bookmark", action: "toast", toastMessage: "Saved cases live on your profile.", description: "Review the cases you've bookmarked" },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { label: "Tool & Gear", icon: "shopping-bag", action: "stack", screen: "ToolAndGear", description: "Curated tools and gear picks" },
      { label: "My Listings", icon: "package", action: "stack", screen: "MyListings", description: "Manage your swap shop listings" },
      { label: "Seller Dashboard", icon: "bar-chart-2", action: "stack", screen: "SellerDashboard", description: "Active listings, drafts, and attached cases" },
    ],
  },
  {
    title: "Shop Pro",
    items: [
      { label: "Shop Profile", icon: "home", action: "stack", screen: "ShopProfile", description: "Your public-facing shop page" },
      { label: "Services", icon: "list", action: "stack", screen: "ShopServices", description: "Services you offer with pricing" },
      { label: "Customer Leads", icon: "inbox", action: "stack", screen: "ShopLeads", description: "Inquiries from your shop page", badgeKey: "leads" },
      { label: "Team", icon: "users", action: "stack", screen: "ShopTeam", description: "Invite techs and advisors to your shop" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Subscription", icon: "star", action: "stack", screen: "Subscription", description: "Plans, billing, and premium features" },
      { label: "Settings", icon: "settings", action: "toast", toastMessage: "Settings panel is coming soon.", description: "App preferences and notifications" },
      { label: "Help", icon: "help-circle", action: "toast", toastMessage: "Help center is coming soon.", description: "FAQs, support, and contact" },
    ],
  },
];

export default function MoreScreen() {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const navigation = useNavigation<MoreNavProp>();
  const tabBarHeight = useSafeTabBarHeight();
  const headerHeight = useHeaderHeight();
  const toast = useToast();
  const { tier, hasFeature } = useEntitlements();
  const leadCaptureEnabled = hasFeature("lead_capture");
  const { data: unreadLeads } = useQuery<{ count: number }>({
    queryKey: ["/api/shop-leads/unread-count"],
    enabled: leadCaptureEnabled,
    refetchInterval: 60_000,
  });
  const badgeCounts: Partial<Record<NonNullable<MenuItem["badgeKey"]>, number>> = {
    leads: unreadLeads?.count ?? 0,
  };

  const userRole = getUserRoleDisplay(currentUser?.role);

  const handleMenuPress = (item: MenuItem) => {
    if (item.action === "stack" && item.screen) {
      navigation.navigate(item.screen);
      return;
    }
    if (item.action === "tab" && item.tab) {
      const parent = navigation.getParent();
      if (parent) parent.navigate(item.tab as never);
      return;
    }
    if (item.action === "toast" && item.toastMessage) {
      toast.show(item.toastMessage, "info");
    }
  };

  const tierLabel = tier === "free" ? "Free" : tier === "diy_pro" ? "DIY Pro" : tier === "garage_pro" ? "Garage Pro" : "Shop Pro";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
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
          <View style={styles.profileMetaRow}>
            {userRole ? (
              <ThemedText type="caption" style={{ color: theme.textMuted }}>
                {userRole}
              </ThemedText>
            ) : null}
            {userRole ? <ThemedText type="caption" style={{ color: theme.textMuted, marginHorizontal: 4 }}>·</ThemedText> : null}
            <View style={[styles.tierPill, { backgroundColor: theme.primary + "20" }]}>
              <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "600" }}>{tierLabel}</ThemedText>
            </View>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={theme.textMuted} />
      </Pressable>

      {MENU_GROUPS.map((group) => (
        <View key={group.title} style={styles.group}>
          <ThemedText type="caption" style={[styles.groupTitle, { color: theme.textMuted }]}>{group.title.toUpperCase()}</ThemedText>
          <View style={styles.menuList}>
            {group.items.map((item) => {
              const badge = item.badgeKey ? badgeCounts[item.badgeKey] ?? 0 : 0;
              return (
                <Card
                  key={item.label}
                  onPress={() => handleMenuPress(item)}
                  testID={`menu-item-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
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
                    {badge > 0 ? (
                      <View
                        style={[styles.badge, { backgroundColor: theme.primary }]}
                        testID={`menu-badge-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <ThemedText type="caption" style={{ color: "#fff", fontWeight: "700" }}>
                          {badge > 99 ? "99+" : String(badge)}
                        </ThemedText>
                      </View>
                    ) : null}
                    <Feather name="chevron-right" size={20} color={theme.textMuted} />
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  profileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  tierPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  group: {
    marginBottom: Spacing.lg,
  },
  groupTitle: {
    letterSpacing: 1,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
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
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
});
