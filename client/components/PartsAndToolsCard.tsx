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
  title: string;
  reason: string;
  affiliateUrl?: string | null;
  isRequired?: boolean;
  estimatedPrice?: string | null;
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
  marketplaceListings: MarketplaceListing[];
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
        {rec.estimatedPrice ? (
          <ThemedText type="caption" style={{ color: theme.textMuted, marginTop: 2 }}>{rec.estimatedPrice}</ThemedText>
        ) : null}
      </View>
      {rec.affiliateUrl ? <Feather name="external-link" size={16} color={theme.textMuted} /> : null}
    </Comp>
  );
}

export default function PartsAndToolsCard({ caseId, onUpgrade, onBrowseMarketplace }: Props) {
  const { theme } = useTheme();
  const { hasFeature, tier } = useEntitlements();
  const fullChecklist = hasFeature("full_parts_checklist");

  const { data, isLoading } = useQuery<RecommendationResponse>({
    queryKey: [`/api/cases/${caseId}/recommendations`],
  });

  return (
    <Card elevation={2} style={styles.card}>
      <View style={styles.header}>
        <Feather name="tool" size={18} color={theme.primary} />
        <ThemedText type="h4" style={styles.headerText}>Parts & Tools</ThemedText>
      </View>

      {isLoading ? (
        <Skeleton.Box width="100%" height={120} />
      ) : !data ? (
        <ThemedText type="small" style={{ color: theme.textMuted }}>No recommendations yet.</ThemedText>
      ) : (
        <>
          {data.requiredTools.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textMuted }]}>REQUIRED TOOLS</ThemedText>
              {data.requiredTools.map((r, i) => (
                <Row key={`rt-${i}`} rec={r} onOpen={r.affiliateUrl ? () => Linking.openURL(r.affiliateUrl!) : undefined} />
              ))}
            </View>
          ) : null}

          {data.optionalTools.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textMuted }]}>OPTIONAL TOOLS</ThemedText>
              {(fullChecklist ? data.optionalTools : data.optionalTools.slice(0, 1)).map((r, i) => (
                <Row key={`ot-${i}`} rec={r} onOpen={r.affiliateUrl ? () => Linking.openURL(r.affiliateUrl!) : undefined} />
              ))}
              {!fullChecklist && data.optionalTools.length > 1 ? (
                <Pressable onPress={onUpgrade} style={[styles.lockedRow, { borderColor: theme.cardBorder }]}>
                  <Feather name="lock" size={14} color={theme.textMuted} />
                  <ThemedText type="small" style={{ color: theme.textMuted, marginLeft: Spacing.xs }}>
                    {data.optionalTools.length - 1} more in DIY Pro
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {data.likelyParts.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textMuted }]}>LIKELY PARTS</ThemedText>
              {(fullChecklist ? data.likelyParts : data.likelyParts.slice(0, 2)).map((r, i) => (
                <Row key={`p-${i}`} rec={r} onOpen={r.affiliateUrl ? () => Linking.openURL(r.affiliateUrl!) : undefined} />
              ))}
              {!fullChecklist && data.likelyParts.length > 2 ? (
                <Pressable onPress={onUpgrade} style={[styles.lockedRow, { borderColor: theme.cardBorder }]}>
                  <Feather name="lock" size={14} color={theme.textMuted} />
                  <ThemedText type="small" style={{ color: theme.textMuted, marginLeft: Spacing.xs }}>
                    Full parts checklist in DIY Pro
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

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
  header: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  headerText: { marginLeft: Spacing.sm },
  section: { marginBottom: Spacing.md },
  sectionLabel: { letterSpacing: 1, marginBottom: Spacing.xs },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, gap: Spacing.sm },
  lockedRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, marginTop: Spacing.xs },
  browseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.full, marginTop: Spacing.sm },
  disclaimer: { textAlign: "center", marginTop: Spacing.sm },
});
