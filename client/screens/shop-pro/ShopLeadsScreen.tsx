import React, { useLayoutEffect, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, Linking, Switch, Platform } from "react-native";
import { useHeaderHeight, HeaderButton } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LockedFeature } from "@/components/LockedFeature";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { useEntitlements } from "@/lib/entitlements";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "torqueshed_auth_token";

async function getToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return localStorage.getItem(TOKEN_KEY);
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

interface MeResponse {
  id: string;
  username: string;
  role: string;
  onboardingCompleted: boolean;
  onboardingGoals: string[];
  notificationsEnabled: boolean;
}

interface ShopLead {
  id: string;
  ownerUserId: string;
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

interface TeamMembership {
  ownerUserId: string;
  role: "owner" | "admin" | "technician" | "viewer";
  ownerHasTeamAccess: boolean;
  ownerHasLeadCapture: boolean;
  ownerHasCustomerSummaries: boolean;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
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

function buildLeadsHtml(leads: ShopLead[]): string {
  const generated = new Date().toLocaleString();
  const rows = leads.map((l) => `
    <tr>
      <td>${escapeHtml(new Date(l.createdAt).toLocaleString())}</td>
      <td>${escapeHtml(l.customerName)}</td>
      <td>${escapeHtml(l.vehicle ?? "")}</td>
      <td>${escapeHtml(l.phone ?? "")}<br/>${escapeHtml(l.email ?? "")}</td>
      <td>${escapeHtml(l.preferredContact ?? "")}</td>
      <td>${escapeHtml(l.issue)}</td>
    </tr>
  `).join("");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; margin: 24px; }
  h1 { margin: 0 0 4px 0; font-size: 22px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; }
  tr:nth-child(even) td { background: #fafafa; }
</style></head>
<body>
  <h1>TorqueShed — Customer Leads</h1>
  <div class="meta">Generated ${escapeHtml(generated)} · ${leads.length} lead${leads.length === 1 ? "" : "s"}</div>
  <table>
    <thead><tr>
      <th>Received</th><th>Name</th><th>Vehicle</th><th>Contact</th><th>Prefers</th><th>Issue</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;
}

export default function ShopLeadsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasFeature } = useEntitlements();
  const ownsLeadCapture = hasFeature("lead_capture");
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const { data: membershipData } = useQuery<{ memberships: TeamMembership[] }>({
    queryKey: ["/api/shop-team/memberships"],
  });
  const memberships = membershipData?.memberships ?? [];
  const teamLeadAccess = memberships.some((m) => m.ownerHasLeadCapture);
  const canUse = ownsLeadCapture || teamLeadAccess;
  const ownerByUserId = new Map(memberships.map((m) => [m.ownerUserId, m]));

  const { data, isLoading, isError, refetch } = useQuery<ShopLead[]>({
    queryKey: ["/api/shop-leads"],
    enabled: canUse,
  });

  const me = useQuery<MeResponse>({
    queryKey: ["/api/users/me"],
    enabled: canUse,
  });

