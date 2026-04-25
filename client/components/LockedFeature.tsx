import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useEntitlements, type Feature } from "@/lib/entitlements";

interface Props {
  feature: Feature;
  title: string;
  description: string;
  ctaLabel?: string;
  onUpgrade: () => void;
  compact?: boolean;
  testID?: string;
}

const TIER_FOR_FEATURE: Record<Feature, "DIY Pro" | "Garage Pro" | "Shop Pro"> = {
  advanced_diagnostic_tree: "DIY Pro",
  unlimited_saved_cases: "DIY Pro",
  pdf_repair_plan: "DIY Pro",
  full_parts_checklist: "DIY Pro",
  similar_solved_matching: "DIY Pro",
  priority_ai_followup: "DIY Pro",
  multi_vehicle: "Garage Pro",
  maintenance_tracking: "Garage Pro",
  advanced_repair_history: "Garage Pro",
  cost_tracking: "Garage Pro",
  build_logs: "Garage Pro",
  tool_inventory: "Garage Pro",
  advanced_listing_options: "Garage Pro",
  shop_profile: "Shop Pro",
  service_listings: "Shop Pro",
  lead_capture: "Shop Pro",
  team_access: "Shop Pro",
  credibility_profile: "Shop Pro",
  case_intake_workflow: "Shop Pro",
  customer_diagnostic_summaries: "Shop Pro",
};

export function LockedFeature({
  feature,
  title,
  description,
  ctaLabel,
  onUpgrade,
  compact,
  testID,
}: Props) {
  const { theme } = useTheme();
  const { hasFeature } = useEntitlements();

  if (hasFeature(feature)) return null;

  const requiredTier = TIER_FOR_FEATURE[feature];
  const finalCta = ctaLabel ?? `Upgrade to ${requiredTier}`;

  return (
    <View
      style={[
        styles.card,
        compact ? styles.compact : null,
        { borderColor: theme.cardBorder, backgroundColor: theme.backgroundDefault },
      ]}
      testID={testID ?? `locked-feature-${feature}`}
    >
      <View style={[styles.iconCircle, { backgroundColor: theme.primary + "20" }]}>
        <Feather name="lock" size={compact ? 14 : 18} color={theme.primary} />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <ThemedText type={compact ? "body" : "h4"} style={{ fontWeight: "700" }}>
            {title}
          </ThemedText>
          <View style={[styles.tierPill, { backgroundColor: theme.primary + "20" }]}>
            <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "700" }}>
              {requiredTier}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
          {description}
        </ThemedText>
        <Pressable
          onPress={onUpgrade}
          style={[styles.cta, { backgroundColor: theme.primary }]}
          testID={`button-upgrade-${feature}`}
        >
          <Feather name="zap" size={14} color="#0D0F12" />
          <ThemedText type="small" style={styles.ctaText}>
            {finalCta}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: Spacing.md,
  },
  compact: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  tierPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  ctaText: {
    color: "#0D0F12",
    fontWeight: "700",
  },
});

export default LockedFeature;
