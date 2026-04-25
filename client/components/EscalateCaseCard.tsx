import React, { useState } from "react";
import { View, StyleSheet, Pressable, Modal, TextInput } from "react-native";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type ServiceLevel = "quick_review" | "full_diagnostic" | "live_remote";

const TIERS: { key: ServiceLevel; name: string; price: string; eta: string; desc: string }[] = [
  { key: "quick_review", name: "Quick Review", price: "$15", eta: "~24h", desc: "Pro looks over your case and posts a written summary." },
  { key: "full_diagnostic", name: "Full Diagnostic", price: "$39", eta: "~48h", desc: "Deeper analysis with prioritized test plan and parts list." },
  { key: "live_remote", name: "Live Remote", price: "$99", eta: "Scheduled", desc: "Live video session with a verified pro for hands-on guidance." },
];

interface ExpertReview {
  id: string;
  serviceLevel: ServiceLevel;
  paymentStatus: string;
  createdAt: string;
}

interface Props {
  caseId: string;
}

export default function EscalateCaseCard({ caseId }: Props) {
  const { theme } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<ServiceLevel | null>(null);
  const [notes, setNotes] = useState("");

  const { data: existing = [] } = useQuery<ExpertReview[]>({
    queryKey: [`/api/cases/${caseId}/escalations`],
  });

  const escalateMutation = useMutation({
    mutationFn: async ({ serviceLevel, userNotes }: { serviceLevel: ServiceLevel; userNotes: string }) => {
      const res = await apiRequest("POST", `/api/cases/${caseId}/escalate`, {
        serviceLevel,
        userNotes: userNotes || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/escalations`] });
      toast.show("Expert review requested. We'll notify you when it's assigned.", "success");
      setOpen(null);
      setNotes("");
    },
    onError: (e: Error) => toast.show(e.message || "Failed to escalate", "error"),
  });

  return (
    <Card elevation={2} style={styles.card}>
      <View style={styles.header}>
        <Feather name="zap" size={18} color={theme.primary} />
        <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Need a pro to weigh in?</ThemedText>
      </View>
      <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
        Escalate to a verified mechanic. Community help stays free — these are optional paid reviews for tough cases.
      </ThemedText>

      <View style={{ gap: Spacing.sm }}>
        {TIERS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setOpen(t.key)}
            style={[styles.tierBtn, { borderColor: theme.cardBorder }]}
            testID={`escalate-${t.key}`}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.tierRow}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>{t.name}</ThemedText>
                <ThemedText type="body" style={{ color: theme.primary, fontWeight: "700" }}>{t.price}</ThemedText>
              </View>
              <ThemedText type="caption" style={{ color: theme.textMuted }}>{t.eta} · {t.desc}</ThemedText>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textMuted} />
          </Pressable>
        ))}
      </View>

      {existing.length > 0 ? (
        <View style={[styles.existing, { borderTopColor: theme.cardBorder }]}>
          <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: Spacing.xs }}>YOUR REQUESTS</ThemedText>
          {existing.map((r) => (
            <View key={r.id} style={styles.existingRow}>
              <ThemedText type="small">{TIERS.find((t) => t.key === r.serviceLevel)?.name ?? r.serviceLevel}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textMuted }}>{r.paymentStatus}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      <Modal transparent animationType="slide" visible={open !== null} onRequestClose={() => setOpen(null)}>
        <View style={styles.modalRoot}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.modalHandle} />
            <ThemedText type="h3">Confirm escalation</ThemedText>
            {open ? (
              <>
                <ThemedText type="body" style={{ color: theme.textSecondary, marginVertical: Spacing.sm }}>
                  {TIERS.find((t) => t.key === open)?.name} — {TIERS.find((t) => t.key === open)?.price}
                </ThemedText>
                <TextInput
                  multiline
                  placeholder="Optional notes for the expert (what you've already tried, time-sensitive, etc.)"
                  placeholderTextColor={theme.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                  style={[styles.notes, { color: theme.text, borderColor: theme.cardBorder }]}
                />
                <Pressable
                  onPress={() => escalateMutation.mutate({ serviceLevel: open, userNotes: notes })}
                  disabled={escalateMutation.isPending}
                  style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
                >
                  <ThemedText type="body" style={{ color: "#0D0F12", fontWeight: "700" }}>
                    {escalateMutation.isPending ? "Submitting..." : "Request expert review"}
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => setOpen(null)} style={styles.cancelBtn}>
                  <ThemedText type="body" style={{ color: theme.textMuted }}>Cancel</ThemedText>
                </Pressable>
                <ThemedText type="caption" style={{ color: theme.textMuted, textAlign: "center", marginTop: Spacing.xs }}>
                  No card is charged in this build. Live billing coming soon.
                </ThemedText>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, marginBottom: Spacing.md, borderRadius: BorderRadius.xl },
  header: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs },
  tierBtn: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.lg, gap: Spacing.sm },
  tierRow: { flexDirection: "row", justifyContent: "space-between" },
  existing: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  existingRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: Spacing.xs },
  modalRoot: { flex: 1, backgroundColor: "#000A", justifyContent: "flex-end" },
  modalSheet: { padding: Spacing.lg, borderTopLeftRadius: BorderRadius["2xl"], borderTopRightRadius: BorderRadius["2xl"], paddingBottom: Spacing["2xl"] },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#888", alignSelf: "center", marginBottom: Spacing.md },
  notes: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, minHeight: 90, textAlignVertical: "top" },
  confirmBtn: { paddingVertical: Spacing.md, borderRadius: BorderRadius.full, alignItems: "center", marginTop: Spacing.md },
  cancelBtn: { paddingVertical: Spacing.sm, alignItems: "center", marginTop: Spacing.xs },
});
