import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useMutation } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useEntitlements } from "@/lib/entitlements";
import { apiRequest } from "@/lib/query-client";

interface Plan {
  generatedAt: string;
  case: { title: string };
  symptoms: string[];
  obdCodes: string[];
  probableCauses: string[];
  diagnosticSteps: string[];
  toolsNeeded: { title: string; reason: string }[];
  partsList: { title: string; reason: string }[];
  safetyWarnings: string[];
  difficulty: string;
  estimatedCostRange: string;
  finalNotes: string;
  tier: string;
  exportType: string;
}

interface Props {
  caseId: string;
  onUpgrade: () => void;
}

export default function RepairPlanCard({ caseId, onUpgrade }: Props) {
  const { theme } = useTheme();
  const toast = useToast();
  const { hasFeature } = useEntitlements();
  const canExportPdf = hasFeature("pdf_repair_plan");
  const [plan, setPlan] = useState<Plan | null>(null);

  const generateMutation = useMutation({
    mutationFn: async (exportType: "preview" | "pdf") => {
      const res = await apiRequest("POST", `/api/cases/${caseId}/repair-plan`, { exportType });
      return res.json();
    },
    onSuccess: async (data: Plan) => {
      setPlan(data);
      if (data.exportType === "pdf") {
        await Clipboard.setStringAsync(JSON.stringify(data, null, 2));
        toast.show("PDF export copied to clipboard (JSON)", "success");
      } else {
        toast.show("Repair plan generated", "success");
      }
    },
    onError: (e: Error) => toast.show(e.message || "Failed to generate plan", "error"),
  });

  return (
    <Card elevation={2} style={styles.card}>
      <View style={styles.header}>
        <Feather name="file-text" size={18} color={theme.primary} />
        <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Repair Plan</ThemedText>
      </View>
      <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
        Generate a structured plan: probable causes, diagnostic steps, parts list, and safety notes.
      </ThemedText>

      <View style={styles.btnRow}>
        <Pressable
          onPress={() => generateMutation.mutate("preview")}
          disabled={generateMutation.isPending}
          style={[styles.btn, { backgroundColor: theme.backgroundTertiary, borderColor: theme.cardBorder }]}
          testID="repair-plan-preview"
        >
          <Feather name="eye" size={14} color={theme.text} />
          <ThemedText type="small" style={{ marginLeft: Spacing.xs }}>Preview plan</ThemedText>
        </Pressable>

        {canExportPdf ? (
          <Pressable
            onPress={() => generateMutation.mutate("pdf")}
            disabled={generateMutation.isPending}
            style={[styles.btn, { backgroundColor: theme.primary }]}
            testID="repair-plan-pdf"
          >
            <Feather name="download" size={14} color="#0D0F12" />
            <ThemedText type="small" style={{ marginLeft: Spacing.xs, color: "#0D0F12", fontWeight: "700" }}>Export PDF</ThemedText>
          </Pressable>
        ) : (
          <Pressable onPress={onUpgrade} style={[styles.btn, { borderColor: theme.cardBorder, borderWidth: 1 }]}>
            <Feather name="lock" size={14} color={theme.textMuted} />
            <ThemedText type="small" style={{ marginLeft: Spacing.xs, color: theme.textMuted }}>PDF in DIY Pro</ThemedText>
          </Pressable>
        )}
      </View>

      {plan ? (
        <ScrollView style={[styles.preview, { backgroundColor: theme.backgroundTertiary, borderColor: theme.cardBorder }]} nestedScrollEnabled>
          <ThemedText type="caption" style={{ color: theme.textMuted }}>DIFFICULTY · {plan.difficulty.toUpperCase()}</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, marginVertical: Spacing.xs }}>{plan.estimatedCostRange}</ThemedText>

          {plan.probableCauses.length > 0 ? (
            <>
              <ThemedText type="caption" style={[styles.section, { color: theme.textMuted }]}>PROBABLE CAUSES</ThemedText>
              {plan.probableCauses.map((c, i) => (<ThemedText key={i} type="small">• {c}</ThemedText>))}
            </>
          ) : null}

          <ThemedText type="caption" style={[styles.section, { color: theme.textMuted }]}>DIAGNOSTIC STEPS</ThemedText>
          {plan.diagnosticSteps.map((s, i) => (<ThemedText key={i} type="small">{i + 1}. {s}</ThemedText>))}

          {plan.partsList.length > 0 ? (
            <>
              <ThemedText type="caption" style={[styles.section, { color: theme.textMuted }]}>PARTS</ThemedText>
              {plan.partsList.map((p, i) => (<ThemedText key={i} type="small">• {p.title} — {p.reason}</ThemedText>))}
            </>
          ) : null}

          <ThemedText type="caption" style={[styles.section, { color: theme.textMuted }]}>SAFETY</ThemedText>
          {plan.safetyWarnings.map((w, i) => (<ThemedText key={i} type="small">⚠ {w}</ThemedText>))}

          <ThemedText type="caption" style={{ color: theme.textMuted, marginTop: Spacing.md, fontStyle: "italic" }}>{plan.finalNotes}</ThemedText>
        </ScrollView>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, marginBottom: Spacing.md, borderRadius: BorderRadius.xl },
  header: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs },
  btnRow: { flexDirection: "row", gap: Spacing.sm },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  preview: { maxHeight: 280, marginTop: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
  section: { letterSpacing: 1, marginTop: Spacing.sm, marginBottom: Spacing.xxs },
});
