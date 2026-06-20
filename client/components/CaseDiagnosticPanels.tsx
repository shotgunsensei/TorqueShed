import React, { useMemo } from "react";
import { StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Typography } from "@/constants/theme";
import { lookupObdCode } from "@/constants/obdCodes";

type DiagnosticReplyType =
  | "comment"
  | "question"
  | "suggested_test"
  | "test_result"
  | "confirmed_fix"
  | "warning"
  | "part_recommendation"
  | "tool_recommendation"
  | "shop_estimate";

export interface DiagnosticThreadLike {
  id: string;
  title: string;
  content: string;
  vehicleName?: string | null;
  symptoms?: string[] | null;
  obdCodes?: string[] | null;
  photoUrls?: string[] | null;
  videoUrls?: string[] | null;
  partsReplaced?: string | null;
  rootCause?: string | null;
  finalFix?: string | null;
  partsUsed?: string[] | null;
  toolsUsed?: string[] | null;
  verificationNotes?: string | null;
  hasSolution?: boolean;
  status?: string | null;
  createdAt?: string;
}

export interface DiagnosticReplyLike {
  id: string;
  content: string;
  createdAt: string;
  replyType?: DiagnosticReplyType | null;
  isSolution?: boolean;
  photoUrls?: string[] | null;
  videoUrls?: string[] | null;
}

interface CaseDiagnosticPanelsProps {
  thread: DiagnosticThreadLike;
  replies: DiagnosticReplyLike[];
  onAddEvidence?: () => void;
  onAddTestResult?: () => void;
  onConfirmFix?: () => void;
  style?: StyleProp<ViewStyle>;
}

interface TimelineItem {
  id: string;
  label: string;
  title: string;
  body: string;
  icon: keyof typeof Feather.glyphMap;
  tone: "primary" | "success" | "warning" | "error" | "muted";
  createdAt?: string;
}

const FIX_STEPS = ["Observed", "Hypothesis", "Test", "Result", "Fix Verified"];

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function toneColor(tone: TimelineItem["tone"], theme: ReturnType<typeof useTheme>["theme"]) {
  if (tone === "success") return theme.success;
  if (tone === "warning") return theme.accent;
  if (tone === "error") return theme.error;
  if (tone === "primary") return theme.primary;
  return theme.textMuted;
}

function getQualityItems(thread: DiagnosticThreadLike, replies: DiagnosticReplyLike[]) {
  const hasSuggestedTest = replies.some((r) => r.replyType === "suggested_test");
  const hasTestResult = replies.some((r) => r.replyType === "test_result");
  return [
    { key: "vehicle", label: "Vehicle info", complete: Boolean(thread.vehicleName) },
    { key: "symptoms", label: "Symptoms", complete: Boolean(thread.symptoms?.length || thread.content?.trim()) },
    { key: "codes", label: "Codes", complete: Boolean(thread.obdCodes?.length) },
    { key: "media", label: "Photos/video", complete: Boolean(thread.photoUrls?.length || thread.videoUrls?.length) },
    { key: "tests", label: "Tests", complete: hasSuggestedTest || thread.status === "testing" || hasTestResult },
    { key: "results", label: "Results", complete: hasTestResult },
    { key: "fix", label: "Final fix", complete: Boolean(thread.hasSolution || thread.finalFix || replies.some((r) => r.isSolution)) },
  ];
}

function getCurrentFixStep(thread: DiagnosticThreadLike, replies: DiagnosticReplyLike[]) {
  if (thread.hasSolution || thread.status === "solved" || thread.finalFix || replies.some((r) => r.isSolution)) return 4;
  if (replies.some((r) => r.replyType === "test_result")) return 3;
  if (replies.some((r) => r.replyType === "suggested_test") || thread.status === "testing") return 2;
  if (thread.obdCodes?.length || thread.symptoms?.length) return 1;
  return 0;
}

