import React, { useState } from "react";
import { View, StyleSheet, FlatList, Pressable, Alert } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { LockedFeature } from "@/components/LockedFeature";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { useEntitlements } from "@/lib/entitlements";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const ROLES: { value: string; label: string }[] = [
  { value: "technician", label: "Technician" },
  { value: "viewer", label: "Viewer" },
  { value: "admin", label: "Admin" },
];

interface TeamMember {
  id: string;
  memberUserId: string;
  username: string | null;
  displayName: string | null;
  role: string;
  joinedAt: string;
}

export default function ShopTeamScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasFeature } = useEntitlements();
  const canUse = hasFeature("team_access");

  const { data, isLoading, isError, refetch } = useQuery<TeamMember[]>({
    queryKey: ["/api/shop-team"],
    enabled: canUse,
  });

  const [username, setUsername] = useState("");
  const [role, setRole] = useState("technician");

  const invite = useMutation({
    mutationFn: async () => {
      if (!username.trim()) throw new Error("Username is required");
      const res = await apiRequest("POST", "/api/shop-team", { username: username.trim(), role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-team"] });
      toast.show("Team member added", "success");
      setUsername("");
      setRole("technician");
    },
    onError: (err: Error) => toast.show(err.message || "Failed to add member", "error"),
  });

  const removeMember = useMutation({
    mutationFn: async (membershipId: string) => {
      await apiRequest("DELETE", `/api/shop-team/${membershipId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-team"] });
      toast.show("Team member removed", "success");
    },
    onError: (err: Error) => toast.show(err.message || "Failed to remove", "error"),
  });

  const confirmRemove = (m: TeamMember) => {
    Alert.alert("Remove team member?", `${m.username ?? "This user"} will lose access to your shop's cases and leads.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeMember.mutate(m.id) },
    ]);
  };

  if (!canUse) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.backgroundRoot, paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg }}>
        <LockedFeature
          feature="team_access"
          title="Team access"
          description="Invite technicians and advisors to collaborate on your shop's cases."
          onUpgrade={() => navigation.navigate("Subscription")}
        />
      </View>
    );
  }

  const renderItem = ({ item }: { item: TeamMember }) => (
    <Card elevation={2} style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: theme.primary + "20" }]}>
        <Feather name="user" size={20} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText type="h4">{item.displayName || item.username || "Member"}</ThemedText>
        <View style={styles.metaRow}>
          {item.username ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>@{item.username}</ThemedText>
          ) : null}
          <View style={[styles.chip, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="caption" style={{ color: theme.textMuted }}>{labelForRole(item.role)}</ThemedText>
          </View>
        </View>
      </View>
      <Pressable onPress={() => confirmRemove(item)} style={styles.removeBtn} testID={`button-remove-${item.memberUserId}`}>
        <Feather name="x" size={18} color={theme.error} />
      </Pressable>
    </Card>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <FlatList
        data={data ?? []}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        refreshing={isLoading}
        onRefresh={refetch}
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + Spacing["2xl"] }}
        ListHeaderComponent={
          <View>
            <View style={{ marginBottom: Spacing.md }}>
              <ThemedText type="h2">Team</ThemedText>
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.xxs }}>Members can view and respond to your shop's cases.</ThemedText>
            </View>
            <Card elevation={2} style={styles.inviteCard}>
              <ThemedText type="h4">Add a member</ThemedText>
              <View style={{ marginTop: Spacing.sm }}>
                <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>TorqueShed username</ThemedText>
                <Input value={username} onChangeText={setUsername} placeholder="username" autoCapitalize="none" testID="input-invite-username" />
              </View>
              <View style={{ marginTop: Spacing.sm }}>
                <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Role</ThemedText>
                <View style={styles.roleRow}>
                  {ROLES.map((r) => {
                    const active = role === r.value;
                    return (
                      <Pressable
                        key={r.value}
                        onPress={() => setRole(r.value)}
                        style={[styles.roleChip, { borderColor: active ? theme.primary : theme.cardBorder, backgroundColor: active ? theme.primary + "20" : theme.backgroundSecondary }]}
                        testID={`chip-role-${r.value}`}
                      >
                        <ThemedText type="caption" style={{ color: active ? theme.primary : theme.textSecondary, fontWeight: active ? "700" : "500" }}>{r.label}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={{ marginTop: Spacing.md }}>
                <Button onPress={() => invite.mutate()} disabled={invite.isPending} testID="button-invite-member">
                  {invite.isPending ? "Adding…" : "Add member"}
                </Button>
              </View>
            </Card>
            <ThemedText type="caption" style={{ color: theme.textMuted, marginTop: Spacing.lg, marginBottom: Spacing.sm, textTransform: "uppercase", letterSpacing: 1 }}>Members</ThemedText>
          </View>
        }
        ListEmptyComponent={
          isError ? (
            <EmptyState icon="alert-circle" title="Couldn't load team" description="Please try again." actionLabel="Retry" onAction={() => refetch()} />
          ) : !isLoading ? (
            <EmptyState icon="users" title="No team members yet" description="Add technicians or advisors above to share access." />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />
    </View>
  );
}

function labelForRole(value: string) {
  return ROLES.find((r) => r.value === value)?.label ?? value;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: Spacing.sm, marginTop: 2 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  removeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  inviteCard: { padding: Spacing.lg, borderRadius: BorderRadius.xl },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
});
