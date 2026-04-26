import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { Card } from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import { LockedFeature } from "@/components/LockedFeature";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

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

interface PreviewInput {
  vehicleId?: string | null;
  vehicleName?: string | null;
  obdCodes?: string[];
  symptoms?: string[];
  systemCategory?: string | null;
}

type Props =
  | {
      caseId: string;
      onUpgrade: () => void;
      preview?: undefined;
    }
  | {
      caseId?: undefined;
      preview: PreviewInput;
      onUpgrade: () => void;
    };

export function SimilarCasesCard(props: Props) {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { onUpgrade } = props;

  const previewKey = useMemo(() => {
    if (!("preview" in props) || !props.preview) return null;
    const p = props.preview;
    return JSON.stringify({
      vehicleId: p.vehicleId ?? null,
      vehicleName: p.vehicleName ?? null,
      obdCodes: [...(p.obdCodes ?? [])].map((c) => c.toUpperCase()).sort(),
      symptoms: [...(p.symptoms ?? [])].sort(),
      systemCategory: p.systemCategory ?? null,
    });
  }, [props]);

  const hasPreviewSignal = useMemo(() => {
    if (!("preview" in props) || !props.preview) return false;
    const p = props.preview;
    return Boolean(
      (p.vehicleId && p.vehicleId.length > 0) ||
        (p.vehicleName && p.vehicleName.length > 0) ||
        (p.obdCodes && p.obdCodes.length > 0) ||
        (p.symptoms && p.symptoms.length > 0) ||
        (p.systemCategory && p.systemCategory.length > 0),
    );
  }, [props]);

  const isPreviewMode = "preview" in props && Boolean(props.preview);
  const caseId = "caseId" in props ? props.caseId : undefined;

  const queryKey = isPreviewMode
    ? ["/api/cases/similar", previewKey]
    : [`/api/cases/${caseId}/similar`];

  const { data, isLoading, isError } = useQuery<SimilarResponse>({
    queryKey,
    enabled: isPreviewMode ? hasPreviewSignal : Boolean(caseId),
    queryFn: async () => {
      if (isPreviewMode) {
        const params = new URLSearchParams();
        const p = (props as { preview: PreviewInput }).preview;
        if (p.vehicleId) params.set("vehicleId", p.vehicleId);
        if (p.vehicleName) params.set("vehicleName", p.vehicleName);
        if (p.systemCategory) params.set("systemCategory", p.systemCategory);
        if (p.obdCodes && p.obdCodes.length > 0) params.set("obdCodes", p.obdCodes.join(","));
        if (p.symptoms && p.symptoms.length > 0) params.set("symptoms", p.symptoms.join(","));
        const res = await apiRequest("GET", `/api/cases/similar?${params.toString()}`);
        return (await res.json()) as SimilarResponse;
      }
      const res = await apiRequest("GET", `/api/cases/${caseId}/similar`);
      return (await res.json()) as SimilarResponse;
    },
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
          onPress={() => navigation.push("ThreadDetail", { threadId: c.id })}
          style={[styles.row, { borderColor: theme.cardBorder }]}
          testID={`similar-case-${c.id}`}
        >
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <ThemedText type="body" style={{ fontWeight: "600", flex: 1 }} numberOfLines={2}>
                {c.title}
              </ThemedText>
              <View style={[styles.scorePill, { backgroundColor: theme.primary + "15", borderColor: theme.primary + "40" }]}>
                <Feather name="bar-chart-2" size={10} color={theme.primary} />
                <ThemedText
                  type="caption"
                  style={{ color: theme.primary, fontWeight: "700", marginLeft: 4 }}
                  testID={`similar-case-score-${c.id}`}
                >
                  {Math.min(100, Math.round(c.score))}% match
                </ThemedText>
              </View>
            </View>
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
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});

export default SimilarCasesCard;
