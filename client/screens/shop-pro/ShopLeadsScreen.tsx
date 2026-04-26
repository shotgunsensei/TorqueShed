import React from "react";
import { View, StyleSheet, FlatList, Pressable, Linking } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LockedFeature } from "@/components/LockedFeature";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { useEntitlements } from "@/lib/entitlements";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface ShopLead {
  id: string;
  customerName: string;
  email: string | null;
  phone: string | null;
  vehicle: string | null;
  issue: string;
  preferredContact: string | null;
  serviceId: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function ShopLeadsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasFeature } = useEntitlements();
  const canUse = hasFeature("lead_capture");

  const { data, isLoading, isError, refetch } = useQuery<ShopLead[]>({
    queryKey: ["/api/shop-leads"],
    enabled: canUse,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/shop-leads/${id}`, { isRead: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop-leads/unread-count"] });
    },
  });

  if (!canUse) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.backgroundRoot, paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg }}>
        <LockedFeature
          feature="lead_capture"
          title="Customer leads"
          description="Capture inquiries from your public shop page directly into a Shop Pro inbox."
          onUpgrade={() => navigation.navigate("Subscription")}
        />
      </View>
    );
  }

  const callOrEmail = (kind: "phone" | "email", value: string) => {
    const url = kind === "phone" ? `tel:${value}` : `mailto:${value}`;
    Linking.openURL(url).catch(() => toast.show("Couldn't open contact app", "error"));
  };

  const renderItem = ({ item }: { item: ShopLead }) => (
    <Pressable
      onPress={() => { if (!item.isRead) markRead.mutate(item.id); }}
      testID={`lead-${item.id}`}
    >
      <Card elevation={2} style={styles.row}>
        <View style={styles.rowTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              {!item.isRead ? <View style={[styles.dot, { backgroundColor: theme.primary }]} /> : null}
              <ThemedText type="h4" style={{ flex: 1 }}>{item.customerName}</ThemedText>
            </View>
            {item.vehicle ? (
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>{item.vehicle}</ThemedText>
            ) : null}
          </View>
          <ThemedText type="caption" style={{ color: theme.textMuted }}>{formatDate(item.createdAt)}</ThemedText>
        </View>
        <ThemedText type="body" style={{ marginTop: Spacing.sm, color: theme.text }} numberOfLines={4}>{item.issue}</ThemedText>
        <View style={styles.contactRow}>
          {item.phone ? (
            <Pressable onPress={() => callOrEmail("phone", item.phone!)} style={[styles.contactBtn, { borderColor: theme.cardBorder }]} testID={`button-call-${item.id}`}>
              <Feather name="phone" size={14} color={theme.primary} />
              <ThemedText type="small" style={{ marginLeft: 6, color: theme.text }}>{item.phone}</ThemedText>
            </Pressable>
          ) : null}
          {item.email ? (
            <Pressable onPress={() => callOrEmail("email", item.email!)} style={[styles.contactBtn, { borderColor: theme.cardBorder }]} testID={`button-email-${item.id}`}>
              <Feather name="mail" size={14} color={theme.primary} />
              <ThemedText type="small" style={{ marginLeft: 6, color: theme.text }} numberOfLines={1}>{item.email}</ThemedText>
            </Pressable>
          ) : null}
          {item.preferredContact ? (
            <View style={[styles.chip, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText type="caption" style={{ color: theme.textMuted }}>Prefers {item.preferredContact}</ThemedText>
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <FlatList
        data={data ?? []}
        keyExtractor={(l) => l.id}
        renderItem={renderItem}
        refreshing={isLoading}
        onRefresh={refetch}
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + Spacing["2xl"] }}
        ListHeaderComponent={
          <View style={{ marginBottom: Spacing.md }}>
            <ThemedText type="h2">Customer leads</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.xxs }}>Inquiries from your public shop page.</ThemedText>
          </View>
        }
        ListEmptyComponent={
          isError ? (
            <EmptyState icon="alert-circle" title="Couldn't load leads" description="Please try again." actionLabel="Retry" onAction={() => refetch()} />
          ) : !isLoading ? (
            <EmptyState icon="inbox" title="No leads yet" description="When customers submit your shop page, they'll show up here." />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />
    </View>
  );
}

function formatDate(s: string) {
  try {
    const d = new Date(s);
    const now = Date.now();
    const diff = (now - d.getTime()) / 1000;
    if (diff < 60) return "now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

const styles = StyleSheet.create({
  row: { padding: Spacing.md, borderRadius: BorderRadius.lg },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  nameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  contactRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.sm },
  contactBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: 8, borderWidth: 1, maxWidth: 200 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
});