function getNextBestTest(thread: DiagnosticThreadLike, replies: DiagnosticReplyLike[]) {
  const latestSuggested = [...replies].reverse().find((r) => r.replyType === "suggested_test");
  const hasTestResult = replies.some((r) => r.replyType === "test_result");
  const firstCode = thread.obdCodes?.[0];
  const codeInfo = firstCode ? lookupObdCode(firstCode) : null;

  if (thread.hasSolution || thread.status === "solved") {
    return {
      title: "Fix verified",
      body: thread.verificationNotes || "This case has a recorded final fix. Keep the notes searchable for the next similar repair.",
      icon: "check-circle" as const,
      action: "Review solved case",
    };
  }

  if (latestSuggested && !hasTestResult) {
    return {
      title: "Run the suggested test",
      body: `${latestSuggested.content.slice(0, 150)}${latestSuggested.content.length > 150 ? "..." : ""}`,
      icon: "clipboard" as const,
      action: "Add test result",
    };
  }

  if (firstCode) {
    return {
      title: `Verify ${firstCode} before replacing parts`,
      body: codeInfo
        ? `Confirm ${codeInfo.description.toLowerCase()} with freeze frame, live data, wiring checks, or a repeatable symptom test.`
        : "Record freeze frame data, when the code sets, and one confirming test before buying parts.",
      icon: "cpu" as const,
      action: "Add test result",
    };
  }

  if (!thread.photoUrls?.length && !thread.videoUrls?.length) {
    return {
      title: "Capture evidence",
      body: "Add photos, a short video, gauge readings, fluid condition, or a meter reading so the next test is grounded in facts.",
      icon: "camera" as const,
      action: "Add evidence",
    };
  }

  if (!hasTestResult) {
    return {
      title: "Run one reversible test",
      body: "Confirm the symptom with a safe inspection, live data check, voltage check, smoke test, pressure test, or visual inspection before replacing parts.",
      icon: "activity" as const,
      action: "Add test result",
    };
  }

  return {
    title: "Narrow the cause",
    body: "Compare the test result against spec, update the hypothesis, and record the next confirming test.",
    icon: "filter" as const,
    action: "Add test result",
  };
}

function buildTimeline(thread: DiagnosticThreadLike, replies: DiagnosticReplyLike[]) {
  const items: TimelineItem[] = [];

  items.push({
    id: "observed",
    label: "Observed",
    title: "Case opened",
    body: thread.symptoms?.length ? thread.symptoms.join(", ") : thread.content,
    icon: "alert-circle",
    tone: "primary",
    createdAt: thread.createdAt,
  });

  if (thread.obdCodes?.length) {
    items.push({
      id: "codes",
      label: "Codes",
      title: "Manual OBD codes logged",
      body: thread.obdCodes.join(", "),
      icon: "cpu",
      tone: "warning",
    });
  }

  if (thread.photoUrls?.length || thread.videoUrls?.length) {
    const photoCount = thread.photoUrls?.length ?? 0;
    const videoCount = thread.videoUrls?.length ?? 0;
    items.push({
      id: "media",
      label: "Evidence",
      title: "Photos/videos attached",
      body: `${photoCount} photo${photoCount === 1 ? "" : "s"}${videoCount ? `, ${videoCount} video${videoCount === 1 ? "" : "s"}` : ""}`,
      icon: "camera",
      tone: "primary",
    });
  }

  if (thread.partsReplaced) {
    items.push({
      id: "parts-replaced",
      label: "History",
      title: "Parts already replaced",
      body: thread.partsReplaced,
      icon: "package",
      tone: "muted",
    });
  }

  replies.forEach((reply) => {
    if (!reply.replyType || reply.replyType === "comment") return;
    const meta: Record<DiagnosticReplyType, Pick<TimelineItem, "label" | "title" | "icon" | "tone">> = {
      comment: { label: "Note", title: "Case note", icon: "message-circle", tone: "muted" },
      question: { label: "Question", title: "Clarifying question", icon: "help-circle", tone: "primary" },
      suggested_test: { label: "Test", title: "Suggested test", icon: "clipboard", tone: "warning" },
      test_result: { label: "Result", title: "Test result", icon: "check-square", tone: "primary" },
      confirmed_fix: { label: "Fix", title: "Confirmed fix", icon: "check-circle", tone: "success" },
      warning: { label: "Warning", title: "Safety warning", icon: "alert-triangle", tone: "error" },
      part_recommendation: { label: "Part", title: "Part note", icon: "package", tone: "muted" },
      tool_recommendation: { label: "Tool", title: "Tool note", icon: "tool", tone: "muted" },
      shop_estimate: { label: "Shop", title: "Shop estimate", icon: "dollar-sign", tone: "muted" },
    };
    const info = meta[reply.replyType];
    items.push({
      id: reply.id,
      ...info,
      body: reply.content,
      createdAt: reply.createdAt,
    });
  });

  if (thread.hasSolution || thread.finalFix) {
    items.push({
      id: "final-fix",
      label: "Verified",
      title: thread.rootCause ? `Root cause: ${thread.rootCause}` : "Final fix recorded",
      body: thread.finalFix || thread.verificationNotes || "Final fix captured on this case.",
      icon: "shield",
      tone: "success",
    });
  }

  return items;
}

