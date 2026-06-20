import React, { useLayoutEffect, useMemo, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, Linking, Switch, Platform, TextInput } from "react-native";
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

type RangePreset = "all" | "today" | "7d" | "30d" | "custom";

interface DateRange {
  preset: RangePreset;
  from: Date | null;
  to: Date | null;
}

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function resolvePresetRange(preset: RangePreset): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "7d": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { from, to: endOfDay(now) };
    }
    case "30d": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      return { from, to: endOfDay(now) };
    }
    case "all":
    case "custom":
    default:
      return { from: null, to: null };
  }
}

function toIsoDate(d: Date): string {
  // Local YYYY-MM-DD so the server's date-only parsing matches what the user picked.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatRangeLabel(range: DateRange): string {
  if (!range.from && !range.to) return "All time";
  const fmt = (d: Date) => d.toLocaleDateString();
  if (range.from && range.to) {
    if (toIsoDate(range.from) === toIsoDate(range.to)) return fmt(range.from);
    return `${fmt(range.from)} – ${fmt(range.to)}`;
  }
  if (range.from) return `From ${fmt(range.from)}`;
  return `Through ${fmt(range.to!)}`;
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

function buildLeadsHtml(leads: ShopLead[], rangeLabel: string): string {
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
  .meta { color: #555; font-size: 12px; margin-bottom: 4px; }
  .range { color: #111; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; }
  tr:nth-child(even) td { background: #fafafa; }
</style></head>
<body>
  <h1>TorqueShed — Customer Leads</h1>
  <div class="meta">Generated ${escapeHtml(generated)} · ${leads.length} lead${leads.length === 1 ? "" : "s"}</div>
  <div class="range">Date range: ${escapeHtml(rangeLabel)}</div>
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
  const [range, setRange] = useState<DateRange>({ preset: "all", from: null, to: null });

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

  const filterByRange = (lead: ShopLead): boolean => {
    if (!range.from && !range.to) return true;
    if (!lead.createdAt) return false;
    const t = new Date(lead.createdAt).getTime();
    if (range.from && t < range.from.getTime()) return false;
    if (range.to && t > range.to.getTime()) return false;
    return true;
  };

  const filteredAll = useMemo(() => (data ?? []).filter(filterByRange), [data, range]);
  // Owner-only export: leads belonging to the signed-in owner.
  const ownerLeads = useMemo(
    () => (data ?? []).filter((l) => l.ownerUserId === me.data?.id && filterByRange(l)),
    [data, me.data?.id, range],
  );
  const hasOwnerLeads = ownsLeadCapture && ownerLeads.length > 0;
  const rangeLabel = formatRangeLabel(range);

  const selectPreset = (preset: RangePreset) => {
    if (preset === "custom") {
      setRange((prev) => ({ preset: "custom", from: prev.from, to: prev.to }));
      return;
    }
    const { from, to } = resolvePresetRange(preset);
    setRange({ preset, from, to });
  };

  const onPickDate = (target: "from" | "to", value: Date | null) => {
    setRange((prev) => {
      const next: DateRange = { ...prev, preset: "custom" };
      if (target === "from") next.from = value ? startOfDay(value) : null;
      else next.to = value ? endOfDay(value) : null;
      return next;
    });
  };

  const buildExportUrl = (): string => {
    const url = new URL("/api/shop-leads/export.csv", getApiUrl());
    if (range.from) url.searchParams.set("from", toIsoDate(range.from));
    if (range.to) url.searchParams.set("to", toIsoDate(range.to));
    return url.toString();
  };

  const exportCsv = async () => {
    if (exportingCsv) return;
    setExportingCsv(true);
    try {
      const url = buildExportUrl();
      if (Platform.OS === "web") {
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
      const html = buildLeadsHtml(ownerLeads, rangeLabel);
      if (Platform.OS === "web") {
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
  }, [navigation, hasOwnerLeads, exportingCsv, exportingPdf, theme.primary, theme.textMuted, ownerLeads.length, range.preset, range.from, range.to]);

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
    // Match the server-side role policy in server/routes/shopLeads.ts:
    // owner + team admin/technician can mark leads read; viewer is read-only.
    const canMarkRead = !isTeamView || teamCtx?.role === "admin" || teamCtx?.role === "technician";
    return (
    <Pressable
      onPress={() => { if (!item.isRead && canMarkRead) markRead.mutate(item.id); }}
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
                <Feather name={canMarkRead ? "users" : "eye"} size={10} color={theme.primary} />
                <ThemedText type="caption" style={{ color: theme.primary, marginLeft: 4, fontWeight: "600", fontSize: 10 }}>
                  {canMarkRead ? `Team ${teamCtx?.role}` : `Read-only · viewing as team ${teamCtx?.role}`}
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

  const renderRangeControls = () => (
    <Card elevation={1} style={[styles.rangeCard, { borderColor: theme.cardBorder }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Feather name="calendar" size={16} color={theme.primary} />
        <ThemedText type="body" style={{ color: theme.text, flex: 1 }}>Date range</ThemedText>
        <ThemedText type="caption" style={{ color: theme.textMuted }} testID="text-range-label">{rangeLabel}</ThemedText>
      </View>
      <View style={styles.presetRow}>
        {PRESETS.map((p) => {
          const active = range.preset === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => selectPreset(p.key)}
              style={[
                styles.presetBtn,
                {
                  borderColor: active ? theme.primary : theme.cardBorder,
                  backgroundColor: active ? theme.primary + "18" : theme.backgroundSecondary,
                },
              ]}
              testID={`button-range-${p.key}`}
            >
              <ThemedText
                type="small"
                style={{ color: active ? theme.primary : theme.text, fontWeight: active ? "600" : "400" }}
              >
                {p.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {range.preset === "custom" ? (
        <View style={styles.customRow}>
          {Platform.OS === "web" ? (
            <>
              {/* @ts-ignore: native HTML input on web */}
              <input
                type="date"
                value={range.from ? toIsoDate(range.from) : ""}
                onChange={(e: any) => {
                  const v = e.target.value;
                  onPickDate("from", v ? new Date(`${v}T00:00:00`) : null);
                }}
                data-testid="input-range-from"
                style={webDateStyle(theme)}
              />
              {/* @ts-ignore */}
              <input
                type="date"
                value={range.to ? toIsoDate(range.to) : ""}
                onChange={(e: any) => {
                  const v = e.target.value;
                  onPickDate("to", v ? new Date(`${v}T00:00:00`) : null);
                }}
                data-testid="input-range-to"
                style={webDateStyle(theme)}
              />
            </>
          ) : (
            <>
              <TextInput
                value={range.from ? toIsoDate(range.from) : ""}
                onChangeText={(text) => {
                  if (!text) return onPickDate("from", null);
                  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                    const d = new Date(`${text}T00:00:00`);
                    if (!isNaN(d.getTime())) onPickDate("from", d);
                  }
                }}
                placeholder="From YYYY-MM-DD"
                placeholderTextColor={theme.textMuted}
                style={[styles.dateInput, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                testID="input-range-from"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                value={range.to ? toIsoDate(range.to) : ""}
                onChangeText={(text) => {
                  if (!text) return onPickDate("to", null);
                  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                    const d = new Date(`${text}T00:00:00`);
                    if (!isNaN(d.getTime())) onPickDate("to", d);
                  }
                }}
                placeholder="To YYYY-MM-DD"
                placeholderTextColor={theme.textMuted}
                style={[styles.dateInput, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                testID="input-range-to"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          )}
          {range.from || range.to ? (
            <Pressable
              onPress={() => setRange({ preset: "custom", from: null, to: null })}
              style={[styles.dateBtn, { borderColor: theme.cardBorder }]}
              testID="button-range-clear"
            >
              <Feather name="x" size={12} color={theme.textMuted} />
              <ThemedText type="small" style={{ color: theme.textMuted, marginLeft: 4 }}>Clear</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <FlatList
        data={filteredAll}
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
                    ? "Use the installed mobile app to receive push alerts for new leads."
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
            {ownsLeadCapture ? renderRangeControls() : null}
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
            (data ?? []).length > 0 ? (
              <EmptyState icon="calendar" title="No leads in this range" description="Try a different date range to see more leads." />
            ) : (
              <EmptyState icon="inbox" title="No leads yet" description="When customers submit your shop page, they'll show up here." />
            )
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />
    </View>
  );
}

function webDateStyle(theme: any): any {
  return {
    padding: 8,
    borderRadius: 8,
    border: `1px solid ${theme.cardBorder}`,
    backgroundColor: theme.backgroundSecondary,
    color: theme.text,
    fontSize: 13,
  };
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
  rangeCard: {
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.sm },
  presetBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  customRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.sm, alignItems: "center" },
  dateBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  dateInput: { paddingHorizontal: Spacing.sm, paddingVertical: 8, borderRadius: 8, borderWidth: 1, minWidth: 150, fontSize: 13 },
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
