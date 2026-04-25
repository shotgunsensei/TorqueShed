import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { Card } from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import { LockedFeature } from "@/components/LockedFeature";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SimilarCase {
  id: string;
  title: string;
  vehicleName: string | null;
  systemCategory: string | null;
  obdCodes: string[];
  score: number;
  matchReasons: string[];
}

interface SimilarResponse {
  cases: SimilarCase[];
  hiddenCount: number;
  totalAvailable: number;
  hasFeature: boolean;
}

interface Props {
  caseId: string;
  onUpgrade: () => void;
}

export function SimilarCasesCard({ caseId, onUpgrade }: Props) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

  const { data, isLoading, isError } = useQuery<SimilarResponse>({
    queryKey: [`/api/cases/${caseId}/similar`],
  });

  if (isLoading) {
    return (
      <Card style={styles.card}>
        <ThemedText type="caption" style={{ color: theme.textMuted }}>Searching solved cases…</ThemedText>
      </Card>
    );
  }
  if (isError || !data) return null;

  if (data.totalAvailable === 0) {
    return (
      <Card style={styles.card} testID="similar-cases-empty">
        <View style={styles.headerRow}>
          <Feather name="layers" size={16} color={theme.primary} />
          <ThemedText type="h4" style={styles.headerTitle}>Similar Solved Cases</ThemedText>
        </View>
        <ThemedText type="caption" style={{ color: theme.textMuted, marginTop: Spacing.xs }}>
          No matching solved cases yet. Once others share fixes for similar symptoms or DTCs, they'll show up here.
        </ThemedText>
      </Card>
    );
  }

  return (
    <Card style={styles.card} testID="similar-cases-card">
      <View style={styles.headerRow}>
        <Feather name="layers" size={16} color={theme.primary} />
        <ThemedText type="h4" style={styles.headerTitle}>Similar Solved Cases</ThemedText>
      </View>
      <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: Spacing.sm }}>
        {data.hasFeature
          ? `Top ${data.cases.length} matches by DTC and vehicle.`
          : "Preview of one similar case — upgrade to see all matches."}
      </ThemedText>

      {data.cases.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => navigation.push("ThreadDetail", { threadId: c.id, garageId: "" })}
          style={[styles.row, { borderColor: theme.cardBorder }]}
          testID={`similar-case-${c.id}`}
        >
          <View style={{ flex: 1 }}>
            <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={2}>
              {c.title}
            </ThemedText>
            <View style={styles.metaRow}>
              {c.vehicleName ? (
                <View style={styles.metaChip}>
                  <Feather name="truck" size={10} color={theme.textMuted} />
                  <ThemedText type="caption" style={{ color: theme.textMuted, marginLeft: 4 }}>
                    {c.vehicleName}
                  </ThemedText>
                </View>
              ) : null}
              {c.obdCodes.slice(0, 3).map((code) => (
                <View key={code} style={[styles.metaChip, { backgroundColor: theme.primary + "15" }]}>
                  <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "600" }}>
                    {code}
                  </ThemedText>
                </View>
              ))}
            </View>
            {c.matchReasons.length > 0 ? (
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>
                {c.matchReasons.slice(0, 2).join(" · ")}
              </ThemedText>
            ) : null}
          </View>
          <Feather name="chevron-right" size={18} color={theme.textMuted} />
        </Pressable>
      ))}

      {!data.hasFeature && data.hiddenCount > 0 ? (
        <View style={{ marginTop: Spacing.sm }}>
          <LockedFeature
            feature="similar_solved_matching"
            title={`${data.hiddenCount} more similar case${data.hiddenCount > 1 ? "s" : ""} available`}
            description="Get the full ranked list with DTC overlap and symptom matches across the community."
            onUpgrade={onUpgrade}
            compact
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
});

export default SimilarCasesCard;