export function CaseQualityMeter({ thread, replies, style }: CaseDiagnosticPanelsProps) {
  const { theme } = useTheme();
  const qualityItems = useMemo(() => getQualityItems(thread, replies), [thread, replies]);
  const complete = qualityItems.filter((item) => item.complete).length;
  const percent = Math.round((complete / qualityItems.length) * 100);
  const meterWidth: DimensionValue = `${percent}%`;
  const missing = qualityItems.filter((item) => !item.complete).slice(0, 3);

  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }, style]}>
      <View style={styles.panelHeader}>
        <View style={[styles.panelIcon, { backgroundColor: theme.primary + "18" }]}>
          <Feather name="sliders" size={18} color={theme.primary} />
        </View>
        <View style={styles.panelTitleBlock}>
          <Text style={[styles.panelEyebrow, { color: theme.primary }]}>Case quality</Text>
          <Text style={[styles.panelTitle, { color: theme.text }]}>{percent}% useful evidence</Text>
        </View>
      </View>
      <View style={[styles.meterTrack, { backgroundColor: theme.backgroundTertiary }]}>
        <View style={[styles.meterFill, { backgroundColor: theme.primary, width: meterWidth }]} />
      </View>
      <View style={styles.qualityGrid}>
        {qualityItems.map((item) => (
          <View
            key={item.key}
            style={[
              styles.qualityChip,
              {
                backgroundColor: item.complete ? theme.success + "16" : theme.backgroundTertiary,
                borderColor: item.complete ? theme.success + "55" : theme.cardBorder,
              },
            ]}
          >
            <Feather name={item.complete ? "check" : "plus"} size={11} color={item.complete ? theme.success : theme.textMuted} />
            <Text style={[styles.qualityChipText, { color: item.complete ? theme.success : theme.textSecondary }]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
      {missing.length ? (
        <Text style={[styles.helperText, { color: theme.textMuted }]}>
          Improve it next: {missing.map((item) => item.label.toLowerCase()).join(", ")}.
        </Text>
      ) : (
        <Text style={[styles.helperText, { color: theme.success }]}>
          Strong solved-case candidate. Confirm the final fix when the repair holds.
        </Text>
      )}
    </View>
  );
}

export function NextBestTestCard({
  thread,
  replies,
  onAddEvidence,
  onAddTestResult,
  onConfirmFix,
  style,
}: CaseDiagnosticPanelsProps) {
  const { theme } = useTheme();
  const next = useMemo(() => getNextBestTest(thread, replies), [thread, replies]);
  const solved = thread.hasSolution || thread.status === "solved";
  const handlePress = solved ? onConfirmFix : next.action === "Add evidence" ? onAddEvidence : onAddTestResult;

  return (
    <View
      style={[
        styles.nextCard,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: solved ? theme.success + "66" : theme.primary + "66",
        },
        style,
      ]}
    >
      <View style={styles.nextTop}>
        <View style={[styles.nextIcon, { backgroundColor: (solved ? theme.success : theme.primary) + "18" }]}>
          <Feather name={next.icon} size={22} color={solved ? theme.success : theme.primary} />
        </View>
        <View style={styles.nextCopy}>
          <Text style={[styles.panelEyebrow, { color: solved ? theme.success : theme.primary }]}>Next best test</Text>
          <Text style={[styles.nextTitle, { color: theme.text }]}>{next.title}</Text>
          <Text style={[styles.nextBody, { color: theme.textSecondary }]}>{next.body}</Text>
        </View>
      </View>
      {handlePress ? (
        <Button onPress={handlePress} style={styles.nextButton} testID="button-next-best-test">
          {next.action}
        </Button>
      ) : null}
    </View>
  );
}

export function ObdCodeStrip({ codes }: { codes?: string[] | null }) {
  const { theme } = useTheme();
  if (!codes?.length) return null;

  return (
    <View style={styles.codeStrip}>
      {codes.map((code) => {
        const info = lookupObdCode(code);
        return (
          <View key={code} style={[styles.codeCard, { backgroundColor: theme.backgroundTertiary, borderColor: theme.primary + "55" }]}>
            <Text style={[styles.codeText, { color: theme.primary }]}>{code}</Text>
            <Text style={[styles.codeDescription, { color: theme.textSecondary }]} numberOfLines={1}>
              {info?.description || "Manual code entry"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function EvidenceTimeline({ thread, replies, style }: CaseDiagnosticPanelsProps) {
  const { theme } = useTheme();
  const { isDesktop } = useResponsive();
  const items = useMemo(() => buildTimeline(thread, replies), [thread, replies]);
  const currentStep = getCurrentFixStep(thread, replies);

  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }, style]}>
      <View style={styles.panelHeader}>
        <View style={[styles.panelIcon, { backgroundColor: theme.primary + "18" }]}>
          <Feather name="git-commit" size={18} color={theme.primary} />
        </View>
        <View style={styles.panelTitleBlock}>
          <Text style={[styles.panelEyebrow, { color: theme.primary }]}>Evidence timeline</Text>
          <Text style={[styles.panelTitle, { color: theme.text }]}>Observed to verified fix</Text>
        </View>
      </View>
      <View style={styles.fixStepRow}>
        {FIX_STEPS.map((step, index) => {
          const active = index <= currentStep;
          return (
            <StatusBadge
              key={step}
              label={step}
              icon={active ? "check" : undefined}
              variant={active ? (index === 4 ? "success" : "primary") : "muted"}
              size="sm"
            />
          );
        })}
      </View>
      <View style={[styles.timeline, isDesktop ? styles.timelineDesktop : null]}>
        {items.map((item, index) => {
          const color = toneColor(item.tone, theme);
          const date = formatDate(item.createdAt);
          return (
            <View
              key={item.id}
              style={[
                styles.timelineItem,
                isDesktop ? styles.timelineItemDesktop : null,
                { borderColor: theme.cardBorder, backgroundColor: theme.backgroundRoot },
              ]}
            >
              <View style={[styles.timelineDot, { backgroundColor: color + "20", borderColor: color }]}>
                <Feather name={item.icon} size={14} color={color} />
              </View>
              {index < items.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: theme.cardBorder }]} /> : null}
              <View style={styles.timelineBody}>
                <View style={styles.timelineMeta}>
                  <Text style={[styles.timelineLabel, { color }]}>{item.label}</Text>
                  {date ? <Text style={[styles.timelineDate, { color: theme.textMuted }]}>{date}</Text> : null}
                </View>
                <Text style={[styles.timelineTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.timelineText, { color: theme.textSecondary }]} numberOfLines={3}>
                  {item.body}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function CaseDiagnosticPanels(props: CaseDiagnosticPanelsProps) {
  const { isDesktop } = useResponsive();
  return (
    <View style={[styles.stack, props.style]}>
      <View style={isDesktop ? styles.desktopSummaryRow : styles.mobileSummaryRow}>
        <View style={styles.summaryPane}>
          <NextBestTestCard {...props} />
        </View>
        <View style={styles.summaryPane}>
          <CaseQualityMeter {...props} />
        </View>
      </View>
      <ObdCodeStrip codes={props.thread.obdCodes} />
      <EvidenceTimeline {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  mobileSummaryRow: {
    gap: Spacing.md,
  },
  desktopSummaryRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  summaryPane: {
    flex: 1,
  },
  panel: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  panelIcon: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  panelTitleBlock: {
    flex: 1,
  },
  panelEyebrow: {
    ...Typography.caption,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  panelTitle: {
    ...Typography.h4,
  },
  nextCard: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    minHeight: 190,
  },
  nextTop: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  nextIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  nextCopy: {
    flex: 1,
  },
  nextTitle: {
    ...Typography.h3,
  },
  nextBody: {
    ...Typography.body,
    marginTop: 4,
  },
  nextButton: {
    marginTop: Spacing.lg,
    minHeight: 48,
  },
  meterTrack: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  meterFill: {
    height: "100%",
    borderRadius: 5,
  },
  qualityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  qualityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  qualityChipText: {
    ...Typography.caption,
    fontWeight: "700",
  },
  helperText: {
    ...Typography.caption,
    marginTop: Spacing.sm,
  },
  codeStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  codeCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minWidth: 150,
    flexGrow: 1,
  },
  codeText: {
    ...Typography.h4,
    fontFamily: "monospace",
  },
  codeDescription: {
    ...Typography.caption,
  },
  fixStepRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  timeline: {
    gap: Spacing.sm,
  },
  timelineDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  timelineItem: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: "row",
    position: "relative",
    overflow: "hidden",
  },
  timelineItemDesktop: {
    width: "48.5%",
    marginRight: "1.5%",
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    zIndex: 1,
  },
  timelineLine: {
    position: "absolute",
    left: 31,
    top: 48,
    bottom: -8,
    width: 1,
  },
  timelineBody: {
    flex: 1,
    minWidth: 0,
  },
  timelineMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  timelineLabel: {
    ...Typography.caption,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  timelineDate: {
    ...Typography.caption,
  },
  timelineTitle: {
    ...Typography.h4,
  },
  timelineText: {
    ...Typography.small,
    marginTop: 2,
  },
});
