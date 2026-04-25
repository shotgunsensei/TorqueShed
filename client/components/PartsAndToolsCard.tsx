import React from "react";
import { View, StyleSheet, Pressable, Linking } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useEntitlements } from "@/lib/entitlements";

interface Recommendation {
  type: "tool" | "part" | "consumable";
  category: "required_tool" | "optional_tool" | "likely_part" | "consumable" | "safety_equipment";
  title: string;
  reason: string;
  affiliateUrl?: string | null;
  estimatedPrice?: string | null;
  fitmentNote?: string | null;
}

interface MarketplaceListing {
  id: string;
  title: string;
  price: string | null;
  category: string;
}

interface RecommendationResponse {
  requiredTools: Recommendation[];
  optionalTools: Recommendation[];
  likelyParts: Recommendation[];
  consumables: Recommendation[];
  safetyEquipment: Recommendation[];
  marketplaceListings: MarketplaceListing[];
  totalCostRange: { min: number; max: number; label: string };
  affiliateNote: string;
}

interface Props {
  caseId: string;
  onUpgrade: () => void;
  onBrowseMarketplace: () => void;
}

function Row({ rec, onOpen }: { rec: Recommendation; onOpen?: () => void }) {
  const { theme } = useTheme();
  const Comp: any = onOpen ? Pressable : View;
  return (
    <Comp onPress={onOpen} style={[styles.row, { borderBottomColor: theme.cardBorder }]}>
      <View style={{ flex: 1 }}>
        <ThemedText type="body" style={{ fontWeight: "600" }}>{rec.title}</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>{rec.reason}</ThemedText>
        {rec.fitmentNote ? (
          <ThemedText type="caption" style={{ color: theme.textMuted, marginTop: 2, fontStyle: "italic" }}>
            {rec.fitmentNote}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        {rec.estimatedPrice ? (
          <ThemedText type="caption" style={{ color: theme.text, fontWeight: "600" }}>
            {rec.estimatedPrice}
          </ThemedText>
        ) : null}
        {rec.affiliateUrl ? <Feather name="external-link" size={14} color={theme.textMuted} style={{ marginTop: 2 }} /> : null}
      </View>
    </Comp>
  );
}

function Section({
  label,
  recs,
  fullChecklist,
  freeLimit,
  onUpgrade,
  testID,
}: {
  label: string;
  recs: Recommendation[];
  fullChecklist: boolean;
  freeLimit: number;
  onUpgrade: () => void;
  testID?: string;
}) {
  const { theme } = useTheme();
  if (recs.length === 0) return null;
  const visible = fullChecklist ? recs : recs.slice(0, freeLimit);
  const hidden = recs.length - visible.length;
  return (
    <View style={styles.section} testID={testID}>
      <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textMuted }]}>{label}</ThemedText>
      {visible.map((r, i) => (
        <Row key={`${label}-${i}`} rec={r} onOpen={r.affiliateUrl ? () => Linking.openURL(r.affiliateUrl!) : undefined} />
      ))}
      {hidden > 0 ? (
        <Pressable onPress={onUpgrade} style={[styles.lockedRow, { borderColor: theme.cardBorder }]}>
          <Feather name="lock" size={14} color={theme.textMuted} />
          <ThemedText type="small" style={{ color: theme.textMuted, marginLeft: Spacing.xs }}>
            {hidden} more in DIY Pro
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function PartsAndToolsCard({ caseId, onUpgrade, onBrowseMarketplace }: Props) {
  const { theme } = useTheme();
  const { hasFeature } = useEntitlements();
  const fullChecklist = hasFeature("full_parts_checklist");

  const { data, isLoading } = useQuery<RecommendationResponse>({
    queryKey: [`/api/cases/${caseId}/recommendations`],
  });

  return (
    <Card elevation={2} style={styles.card}>
      <View style={styles.header}>
        <Feather name="tool" size={18} color={theme.primary} />
        <ThemedText type="h4" style={styles.headerText}>Parts & Tools</ThemedText>
        {data?.totalCostRange ? (
          <View style={[styles.totalPill, { backgroundColor: theme.primary + "20" }]}>
            <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "700" }}>
              Est. {data.totalCostRange.label}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <Skeleton.Box width="100%" height={160} />
      ) : !data ? (
        <ThemedText type="small" style={{ color: theme.textMuted }}>No recommendations yet.</ThemedText>
      ) : (
        <>
          <Section label="REQUIRED TOOLS" recs={data.requiredTools} fullChecklist={true} freeLimit={data.requiredTools.length} onUpgrade={onUpgrade} testID="section-required-tools" />
          <Section label="OPTIONAL TOOLS" recs={data.optionalTools} fullChecklist={fullChecklist} freeLimit={1} onUpgrade={onUpgrade} testID="section-optional-tools" />
          <Section label="LIKELY PARTS" recs={data.likelyParts} fullChecklist={fullChecklist} freeLimit={2} onUpgrade={onUpgrade} testID="section-likely-parts" />
          <Section label="CONSUMABLES" recs={data.consumables} fullChecklist={fullChecklist} freeLimit={1} onUpgrade={onUpgrade} testID="section-consumables" />
          <Section label="SAFETY EQUIPMENT" recs={data.safetyEquipment} fullChecklist={true} freeLimit={data.safetyEquipment.length} onUpgrade={onUpgrade} testID="section-safety" />

          {data.marketplaceListings.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textMuted }]}>FROM THE COMMUNITY</ThemedText>
              {data.marketplaceListings.map((l) => (
                <View key={l.id} style={[styles.row, { borderBottomColor: theme.cardBorder }]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>{l.title}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>{l.category}</ThemedText>
                  </View>
                  {l.price ? <ThemedText type="body" style={{ color: theme.primary }}>${l.price}</ThemedText> : null}
                </View>
              ))}
            </View>
          ) : null}

          <Pressable onPress={onBrowseMarketplace} style={[styles.browseBtn, { borderColor: theme.cardBorder }]}>
            <Feather name="shopping-bag" size={14} color={theme.text} />
            <ThemedText type="small" style={{ marginLeft: Spacing.xs }}>Browse Swap Shop for matching parts</ThemedText>
          </Pressable>

          <ThemedText type="caption" style={[styles.disclaimer, { color: theme.textMuted }]}>{data.affiliateNote}</ThemedText>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, marginBottom: Spacing.md, borderRadius: BorderRadius.xl },
  header: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md, gap: Spacing.sm, flexWrap: "wrap" },
  headerText: { marginLeft: Spacing.sm, flex: 1 },
  totalPill: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  section: { marginBottom: Spacing.md },
  sectionLabel: { letterSpacing: 1, marginBottom: Spacing.xs },
  row: { flexDirection: "row", alignItems: "flex-start", paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, gap: Spacing.sm },
  rowRight: { alignItems: "flex-end", marginLeft: Spacing.sm },
  lockedRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, marginTop: Spacing.xs, borderStyle: "dashed" },
  browseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.full, marginTop: Spacing.sm },
  disclaimer: { textAlign: "center", marginTop: Spacing.sm },
});
