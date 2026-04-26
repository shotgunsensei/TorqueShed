import React, { useState } from "react";
import { View, StyleSheet, Pressable, Alert, Modal } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { LockedFeature } from "@/components/LockedFeature";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { useEntitlements } from "@/lib/entitlements";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface CustomerSummary {
  id: string;
  shareToken: string;
  customerConcern: string;
  diagnosticFindings: string;
  recommendedRepairs: string;
  urgencyLevel: "low" | "medium" | "high";
  estimateNotes: string | null;
  nextSteps: string | null;
  isRevoked: boolean;
  updatedAt: string;
}

const URGENCY_OPTIONS: { value: "low" | "medium" | "high"; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

interface Props {
  caseId: string;
  isAuthor: boolean;
  onUpgrade: () => void;
}

export default function CustomerSummaryCard({ caseId, isAuthor, onUpgrade }: Props) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasFeature } = useEntitlements();
  const canUse = hasFeature("customer_diagnostic_summaries");

  const { data, isLoading } = useQuery<{ summary: CustomerSummary | null }>({
    queryKey: [`/api/cases/${caseId}/customer-summary`],
    enabled: isAuthor && canUse,
  });

  const summary = data?.summary ?? null;

  const [showForm, setShowForm] = useState(false);
  const [customerConcern, setCustomerConcern] = useState("");
  const [diagnosticFindings, setDiagnosticFindings] = useState("");
  const [recommendedRepairs, setRecommendedRepairs] = useState("");
  const [urgencyLevel, setUrgencyLevel] = useState<"low" | "medium" | "high">("medium");
  const [estimateNotes, setEstimateNotes] = useState("");
  const [nextSteps, setNextSteps] = useState("");

  if (!isAuthor) return null;

  if (!canUse) {
    return (
      <View style={{ marginBottom: Spacing.md }}>
        <LockedFeature
          feature="customer_diagnostic_summaries"
          title="Customer diagnostic summaries"
          description="Generate a clean, shareable summary for the customer with findings, recommended repairs, and a public link."
          onUpgrade={onUpgrade}
        />
      </View>
    );
  }

  const openForm = () => {
    setCustomerConcern(summary?.customerConcern ?? "");
    setDiagnosticFindings(summary?.diagnosticFindings ?? "");
    setRecommendedRepairs(summary?.recommendedRepairs ?? "");
    const u = summary?.urgencyLevel;
    setUrgencyLevel(u === "low" || u === "medium" || u === "high" ? u : "medium");
    setEstimateNotes(summary?.estimateNotes ?? "");
    setNextSteps(summary?.nextSteps ?? "");
    setShowForm(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        customerConcern: customerConcern.trim(),
        diagnosticFindings: diagnosticFindings.trim(),
        recommendedRepairs: recommendedRepairs.trim(),
        urgencyLevel,
        estimateNotes: estimateNotes.trim() || null,
        nextSteps: nextSteps.trim() || null,
      };
      if (!payload.customerConcern || !payload.diagnosticFindings || !payload.recommendedRepairs) {
        throw new Error("Concern, findings and recommended repairs are required");
      }
      const res = await apiRequest("POST", `/api/cases/${caseId}/customer-summary`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/customer-summary`] });
      toast.show(summary ? "Summary updated" : "Summary published", "success");
      setShowForm(false);
    },
    onError: (err: Error) => toast.show(err.message || "Failed to save", "error"),
  });

  const revoke = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/cases/${caseId}/customer-summary`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/customer-summary`] });
      toast.show("Public link disabled", "success");
    },
    onError: (err: Error) => toast.show(err.message || "Failed to revoke", "error"),
  });

  const rotate = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/cases/${caseId}/customer-summary/rotate`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/customer-summary`] });
      toast.show("Link rotated", "success");
    },
    onError: (err: Error) => toast.show(err.message || "Failed to rotate", "error"),
  });

  const publicUrl = summary && !summary.isRevoked
    ? new URL(`/public/diagnostic-summary/${summary.shareToken}`, getApiUrl()).toString()
    : "";

  const onCopy = async () => {
    if (!publicUrl) return;
    await Clipboard.setStringAsync(publicUrl);
    toast.show("Link copied", "success");
  };

  const confirmRevoke = () => {
    Alert.alert("Disable public link?", "The current link will stop working. You can publish a new summary later.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disable", style: "destructive", onPress: () => revoke.mutate() },
    ]);
  };

  return (
    <Card elevation={2} style={{ ...styles.card, borderColor: theme.cardBorder }}>
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: theme.primary + "20" }]}>
          <Feather name="file-text" size={18} color={theme.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
          <ThemedText type="h4">Customer summary</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
            Share a clean, public-friendly version with the vehicle owner.
          </ThemedText>
        </View>
      </View>

      {isLoading ? null : summary && !summary.isRevoked ? (
        <>
          <View style={[styles.urgencyRow]}>
            <View style={[styles.urgencyChip, urgencyStyle(summary.urgencyLevel, theme)]}>
              <ThemedText type="caption" style={{ color: urgencyTextColor(summary.urgencyLevel, theme), fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
                {summary.urgencyLevel} urgency
              </ThemedText>
            </View>
            <ThemedText type="caption" style={{ color: theme.textMuted }}>
              Updated {new Date(summary.updatedAt).toLocaleDateString()}
            </ThemedText>
          </View>
          <Pressable onPress={onCopy} style={[styles.linkRow, { borderColor: theme.cardBorder }]} testID="button-copy-summary-link">
            <Feather name="link" size={14} color={theme.primary} />
            <ThemedText type="small" numberOfLines={1} style={{ marginLeft: 6, color: theme.primary, flex: 1 }}>{publicUrl}</ThemedText>
            <Feather name="copy" size={14} color={theme.textMuted} />
          </Pressable>
          <View style={styles.actions}>
            <Pressable onPress={openForm} style={[styles.action, { borderColor: theme.cardBorder }]} testID="button-edit-summary">
              <Feather name="edit-2" size={14} color={theme.text} />
              <ThemedText type="small" style={{ marginLeft: 6 }}>Edit</ThemedText>
            </Pressable>
            <Pressable onPress={() => rotate.mutate()} style={[styles.action, { borderColor: theme.cardBorder }]} testID="button-rotate-summary">
              <Feather name="refresh-cw" size={14} color={theme.text} />
              <ThemedText type="small" style={{ marginLeft: 6 }}>Rotate link</ThemedText>
            </Pressable>
            <Pressable onPress={confirmRevoke} style={[styles.action, { borderColor: theme.cardBorder }]} testID="button-revoke-summary">
              <Feather name="x" size={14} color={theme.error} />
              <ThemedText type="small" style={{ marginLeft: 6, color: theme.error }}>Disable</ThemedText>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={{ marginTop: Spacing.md }}>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            {summary?.isRevoked ? "The previous public link is disabled. Publish a new summary to share again." : "No summary yet."}
          </ThemedText>
          <Button onPress={openForm} testID="button-create-summary">
            {summary ? "Publish new summary" : "Create summary"}
          </Button>
        </View>
      )}

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
          <View style={[styles.modalHeader, { borderColor: theme.cardBorder }]}>
            <Pressable onPress={() => setShowForm(false)} testID="button-cancel-summary"><ThemedText type="body" style={{ color: theme.textMuted }}>Cancel</ThemedText></Pressable>
            <ThemedText type="h4">Customer summary</ThemedText>
            <Pressable onPress={() => save.mutate()} disabled={save.isPending} testID="button-save-summary">
              <ThemedText type="body" style={{ color: theme.primary, fontWeight: "700" }}>{save.isPending ? "Saving…" : "Save"}</ThemedText>
            </Pressable>
          </View>
          <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: Spacing.lg }}>
            <Field label="Customer concern">
              <Input value={customerConcern} onChangeText={setCustomerConcern} placeholder="What the customer reported" multiline numberOfLines={3} style={{ minHeight: 70 }} testID="input-customer-concern" />
            </Field>
            <Field label="Diagnostic findings">
              <Input value={diagnosticFindings} onChangeText={setDiagnosticFindings} placeholder="What you found, plain language" multiline numberOfLines={4} style={{ minHeight: 90 }} testID="input-findings" />
            </Field>
            <Field label="Recommended repairs">
              <Input value={recommendedRepairs} onChangeText={setRecommendedRepairs} placeholder="What you recommend doing and why" multiline numberOfLines={4} style={{ minHeight: 90 }} testID="input-recommended-repairs" />
            </Field>
            <Field label="Urgency">
              <View style={styles.urgencyPicker}>
                {URGENCY_OPTIONS.map((u) => {
                  const active = urgencyLevel === u.value;
                  return (
                    <Pressable
                      key={u.value}
                      onPress={() => setUrgencyLevel(u.value)}
                      style={[styles.urgencyOpt, { borderColor: active ? theme.primary : theme.cardBorder, backgroundColor: active ? theme.primary + "20" : theme.backgroundSecondary }]}
                      testID={`chip-urgency-${u.value}`}
                    >
                      <ThemedText type="caption" style={{ color: active ? theme.primary : theme.textSecondary, fontWeight: active ? "700" : "500" }}>{u.label}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </Field>
            <Field label="Estimate notes (optional)">
              <Input value={estimateNotes} onChangeText={setEstimateNotes} placeholder="Pricing, parts pricing, labor estimate" multiline numberOfLines={3} style={{ minHeight: 70 }} testID="input-estimate-notes" />
            </Field>
            <Field label="Next steps (optional)">
              <Input value={nextSteps} onChangeText={setNextSteps} placeholder="Schedule appointment, approve quote, etc." multiline numberOfLines={3} style={{ minHeight: 70 }} testID="input-next-steps" />
            </Field>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{label}</ThemedText>
      {children}
    </View>
  );
}

function urgencyStyle(level: string, theme: any) {
  if (level === "high") return { backgroundColor: theme.error + "20", borderColor: theme.error };
  if (level === "low") return { backgroundColor: theme.success + "20", borderColor: theme.success };
  return { backgroundColor: theme.warning + "20", borderColor: theme.warning };
}

function urgencyTextColor(level: string, theme: any) {
  if (level === "high") return theme.error;
  if (level === "low") return theme.success;
  return theme.warning;
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, marginBottom: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1 },
  header: { flexDirection: "row", alignItems: "flex-start" },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  urgencyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: Spacing.md },
  urgencyChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  linkRow: { flexDirection: "row", alignItems: "center", marginTop: Spacing.md, padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1 },
  actions: { flexDirection: "row", flexWrap: "wrap", marginTop: Spacing.md, gap: Spacing.sm },
  action: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.lg, borderBottomWidth: 1 },
  urgencyPicker: { flexDirection: "row", gap: 6 },
  urgencyOpt: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
});
