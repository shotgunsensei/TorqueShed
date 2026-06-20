import React from "react";
import { View, ScrollView, StyleSheet, Pressable, Linking } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/Toast";
import { UserAvatar, getUserRoleDisplay } from "@/components/UserAvatar";
import { TrialReminderBanner } from "@/components/TrialReminderBanner";
import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import { useResponsive } from "@/hooks/useResponsive";
import { Spacing, BorderRadius } from "@/constants/theme";
import { brand } from "@/constants/brand";
import { useEntitlements } from "@/lib/entitlements";
import type { MoreStackParamList } from "@/navigation/MoreStackNavigator";

type MoreNavProp = NativeStackNavigationProp<MoreStackParamList>;

interface MenuItem {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
  action: "stack" | "tab" | "toast" | "external";
  screen?: keyof MoreStackParamList;
  tab?: string;
  toastMessage?: string;
  url?: string;
  badgeKey?: "leads";
}

const MENU_GROUPS: { title: string; items: MenuItem[] }[] = [
  {
    title: "Workspace",
    items: [
      { label: "Repair Cases", icon: "clipboard", action: "tab", tab: "CasesTab", description: "Open cases, continue tests, and search solved fixes" },
      { label: "Vehicle Garage", icon: "truck", action: "tab", tab: "NotesTab", description: "Vehicles, build notes, repair logs, and maintenance history" },
      { label: "Parts & Tools", icon: "search", action: "tab", tab: "MarketTab", description: "Find parts and attach useful tools to repair work" },
      { label: "Tool Inventory", icon: "briefcase", action: "stack", screen: "ToolInventory", description: "Catalog tools you can use during diagnosis" },
    ],
  },
  {
    title: "Shop Workflow",
    items: [
      { label: "Customer Leads", icon: "inbox", action: "stack", screen: "ShopLeads", description: "Service requests connected to real vehicle needs", badgeKey: "leads" },
      { label: "Shop Profile", icon: "home", action: "stack", screen: "ShopProfile", description: "Show the services and vehicles your shop handles" },
      { label: "Team Access", icon: "users", action: "stack", screen: "ShopTeam", description: "Invite techs and advisors to work cases" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Plan & Access", icon: "key", action: "stack", screen: "Subscription", description: "OperatorOS access, entitlements, and billing portal" },
      { label: "Notifications", icon: "bell", action: "stack", screen: "NotificationSettings", description: "Maintenance reminders by push or email" },
      { label: "Verify Email", icon: "mail", action: "stack", screen: "VerifyEmail", description: "Confirm your email to receive notices" },
      { label: "Help", icon: "help-circle", action: "external", url: `mailto:${brand.supportEmail}`, description: "Email TorqueShed support" },
    ],
  },
];

export default function MoreScreen() {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const navigation = useNavigation<MoreNavProp>();
  const tabBarHeight = useSafeTabBarHeight();
  const headerHeight = useHeaderHeight();
  const { isDesktop } = useResponsive();
  const toast = useToast();
  const { tier, hasFeature } = useEntitlements();
  const leadCaptureEnabled = hasFeature("lead_capture");
  const { data: unreadLeads } = useQuery<{ count: number }>({
    queryKey: ["/api/shop-leads/unread-count"],
    enabled: leadCaptureEnabled,
    refetchInterval: 60_000,
  });
  const queryClient = useQueryClient();
  const { data: me } = useQuery<{ email: string | null; emailVerifiedAt: string | null }>({
    queryKey: ["/api/users/me"],
  });
  const showVerifyBanner = !!me?.email && !me?.emailVerifiedAt;
  const sendVerifyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/email/send-verification", {});
      return res.json();
    },
    onSuccess: (body: { alreadyVerified?: boolean }) => {
      if (body?.alreadyVerified) {
        toast.show("Email already verified", "success");
        queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      } else {
        toast.show("Verification email sent. Check your inbox.", "success");
      }
    },
    onError: (err: Error) => {
      const msg = err?.message || "";
      if (msg.includes("429")) toast.show("Too many requests. Try again later.", "error");
      else toast.show("Failed to send verification email", "error");
    },
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
      return;
    }
    if (item.action === "external" && item.url) {
      Linking.openURL(item.url).catch(() => {
        toast.show("Could not open the link", "error");
      });
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
        maxWidth: isDesktop ? 980 : undefined,
        alignSelf: isDesktop ? "center" : undefined,
        width: isDesktop ? "100%" : undefined,
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
        accessibilityRole="button"
        accessibilityLabel={`View profile for ${currentUser?.username || "guest"}`}
        accessibilityHint="Open your profile settings"
        testID="button-open-profile"
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

      <TrialReminderBanner onManageBilling={() => navigation.navigate("Subscription")} />

      {showVerifyBanner ? (
        <Card
          style={[styles.verifyBanner, { backgroundColor: theme.primary + "15", borderColor: theme.primary + "40" }]}
          testID="banner-verify-email"
        >
          <View style={styles.verifyRow}>
            <Feather name="mail" size={22} color={theme.primary} />
            <View style={styles.verifyText}>
              <ThemedText type="h4">Verify your email</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Confirm {me?.email} so we can deliver maintenance reminders and account notices.
              </ThemedText>
            </View>
          </View>
          <Button
            onPress={() => sendVerifyMutation.mutate()}
            disabled={sendVerifyMutation.isPending}
            style={styles.verifyBtn}
            testID="button-banner-verify-email"
            accessibilityLabel={
              sendVerifyMutation.isPending ? "Sending verification email" : "Send verification email"
            }
            accessibilityHint="We'll email you a link to confirm your address"
            accessibilityState={{ busy: sendVerifyMutation.isPending }}
          >
            {sendVerifyMutation.isPending ? "Sending…" : "Send verification email"}
          </Button>
        </Card>
      ) : null}

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
                  accessibilityLabel={item.label}
                  accessibilityHint={`Open ${item.label}`}
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

      <ThemedText
        type="caption"
        style={{ color: theme.textMuted, textAlign: "center", marginTop: Spacing.md, letterSpacing: 1 }}
      >
        DIAGNOSTIC WORKSPACE FOR REAL REPAIRS
      </ThemedText>
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
  verifyBanner: {
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  verifyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  verifyText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  verifyBtn: {
    marginTop: Spacing.md,
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
