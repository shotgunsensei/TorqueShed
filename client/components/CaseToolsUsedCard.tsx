import React, { useState } from "react";
import { View, StyleSheet, Pressable, Modal, ScrollView } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useEntitlements } from "@/lib/entitlements";
import { apiRequest } from "@/lib/query-client";

interface ToolRow {
  id: string;
  name: string;
  brand: string | null;
  category: string;
}

interface CaseToolLink {
  id: string;
  caseId: string;
  toolId: string;
  attachedBy: string;
  createdAt: string | null;
  tool: ToolRow | null;
}

interface Props {
  caseId: string;
  isAuthor: boolean;
  onUpgrade: () => void;
}

export default function CaseToolsUsedCard({ caseId, isAuthor, onUpgrade }: Props) {
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { hasFeature } = useEntitlements();
  const canUseInventory = hasFeature("tool_inventory");
  const [pickerOpen, setPickerOpen] = useState(false);

  const linksKey = [`/api/cases/${caseId}/tools-used`];
  const { data: links } = useQuery<CaseToolLink[]>({ queryKey: linksKey, enabled: isAuthor });

  const { data: inventory } = useQuery<ToolRow[]>({
    queryKey: ["/api/tools"],
    enabled: pickerOpen && canUseInventory,
  });

  const attach = useMutation({
    mutationFn: async (toolId: string) => {
      const res = await apiRequest("POST", `/api/cases/${caseId}/tools-used`, { toolId });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linksKey });
      toast.show("Tool attached", "success");
      setPickerOpen(false);
    },
    onError: (e: Error) => toast.show(e.message || "Failed to attach tool", "error"),
  });

  const detach = useMutation({
    mutationFn: async (linkId: string) => {
      await apiRequest("DELETE", `/api/cases/${caseId}/tools-used/${linkId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: linksKey }),
    onError: (e: Error) => toast.show(e.message || "Failed to remove tool", "error"),
  });

  const attachedToolIds = new Set((links ?? []).map((l) => l.toolId));
  const availableTools = (inventory ?? []).filter((t) => !attachedToolIds.has(t.id));

  if (!isAuthor && (links?.length ?? 0) === 0) return null;

  return (
    <Card elevation={2} style={styles.card}>
      <View style={styles.header}>
        <Feather name="package" size={18} color={theme.primary} />
        <ThemedText type="h4" style={{ marginLeft: Spacing.sm, flex: 1 }}>Tools used on this case</ThemedText>
        {isAuthor ? (
          <Pressable
            onPress={() => (canUseInventory ? setPickerOpen(true) : onUpgrade())}
            style={[styles.addBtn, { borderColor: theme.cardBorder }]}
            testID="case-tools-add"
          >
            <Feather name={canUseInventory ? "plus" : "lock"} size={14} color={theme.text} />
            <ThemedText type="small" style={{ marginLeft: Spacing.xs }}>
              {canUseInventory ? "Attach" : "Garage Pro"}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {(links ?? []).length === 0 ? (
        <ThemedText type="small" style={{ color: theme.textMuted }}>
          {isAuthor
            ? "Track which of your inventory tools you used on this fix."
            : "No tools recorded yet."}
        </ThemedText>
      ) : (
        (links ?? []).map((l) => (
          <View key={l.id} style={[styles.row, { borderBottomColor: theme.cardBorder }]}>
            <View style={{ flex: 1 }}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {l.tool?.name ?? "Tool"}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {[l.tool?.brand, l.tool?.category].filter(Boolean).join(" · ")}
              </ThemedText>
            </View>
            {isAuthor ? (
              <Pressable onPress={() => detach.mutate(l.id)} testID={`case-tools-remove-${l.id}`}>
                <Feather name="x" size={16} color={theme.textMuted} />
              </Pressable>
            ) : null}
          </View>
        ))
      )}

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Pick from inventory</ThemedText>
              <Pressable onPress={() => setPickerOpen(false)} testID="case-tools-picker-close">
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {availableTools.length === 0 ? (
                <ThemedText type="small" style={{ color: theme.textMuted, padding: Spacing.md }}>
                  No more inventory tools to attach.
                </ThemedText>
              ) : (
                availableTools.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => attach.mutate(t.id)}
                    style={[styles.row, { borderBottomColor: theme.cardBorder }]}
                    testID={`case-tools-pick-${t.id}`}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>{t.name}</ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {[t.brand, t.category].filter(Boolean).join(" · ")}
                      </ThemedText>
                    </View>
                    <Feather name="plus" size={16} color={theme.primary} />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, marginBottom: Spacing.md, borderRadius: BorderRadius.xl },
  header: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md, gap: Spacing.sm },
  addBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 6, borderWidth: 1, borderRadius: BorderRadius.full },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, gap: Spacing.sm },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: { padding: Spacing.lg, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, borderTopWidth: 1, paddingBottom: Spacing.xl },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
});