  const updatePrefs = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PATCH", "/api/users/me/notifications", {
        notificationsEnabled: enabled,
      });
      return (await res.json()) as { notificationsEnabled: boolean };
    },
    onSuccess: (next) => {
      queryClient.setQueryData<MeResponse>(["/api/users/me"], (prev) =>
        prev ? { ...prev, notificationsEnabled: next.notificationsEnabled } : prev,
      );
    },
    onError: () => toast.show("Couldn't update notifications", "error"),
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

  // Owner-only export: leads belonging to the signed-in owner.
  const ownerLeads = (data ?? []).filter((l) => l.ownerUserId === me.data?.id);
  const hasOwnerLeads = ownsLeadCapture && ownerLeads.length > 0;

  const exportCsv = async () => {
    if (exportingCsv) return;
    setExportingCsv(true);
    try {
      const url = new URL("/api/shop-leads/export.csv", getApiUrl()).toString();
      if (Platform.OS === "web") {
        // Browsers attach session cookies automatically; for token auth we fetch
        // and trigger a Blob download so the Authorization header is honored.
        const token = await getToken();
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: "include",
        });
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `shop-leads-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        toast.show("CSV downloaded", "success");
        return;
      }
      const token = await getToken();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const csv = await res.text();
      const fileUri = `${FileSystem.cacheDirectory}shop-leads-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Customer Leads" });
      } else {
        toast.show(`CSV saved to ${fileUri}`, "success");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to export CSV";
      toast.show(msg, "error");
    } finally {
      setExportingCsv(false);
    }
  };

  const exportPdf = async () => {
    if (exportingPdf) return;
    if (ownerLeads.length === 0) return;
    setExportingPdf(true);
    try {
      const html = buildLeadsHtml(ownerLeads);
      if (Platform.OS === "web") {
        // expo-print on web opens a print dialog with the rendered HTML.
        await Print.printAsync({ html });
        return;
      }
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Customer Leads" });
      } else {
        toast.show(`PDF saved to ${uri}`, "success");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to export PDF";
      toast.show(msg, "error");
    } finally {
      setExportingPdf(false);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        hasOwnerLeads ? (
          <View style={{ flexDirection: "row" }}>
            <HeaderButton
              onPress={exportCsv}
              disabled={exportingCsv}
              testID="button-export-csv"
              accessibilityLabel="Export leads as CSV"
            >
              <Feather
                name="download"
                size={18}
                color={exportingCsv ? theme.textMuted : theme.primary}
              />
            </HeaderButton>
            <HeaderButton
              onPress={exportPdf}
              disabled={exportingPdf}
              testID="button-export-pdf"
              accessibilityLabel="Export leads as PDF"
            >
              <Feather
                name="file-text"
                size={18}
                color={exportingPdf ? theme.textMuted : theme.primary}
              />
            </HeaderButton>
          </View>
        ) : undefined,
    });
  }, [navigation, hasOwnerLeads, exportingCsv, exportingPdf, theme.primary, theme.textMuted, ownerLeads.length]);

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

  const renderItem = ({ item }: { item: ShopLead }) => {
    const teamCtx = ownerByUserId.get(item.ownerUserId);
    const isTeamView = !!teamCtx;
    return (
    <Pressable
      onPress={() => { if (!item.isRead && !isTeamView) markRead.mutate(item.id); }}
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
            {isTeamView ? (
              <View
                style={[styles.teamBadge, { backgroundColor: theme.primary + "18", borderColor: theme.primary + "55" }]}
                testID={`badge-team-lead-${item.id}`}
              >
                <Feather name="eye" size={10} color={theme.primary} />
                <ThemedText type="caption" style={{ color: theme.primary, marginLeft: 4, fontWeight: "600", fontSize: 10 }}>
                  Read-only · viewing as team {teamCtx?.role}
                </ThemedText>
              </View>
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
  };

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
            <Card elevation={1} style={[styles.prefsRow, { borderColor: theme.cardBorder }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Feather name="bell" size={16} color={theme.primary} />
                  <ThemedText type="body" style={{ color: theme.text }}>Notify me of new leads</ThemedText>
                </View>
                <ThemedText type="caption" style={{ color: theme.textMuted, marginTop: 2 }}>
                  {Platform.OS === "web"
                    ? "Open TorqueShed in Expo Go on your phone to receive push alerts."
                    : "Get a push notification the moment a customer submits."}
                </ThemedText>
              </View>
              <Switch
                testID="switch-lead-notifications"
                value={me.data?.notificationsEnabled ?? true}
                onValueChange={(v) => updatePrefs.mutate(v)}
                disabled={updatePrefs.isPending || !me.data}
              />
            </Card>
            {hasOwnerLeads ? (
              <View style={styles.exportRow}>
                <Pressable
                  onPress={exportCsv}
                  disabled={exportingCsv}
                  style={[styles.exportBtn, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary, opacity: exportingCsv ? 0.6 : 1 }]}
                  testID="button-export-csv-inline"
                >
                  <Feather name="download" size={14} color={theme.primary} />
                  <ThemedText type="small" style={{ marginLeft: 6, color: theme.text }}>
                    {exportingCsv ? "Exporting…" : "Export CSV"}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={exportPdf}
                  disabled={exportingPdf}
                  style={[styles.exportBtn, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary, opacity: exportingPdf ? 0.6 : 1 }]}
                  testID="button-export-pdf-inline"
                >
                  <Feather name="file-text" size={14} color={theme.primary} />
                  <ThemedText type="small" style={{ marginLeft: 6, color: theme.text }}>
                    {exportingPdf ? "Building…" : "Export PDF"}
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}
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

const styles = StyleSheet.create({
  row: { padding: Spacing.md, borderRadius: BorderRadius.lg },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  nameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  contactRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.sm },
  contactBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: 8, borderWidth: 1, maxWidth: 200 },
  teamBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  prefsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  exportRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
});
