import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { VehicleNote, NoteType } from "@/constants/vehicles";

interface NoteCardProps {
  note: VehicleNote;
  onPress: () => void;
  onDiagnose?: () => void;
  onAskForHelp?: () => void;
}

const TYPE_CONFIG: Record<NoteType, { icon: string; label: string; color: string }> = {
  maintenance: { icon: "settings", label: "Maintenance", color: "#3B82F6" },
  mod: { icon: "zap", label: "Mod", color: "#8B5CF6" },
  issue: { icon: "alert-triangle", label: "Issue", color: "#EF4444" },
  general: { icon: "file-text", label: "General", color: "#6B7280" },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function NoteCard({ note, onPress, onDiagnose, onAskForHelp }: NoteCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const typeConfig = TYPE_CONFIG[note.type] || TYPE_CONFIG.general;
  const hasBefore = note.type === "mod" && note.beforeState;
  const hasAfter = note.type === "mod" && note.afterState;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: theme.cardBorder,
        },
        animatedStyle,
      ]}
      testID={`note-card-${note.id}`}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.typeBadge, { backgroundColor: typeConfig.color + "20" }]}>
            <Feather name={typeConfig.icon as any} size={12} color={typeConfig.color} />
          </View>
          <ThemedText type="h4" style={styles.title} numberOfLines={1}>
            {note.title}
          </ThemedText>
        </View>
        {note.isPrivate ? (
          <Feather name="lock" size={14} color={theme.textSecondary} />
        ) : (
          <Feather name="globe" size={14} color={theme.textSecondary} />
        )}
      </View>

      <ThemedText
        type="small"
        numberOfLines={2}
        style={[styles.content, { color: theme.textSecondary }]}
      >
        {note.content}
      </ThemedText>

      {(hasBefore || hasAfter) ? (
        <View style={[styles.beforeAfter, { borderColor: theme.border }]}>
          {hasBefore ? (
            <View style={styles.beforeAfterItem}>
              <View style={[styles.beforeAfterLabel, { backgroundColor: "#EF444420" }]}>
                <Text style={[styles.beforeAfterLabelText, { color: "#EF4444" }]}>Before</Text>
              </View>
              <Text style={[styles.beforeAfterText, { color: theme.textSecondary }]} numberOfLines={1}>
                {note.beforeState}
              </Text>
            </View>
          ) : null}
          {hasAfter ? (
            <View style={styles.beforeAfterItem}>
              <View style={[styles.beforeAfterLabel, { backgroundColor: "#22C55E20" }]}>
                <Text style={[styles.beforeAfterLabelText, { color: "#22C55E" }]}>After</Text>
              </View>
              <Text style={[styles.beforeAfterText, { color: theme.textSecondary }]} numberOfLines={1}>
                {note.afterState}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {note.type === "issue" ? (
        <View style={styles.issueActions}>
          {onDiagnose ? (
            <Pressable
              onPress={onDiagnose}
              style={[styles.diagnoseLink, { backgroundColor: "#FF6B3515" }]}
              testID={`diagnose-${note.id}`}
            >
              <Feather name="cpu" size={14} color="#FF6B35" />
              <Text style={styles.diagnoseLinkText}>Diagnose</Text>
            </Pressable>
          ) : null}
          {onAskForHelp ? (
            <Pressable
              onPress={onAskForHelp}
              style={[styles.diagnoseLink, { backgroundColor: "#3B82F615" }]}
              testID={`ask-help-${note.id}`}
            >
              <Feather name="help-circle" size={14} color="#3B82F6" />
              <Text style={[styles.diagnoseLinkText, { color: "#3B82F6" }]}>Ask for Help</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <View style={styles.metaRow}>
          <Text style={[styles.typeLabelText, { color: typeConfig.color }]}>
            {typeConfig.label}
          </Text>
          <Text style={[styles.dateText, { color: theme.textMuted }]}>
            {formatDate(note.createdAt)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          {note.cost ? (
            <View style={styles.metaItem}>
              <Feather name="dollar-sign" size={12} color={theme.textMuted} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {note.cost}
              </Text>
            </View>
          ) : null}
          {note.mileage ? (
            <View style={styles.metaItem}>
              <Feather name="navigation" size={12} color={theme.textMuted} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {note.mileage.toLocaleString()} mi
              </Text>
            </View>
          ) : null}
          {note.partsUsed && note.partsUsed.length > 0 ? (
            <View style={styles.metaItem}>
              <Feather name="package" size={12} color={theme.textMuted} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {note.partsUsed.length} part{note.partsUsed.length !== 1 ? "s" : ""}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  typeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  content: {
    marginBottom: Spacing.sm,
  },
  beforeAfter: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  beforeAfterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  beforeAfterLabel: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  beforeAfterLabelText: {
    ...Typography.caption,
    fontFamily: "Inter_500Medium",
  },
  beforeAfterText: {
    ...Typography.caption,
    flex: 1,
  },
  issueActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  diagnoseLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  diagnoseLinkText: {
    ...Typography.caption,
    fontFamily: "Inter_500Medium",
    color: "#FF6B35",
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    ...Typography.caption,
  },
  typeLabelText: {
    ...Typography.caption,
    fontFamily: "Inter_500Medium",
  },
  dateText: {
    ...Typography.caption,
  },
});
