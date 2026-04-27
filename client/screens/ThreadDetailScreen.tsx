import React, { useState, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { MediaPickerRow } from "@/components/MediaPickerRow";
import { CaseMediaGallery } from "@/components/CaseMediaGallery";
import PartsAndToolsCard from "@/components/PartsAndToolsCard";
import EscalateCaseCard from "@/components/EscalateCaseCard";
import RepairPlanCard from "@/components/RepairPlanCard";
import CustomerSummaryCard from "@/components/CustomerSummaryCard";
import SimilarCasesCard from "@/components/SimilarCasesCard";
import CaseToolsUsedCard from "@/components/CaseToolsUsedCard";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type ThreadDetailParams = {
  threadId: string;
};

type RoutePropType = RouteProp<{ ThreadDetail: ThreadDetailParams }, "ThreadDetail">;

interface Thread {
  id: string;
  garageId: string;
  userId: string | null;
  title: string;
  content: string;
  hasSolution: boolean;
  isPinned: boolean;
  replyCount: number;
  vehicleId: string | null;
  symptoms: string[] | null;
  obdCodes: string[] | null;
  severity: number | null;
  drivability: number | null;
  recentChanges: string | null;
  vehicleName: string | null;
  createdAt: string;
  userName: string;
  yearsWrenching: number | null;
  focusAreas: string[];
  status: string | null;
  systemCategory: string | null;
  urgency: string | null;
  budget: string | null;
  toolsAvailable: string[] | null;
  whenItHappens: string | null;
  partsReplaced: string | null;
  rootCause: string | null;
  finalFix: string | null;
  partsUsed: string[] | null;
  toolsUsed: string[] | null;
  solvedCost: string | null;
  laborMinutes: number | null;
  verificationNotes: string | null;
  photoUrls: string[] | null;
  videoUrls: string[] | null;
}

type ReplyType =
  | "comment"
  | "question"
  | "suggested_test"
  | "test_result"
  | "confirmed_fix"
  | "warning"
  | "part_recommendation"
  | "tool_recommendation"
  | "shop_estimate";

interface ThreadReply {
  id: string;
  threadId: string;
  userId: string | null;
  content: string;
  isSolution: boolean;
  solutionDifficulty: number | null;
  solutionCost: string | null;
  solutionTools: string[] | null;
  solutionParts: string[] | null;
  createdAt: string;
  userName: string;
  yearsWrenching: number | null;
  focusAreas: string[];
  solutionCountTotal: number;
  replyType: ReplyType | null;
  replierTier?: string | null;
  isPriority?: boolean;
  photoUrls: string[] | null;
  videoUrls: string[] | null;
}

const SEVERITY_LABELS = ["Minor", "Low", "Moderate", "High", "Critical"];
const DRIVABILITY_LABELS = ["Not Drivable", "Barely", "With Caution", "Mostly Fine", "Normal"];
const DIFFICULTY_LABELS = ["Easy", "Simple", "Moderate", "Difficult", "Expert"];

const REPLY_TYPE_META: Record<ReplyType, { label: string; icon: keyof typeof Feather.glyphMap; color: string }> = {
  comment: { label: "Comment", icon: "message-circle", color: "#6B7280" },
  question: { label: "Question", icon: "help-circle", color: "#3B82F6" },
  suggested_test: { label: "Suggested test", icon: "clipboard", color: "#8B5CF6" },
  test_result: { label: "Test result", icon: "check-square", color: "#0EA5E9" },
  confirmed_fix: { label: "Confirmed fix", icon: "check-circle", color: "#10B981" },
  warning: { label: "Warning", icon: "alert-triangle", color: "#EF4444" },
  part_recommendation: { label: "Part rec", icon: "package", color: "#F59E0B" },
  tool_recommendation: { label: "Tool rec", icon: "tool", color: "#F59E0B" },
  shop_estimate: { label: "Shop estimate", icon: "dollar-sign", color: "#EC4899" },
};

const STATUS_OPTIONS: Array<{ key: "open" | "testing" | "needs_expert"; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { key: "open", label: "Open", icon: "circle" },
  { key: "testing", label: "Testing", icon: "activity" },
  { key: "needs_expert", label: "Needs Expert", icon: "alert-circle" },
];

export default function ThreadDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { currentUser } = useAuth();
  const { threadId } = route.params;

  const [replyText, setReplyText] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [replyType, setReplyType] = useState<ReplyType>("comment");
  const [replyPhotoUrls, setReplyPhotoUrls] = useState<string[]>([]);
  const [replyVideoUrls, setReplyVideoUrls] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  const [showFinalFix, setShowFinalFix] = useState(false);
  const [solvedReplyId, setSolvedReplyId] = useState<string | null>(null);
  const [rootCause, setRootCause] = useState("");
  const [finalFix, setFinalFix] = useState("");
  const [solvedCost, setSolvedCost] = useState("");
  const [laborMin, setLaborMin] = useState("");
  const [partsUsedText, setPartsUsedText] = useState("");
  const [toolsUsedText, setToolsUsedText] = useState("");
  const [verificationNotes, setVerificationNotes] = useState("");

  const { data: thread, isLoading: threadLoading } = useQuery<Thread>({
    queryKey: [`/api/threads/${threadId}`],
  });

  const { data: replies = [], isLoading: repliesLoading } = useQuery<ThreadReply[]>({
    queryKey: [`/api/threads/${threadId}/replies`],
  });

  const { data: savedThreadIds = [] } = useQuery<string[]>({
    queryKey: ["/api/saved/thread-ids"],
    enabled: !!currentUser,
  });

  const isSaved = savedThreadIds.includes(threadId);

  const toggleSaveMutation = useMutation({
    mutationFn: async () => {
      if (isSaved) {
        return apiRequest("DELETE", `/api/saved/threads/${threadId}`);
      }
      return apiRequest("POST", `/api/saved/threads/${threadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved/thread-ids"] });
      queryClient.invalidateQueries({ queryKey: ["/api/saved"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show(isSaved ? "Removed from saved" : "Thread saved", "success");
    },
    onError: () => {
      toast.show("Failed to update saved threads", "error");
    },
  });

  const sortedReplies = useMemo(() => {
    const solutionReply = replies.find((r) => r.isSolution);
    const otherReplies = replies.filter((r) => !r.isSolution);
    if (solutionReply) {
      return [solutionReply, ...otherReplies];
    }
    return replies;
  }, [replies]);

  const createReplyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/threads/${threadId}/replies`, {
        content: replyText.trim(),
        replyType,
        photoUrls: replyPhotoUrls.length ? replyPhotoUrls : undefined,
        videoUrls: replyVideoUrls.length ? replyVideoUrls : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/threads/${threadId}/replies`] });
      queryClient.invalidateQueries({ queryKey: [`/api/threads/${threadId}`] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Reply posted", "success");
      setReplyText("");
      setReplyType("comment");
      setReplyPhotoUrls([]);
      setReplyVideoUrls([]);
      inputRef.current?.blur();
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to post reply", "error");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: "open" | "testing" | "needs_expert") => {
      return apiRequest("PATCH", `/api/threads/${threadId}/status`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/threads/${threadId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/threads"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Case status updated", "success");
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to update status", "error");
    },
  });

  const markSolvedMutation = useMutation({
    mutationFn: async () => {
      const partsList = partsUsedText.trim()
        ? partsUsedText.split(",").map((p) => p.trim()).filter(Boolean)
        : null;
      const toolsList = toolsUsedText.trim()
        ? toolsUsedText.split(",").map((t) => t.trim()).filter(Boolean)
        : null;
      return apiRequest("POST", `/api/threads/${threadId}/solved`, {
        rootCause: rootCause.trim(),
        finalFix: finalFix.trim(),
        partsUsed: partsList,
        toolsUsed: toolsList,
        solvedCost: solvedCost.trim() || null,
        laborMinutes: laborMin.trim() ? Number(laborMin.trim()) : null,
        verificationNotes: verificationNotes.trim() || null,
        replyId: solvedReplyId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/threads/${threadId}/replies`] });
      queryClient.invalidateQueries({ queryKey: [`/api/threads/${threadId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/threads"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Case marked solved", "success");
      setShowFinalFix(false);
      setSolvedReplyId(null);
      setRootCause("");
      setFinalFix("");
      setSolvedCost("");
      setLaborMin("");
      setPartsUsedText("");
      setToolsUsedText("");
      setVerificationNotes("");
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to mark solved", "error");
    },
  });

  const handleSubmitReply = () => {
    if (!replyText.trim()) return;
    createReplyMutation.mutate();
  };

  const deleteThreadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/threads/${threadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/garages"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Thread deleted", "success");
      navigation.goBack();
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to delete thread", "error");
    },
  });

  const openFinalFix = (replyId: string | null) => {
    setSolvedReplyId(replyId);
    setShowFinalFix(true);
    if (replyId) {
      const reply = replies.find((r) => r.id === replyId);
      if (reply && !finalFix) {
        setFinalFix(reply.content);
      }
    }
  };

  const handleConfirmSolved = () => {
    if (!rootCause.trim() || !finalFix.trim()) {
      toast.show("Root cause and final fix are required", "error");
      return;
    }
    markSolvedMutation.mutate();
  };

  const handleDeleteThread = () => {
    Alert.alert(
      "Delete Thread",
      "Are you sure you want to delete this thread and all its replies? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteThreadMutation.mutate(),
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const isThreadAuthor = currentUser?.id === thread?.userId;

  const renderSolutionMeta = (reply: ThreadReply) => {
    const hasMeta = reply.solutionDifficulty || reply.solutionCost || reply.solutionTools || reply.solutionParts;
    if (!hasMeta) return null;

    return (
      <View style={[styles.solutionMeta, { borderTopColor: theme.success + "30" }]}>
        {reply.solutionDifficulty ? (
          <View style={styles.solutionMetaItem}>
            <Feather name="bar-chart-2" size={12} color={theme.success} />
            <Text style={[styles.solutionMetaText, { color: theme.text }]}>
              {DIFFICULTY_LABELS[reply.solutionDifficulty - 1]} ({reply.solutionDifficulty}/5)
            </Text>
          </View>
        ) : null}
        {reply.solutionCost ? (
          <View style={styles.solutionMetaItem}>
            <Feather name="dollar-sign" size={12} color={theme.success} />
            <Text style={[styles.solutionMetaText, { color: theme.text }]}>
              ~${reply.solutionCost}
            </Text>
          </View>
        ) : null}
        {reply.solutionTools && reply.solutionTools.length > 0 ? (
          <View style={styles.solutionMetaItem}>
            <Feather name="tool" size={12} color={theme.success} />
            <Text style={[styles.solutionMetaText, { color: theme.text }]} numberOfLines={1}>
              {reply.solutionTools.join(", ")}
            </Text>
          </View>
        ) : null}
        {reply.solutionParts && reply.solutionParts.length > 0 ? (
          <View style={styles.solutionMetaItem}>
            <Feather name="package" size={12} color={theme.success} />
            <Text style={[styles.solutionMetaText, { color: theme.text }]} numberOfLines={1}>
              {reply.solutionParts.join(", ")}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderReplyBadges = (item: ThreadReply) => {
    const isTrustedSolver = (item.solutionCountTotal || 0) >= 3;
    const isPriority = !!item.isPriority;
    const signals: string[] = [];
    if (item.yearsWrenching) {
      signals.push(`${item.yearsWrenching}yr`);
    }
    if (item.focusAreas && item.focusAreas.length > 0) {
      signals.push(item.focusAreas.slice(0, 2).join(", "));
    }
    if (!isTrustedSolver && !isPriority && signals.length === 0) return null;
    return (
      <View style={styles.replyBadgeRow}>
        {isPriority ? (
          <View style={[styles.trustedBadge, { backgroundColor: theme.primary + "18" }]} testID="badge-priority-member">
            <Feather name="zap" size={11} color={theme.primary} />
            <Text style={[styles.trustedBadgeText, { color: theme.primary }]}>Priority Member</Text>
          </View>
        ) : null}
        {isTrustedSolver ? (
          <View style={[styles.trustedBadge, { backgroundColor: theme.success + "18" }]}>
            <Feather name="award" size={11} color={theme.success} />
            <Text style={[styles.trustedBadgeText, { color: theme.success }]}>Trusted Solver</Text>
          </View>
        ) : null}
        {signals.length > 0 ? (
          <View style={styles.replyCredRow}>
            <Feather name="tool" size={10} color={theme.textMuted} />
            <Text style={[styles.replyCredText, { color: theme.textMuted }]}>{signals.join(" / ")}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderTypeChip = (item: ThreadReply) => {
    const t = (item.replyType ?? "comment") as ReplyType;
    const meta = REPLY_TYPE_META[t];
    if (!meta) return null;
    return (
      <View style={[styles.typeChip, { backgroundColor: meta.color + "1A", borderColor: meta.color + "55" }]}>
        <Feather name={meta.icon} size={10} color={meta.color} />
        <Text style={[styles.typeChipText, { color: meta.color }]}>{meta.label}</Text>
      </View>
    );
  };

  const renderReply = ({ item }: { item: ThreadReply }) => {
    if (item.isSolution) {
      return (
        <View style={[styles.solutionCard, { backgroundColor: theme.success + "10", borderColor: theme.success }]}>
          <View style={[styles.solutionBanner, { backgroundColor: theme.success }]}>
            <Feather name="check-circle" size={14} color="#fff" />
            <ThemedText type="caption" style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}>
              Accepted Solution
            </ThemedText>
          </View>
          <View style={styles.replyBody}>
            <View style={styles.replyHeaderRow}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>{item.userName}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatDate(item.createdAt)}
              </ThemedText>
            </View>
            <View style={styles.replyTypeRow}>
              {renderTypeChip(item)}
              {renderReplyBadges(item)}
            </View>
            <ThemedText type="body" style={styles.replyContent}>
              {item.content}
            </ThemedText>
            <CaseMediaGallery
              photoUrls={item.photoUrls}
              videoUrls={item.videoUrls}
              testIDPrefix={`reply-media-${item.id}`}
            />
            {renderSolutionMeta(item)}
          </View>
        </View>
      );
    }

    return (
      <Card style={styles.replyCard}>
        <View style={styles.replyHeaderRow}>
          <ThemedText type="body" style={{ fontWeight: "600" }}>{item.userName}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {formatDate(item.createdAt)}
          </ThemedText>
        </View>
        <View style={styles.replyTypeRow}>
          {renderTypeChip(item)}
          {renderReplyBadges(item)}
        </View>
        <ThemedText type="body" style={styles.replyContent}>
          {item.content}
        </ThemedText>
        <CaseMediaGallery
          photoUrls={item.photoUrls}
          videoUrls={item.videoUrls}
          testIDPrefix={`reply-media-${item.id}`}
        />
        {isThreadAuthor && !thread?.hasSolution ? (
          <Pressable
            style={[styles.solutionButton, { borderColor: theme.success }]}
            onPress={() => openFinalFix(item.id)}
            testID={`button-mark-solution-${item.id}`}
          >
            <Feather name="check" size={14} color={theme.success} />
            <ThemedText type="caption" style={{ color: theme.success, marginLeft: 4 }}>
              This solved it
            </ThemedText>
          </Pressable>
        ) : null}
      </Card>
    );
  };

  const renderCredibility = () => {
    if (!thread) return null;
    const signals: string[] = [];
    if (thread.yearsWrenching) {
      signals.push(`${thread.yearsWrenching} ${thread.yearsWrenching === 1 ? "year" : "years"} wrenching`);
    }
    if (thread.focusAreas && thread.focusAreas.length > 0) {
      signals.push(thread.focusAreas.join(", "));
    }
    if (signals.length === 0) return null;

    return (
      <View style={[styles.credRow, { backgroundColor: theme.backgroundTertiary }]}>
        <Feather name="tool" size={11} color={theme.textMuted} />
        <ThemedText type="caption" style={{ color: theme.textMuted, marginLeft: 4 }}>
          {signals.join(" / ")}
        </ThemedText>
      </View>
    );
  };

  const renderThreadMetadata = () => {
    if (!thread) return null;
    const hasMetadata = thread.vehicleName || (thread.symptoms && thread.symptoms.length > 0) ||
      (thread.obdCodes && thread.obdCodes.length > 0) || thread.severity || thread.drivability;
    if (!hasMetadata) return null;

    return (
      <View style={[styles.metadataCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
        {thread.vehicleName ? (
          <View style={styles.metaRow}>
            <Feather name="truck" size={14} color={theme.primary} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm, fontWeight: "600" }}>
              {thread.vehicleName}
            </ThemedText>
          </View>
        ) : null}

        {thread.symptoms && thread.symptoms.length > 0 ? (
          <View style={styles.metaRow}>
            <Feather name="alert-circle" size={14} color="#EF4444" />
            <View style={[styles.metaChips, { marginLeft: Spacing.sm }]}>
              {thread.symptoms.map((s) => (
                <View key={s} style={[styles.metaChip, { backgroundColor: "#EF444415" }]}>
                  <Text style={[styles.metaChipText, { color: "#EF4444" }]}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {thread.obdCodes && thread.obdCodes.length > 0 ? (
          <View style={styles.metaRow}>
            <Feather name="cpu" size={14} color="#F59E0B" />
            <View style={[styles.metaChips, { marginLeft: Spacing.sm }]}>
              {thread.obdCodes.map((c) => (
                <View key={c} style={[styles.metaChip, { backgroundColor: "#F59E0B15" }]}>
                  <Text style={[styles.metaChipText, { color: "#F59E0B" }]}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {thread.severity ? (
          <View style={styles.metaRow}>
            <Feather name="thermometer" size={14} color={theme.textMuted} />
            <ThemedText type="caption" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
              Severity: {thread.severity}/5 ({SEVERITY_LABELS[thread.severity - 1]})
            </ThemedText>
          </View>
        ) : null}

        {thread.drivability ? (
          <View style={styles.metaRow}>
            <Feather name="navigation" size={14} color={theme.textMuted} />
            <ThemedText type="caption" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
              Drivability: {thread.drivability}/5 ({DRIVABILITY_LABELS[thread.drivability - 1]})
            </ThemedText>
          </View>
        ) : null}

        {thread.recentChanges ? (
          <View style={styles.metaRow}>
            <Feather name="edit-3" size={14} color={theme.textMuted} />
            <ThemedText type="caption" style={{ marginLeft: Spacing.sm, color: theme.textSecondary, flex: 1 }}>
              Recent: {thread.recentChanges}
            </ThemedText>
          </View>
        ) : null}
      </View>
    );
  };

  const renderSolvedSummary = () => {
    if (!thread?.hasSolution) return null;
    const solutionReply = replies.find((r) => r.isSolution);
    if (!solutionReply) return null;

    return (
      <View style={[styles.solvedSummary, { backgroundColor: theme.success + "08", borderColor: theme.success }]}>
        <View style={styles.solvedSummaryHeader}>
          <Feather name="check-circle" size={16} color={theme.success} />
          <ThemedText type="h4" style={{ color: theme.success, marginLeft: Spacing.sm }}>
            Solved
          </ThemedText>
        </View>

        <View style={styles.summarySection}>
          <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 2 }}>Problem</ThemedText>
          <ThemedText type="body" numberOfLines={2}>{thread.content}</ThemedText>
        </View>

        <View style={styles.summarySection}>
          <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 2 }}>Solution</ThemedText>
          <ThemedText type="body" numberOfLines={3}>{solutionReply.content}</ThemedText>
        </View>

        {(solutionReply.solutionDifficulty || solutionReply.solutionCost || solutionReply.solutionParts) ? (
          <View style={styles.summaryStats}>
            {solutionReply.solutionDifficulty ? (
              <View style={[styles.summaryStat, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="bar-chart-2" size={12} color={theme.textMuted} />
                <Text style={[styles.summaryStatText, { color: theme.text }]}>
                  {DIFFICULTY_LABELS[solutionReply.solutionDifficulty - 1]}
                </Text>
              </View>
            ) : null}
            {solutionReply.solutionCost ? (
              <View style={[styles.summaryStat, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="dollar-sign" size={12} color={theme.textMuted} />
                <Text style={[styles.summaryStatText, { color: theme.text }]}>
                  ~${solutionReply.solutionCost}
                </Text>
              </View>
            ) : null}
            {solutionReply.solutionParts && solutionReply.solutionParts.length > 0 ? (
              <View style={[styles.summaryStat, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="package" size={12} color={theme.textMuted} />
                <Text style={[styles.summaryStatText, { color: theme.text }]}>
                  {solutionReply.solutionParts.length} part{solutionReply.solutionParts.length !== 1 ? "s" : ""}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const renderFinalFixForm = () => {
    if (!showFinalFix) return null;

    return (
      <View style={[styles.solutionForm, { backgroundColor: theme.backgroundSecondary, borderTopColor: theme.border }]}>
        <View style={styles.solutionFormHeader}>
          <ThemedText type="h4">Mark Case Solved</ThemedText>
          <Pressable onPress={() => setShowFinalFix(false)} testID="button-close-finalfix">
            <Feather name="x" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
          Capture exactly what fixed it so the next person can verify and reuse it.
        </ThemedText>

        <Input
          label="Root cause *"
          placeholder="e.g., Cracked vacuum line on intake manifold"
          value={rootCause}
          onChangeText={setRootCause}
          multiline
          numberOfLines={2}
          leftIcon="search"
        />
        <Input
          label="Final fix *"
          placeholder="What you actually did to fix it"
          value={finalFix}
          onChangeText={setFinalFix}
          multiline
          numberOfLines={3}
          leftIcon="check-circle"
        />
        <Input
          label="Parts used"
          placeholder="Comma-separated"
          value={partsUsedText}
          onChangeText={setPartsUsedText}
          leftIcon="package"
        />
        <Input
          label="Tools used"
          placeholder="Comma-separated"
          value={toolsUsedText}
          onChangeText={setToolsUsedText}
          leftIcon="tool"
        />
        <Input
          label="Total cost"
          placeholder="e.g., 145"
          value={solvedCost}
          onChangeText={setSolvedCost}
          leftIcon="dollar-sign"
          keyboardType="decimal-pad"
        />
        <Input
          label="Labor minutes"
          placeholder="e.g., 90"
          value={laborMin}
          onChangeText={setLaborMin}
          leftIcon="clock"
          keyboardType="number-pad"
        />
        <Input
          label="Verification notes"
          placeholder="How you confirmed it's actually fixed (drove 50mi, no codes returned, etc.)"
          value={verificationNotes}
          onChangeText={setVerificationNotes}
          multiline
          numberOfLines={2}
          leftIcon="shield"
        />

        <View style={styles.solutionFormButtons}>
          <Pressable
            onPress={() => setShowFinalFix(false)}
            style={[styles.secondaryBtn, { borderColor: theme.border, flex: 1 }]}
            testID="button-cancel-finalfix"
          >
            <ThemedText type="body" style={{ fontWeight: "600" }}>Cancel</ThemedText>
          </Pressable>
          <View style={{ width: Spacing.sm }} />
          <Button
            onPress={handleConfirmSolved}
            disabled={markSolvedMutation.isPending}
            style={{ flex: 1 }}
          >
            {markSolvedMutation.isPending ? "Saving..." : "Mark Solved"}
          </Button>
        </View>
      </View>
    );
  };

  const renderHeader = () => {
    if (!thread) return null;
    return (
      <View style={styles.headerSection}>
        {renderSolvedSummary()}

        <Card style={styles.threadCard}>
          <View style={styles.threadHeader}>
            <ThemedText type="h3" style={styles.threadTitle}>
              {thread.title}
            </ThemedText>
            {thread.hasSolution ? (
              <View style={[styles.solvedBadge, { backgroundColor: theme.success }]}>
                <Feather name="check-circle" size={12} color="#fff" />
                <ThemedText type="caption" style={{ color: "#fff", marginLeft: 4, fontWeight: "600" }}>
                  Solved
                </ThemedText>
              </View>
            ) : null}
          </View>
          <View style={styles.threadMeta}>
            <View style={[styles.authorAvatar, { backgroundColor: theme.primary + "20" }]}>
              <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "600" }}>
                {(thread.userName || "U").charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>{thread.userName}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatDate(thread.createdAt)}
              </ThemedText>
            </View>
          </View>
          {renderCredibility()}
          {renderThreadMetadata()}
          <ThemedText type="body" style={styles.threadContent}>
            {thread.content}
          </ThemedText>
          <CaseMediaGallery
            photoUrls={thread.photoUrls}
            videoUrls={thread.videoUrls}
            testIDPrefix="thread-media"
            thumbSize={140}
          />
          {isThreadAuthor && !thread.hasSolution ? (
            <View style={styles.statusChanger}>
              <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: Spacing.xs }}>
                Case status
              </ThemedText>
              <View style={styles.statusRow}>
                {STATUS_OPTIONS.map((opt) => {
                  const active = (thread.status || "open") === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => updateStatusMutation.mutate(opt.key)}
                      disabled={updateStatusMutation.isPending || active}
                      style={[
                        styles.statusOption,
                        {
                          backgroundColor: active ? theme.primary + "20" : theme.backgroundDefault,
                          borderColor: active ? theme.primary : theme.cardBorder,
                        },
                      ]}
                      testID={`button-status-${opt.key}`}
                    >
                      <Feather name={opt.icon} size={12} color={active ? theme.primary : theme.textSecondary} />
                      <Text style={[styles.statusOptionText, { color: active ? theme.primary : theme.textSecondary }]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={() => openFinalFix(null)}
                style={[styles.markSolvedBtn, { backgroundColor: theme.success }]}
                testID="button-mark-case-solved"
              >
                <Feather name="check-circle" size={14} color="#fff" />
                <Text style={styles.markSolvedBtnText}>Mark Case Solved</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.threadActions}>
            {currentUser ? (
              <Pressable
                onPress={() => toggleSaveMutation.mutate()}
                disabled={toggleSaveMutation.isPending}
                style={[styles.bookmarkButton, { borderColor: isSaved ? theme.primary : theme.border }]}
                testID="button-bookmark-thread"
              >
                <Feather name={isSaved ? "bookmark" : "bookmark"} size={14} color={isSaved ? theme.primary : theme.textSecondary} />
                <ThemedText type="caption" style={{ color: isSaved ? theme.primary : theme.textSecondary, marginLeft: 4 }}>
                  {isSaved ? "Saved" : "Save"}
                </ThemedText>
              </Pressable>
            ) : null}
            {isThreadAuthor ? (
              <Pressable
                onPress={handleDeleteThread}
                disabled={deleteThreadMutation.isPending}
                style={[styles.deleteThreadButton, { borderColor: theme.error }]}
              >
                <Feather name="trash-2" size={14} color={theme.error} />
                <ThemedText type="caption" style={{ color: theme.error, marginLeft: 4 }}>
                  {deleteThreadMutation.isPending ? "Deleting..." : "Delete Thread"}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </Card>

        {!thread.hasSolution && thread.status !== "solved" ? (
          <SimilarCasesCard
            caseId={threadId}
            onUpgrade={() => navigation.navigate("Main", { screen: "MoreTab", params: { screen: "Subscription" } })}
          />
        ) : null}
        <PartsAndToolsCard
          caseId={threadId}
          onUpgrade={() => navigation.navigate("Main", { screen: "MoreTab", params: { screen: "Subscription" } })}
          onBrowseMarketplace={() => navigation.navigate("Main", { screen: "MarketTab", params: { screen: "Market", params: { segment: "swap" } } })}
        />
        <RepairPlanCard
          caseId={threadId}
          onUpgrade={() => navigation.navigate("Main", { screen: "MoreTab", params: { screen: "Subscription" } })}
        />
        <CaseToolsUsedCard
          caseId={threadId}
          isAuthor={isThreadAuthor}
          onUpgrade={() => navigation.navigate("Main", { screen: "MoreTab", params: { screen: "Subscription" } })}
        />
        <EscalateCaseCard caseId={threadId} />
        <CustomerSummaryCard
          caseId={threadId}
          isAuthor={isThreadAuthor}
          onUpgrade={() => navigation.navigate("Main", { screen: "MoreTab", params: { screen: "Subscription" } })}
        />

        <ThemedText type="h4" style={styles.repliesHeader}>
          Replies ({replies.length})
        </ThemedText>
      </View>
    );
  };

  const REPLY_TYPE_PICKER: ReplyType[] = [
    "comment",
    "question",
    "suggested_test",
    "test_result",
    "confirmed_fix",
    "warning",
    "part_recommendation",
    "tool_recommendation",
    "shop_estimate",
  ];

  if (threadLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <Skeleton.List count={4} style={{ paddingTop: headerHeight + Spacing.lg }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <FlatList
        data={sortedReplies}
        keyExtractor={(item) => item.id}
        renderItem={renderReply}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          !repliesLoading ? (
            <EmptyState
              icon="message-circle"
              title="No Replies Yet"
              description="Be the first to respond to this thread!"
            />
          ) : null
        }
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      />
      {showFinalFix ? (
        renderFinalFixForm()
      ) : (
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.backgroundSecondary,
              borderTopColor: theme.border,
              paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.md,
            },
          ]}
        >
          <View style={styles.typePickerRow}>
            {REPLY_TYPE_PICKER.map((t) => {
              const meta = REPLY_TYPE_META[t];
              const active = replyType === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setReplyType(t)}
                  style={[
                    styles.typePickerChip,
                    {
                      backgroundColor: active ? meta.color + "26" : theme.backgroundDefault,
                      borderColor: active ? meta.color : theme.border,
                    },
                  ]}
                  testID={`button-reply-type-${t}`}
                >
                  <Feather name={meta.icon} size={11} color={active ? meta.color : theme.textSecondary} />
                  <Text style={[styles.typePickerText, { color: active ? meta.color : theme.textSecondary }]}>
                    {meta.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <MediaPickerRow
            photoPaths={replyPhotoUrls}
            videoPaths={replyVideoUrls}
            onChangePhotos={setReplyPhotoUrls}
            onChangeVideos={setReplyVideoUrls}
            testIDPrefix="reply-media"
          />
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundRoot,
                  color: theme.text,
                  borderColor: replyText.trim() ? theme.primary : theme.border,
                },
              ]}
              placeholder={`Add a ${REPLY_TYPE_META[replyType].label.toLowerCase()}...`}
              placeholderTextColor={theme.textSecondary}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              maxLength={2000}
              onFocus={() => setIsComposing(true)}
              onBlur={() => setIsComposing(false)}
              testID="input-reply"
            />
            <Pressable
              style={[
                styles.sendButton,
                { backgroundColor: replyText.trim() ? theme.primary : theme.border },
              ]}
              onPress={handleSubmitReply}
              disabled={!replyText.trim() || createReplyMutation.isPending}
              testID="button-send-reply"
            >
              {createReplyMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="send" size={20} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    marginBottom: Spacing.lg,
  },
  threadCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  threadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  threadTitle: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  threadMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  credRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
    marginBottom: Spacing.md,
  },
  metadataCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  metaChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    flex: 1,
  },
  metaChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  metaChipText: {
    ...Typography.caption,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  threadActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  bookmarkButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  deleteThreadButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  threadContent: {
    lineHeight: 22,
  },
  solvedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  solvedSummary: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    marginBottom: Spacing.lg,
  },
  solvedSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  summarySection: {
    marginBottom: Spacing.sm,
  },
  summaryStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  summaryStat: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  summaryStatText: {
    ...Typography.caption,
    fontFamily: "Inter_500Medium",
  },
  repliesHeader: {
    marginBottom: Spacing.md,
  },
  solutionCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  solutionBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  replyBody: {
    padding: Spacing.md,
  },
  solutionMeta: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  solutionMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  solutionMetaText: {
    ...Typography.caption,
    flex: 1,
  },
  replyCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  replyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  replyContent: {
    lineHeight: 20,
  },
  solutionButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  solutionForm: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  solutionFormHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  difficultyRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  difficultyOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  difficultyText: {
    ...Typography.body,
    fontFamily: "Inter_500Medium",
  },
  solutionFormButtons: {
    flexDirection: "row",
    marginTop: Spacing.md,
  },
  inputContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  replyLabel: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    minHeight: 44,
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  replyBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  trustedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  trustedBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  replyCredRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  replyCredText: {
    fontSize: 10,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 10,
    fontWeight: "600",
  },
  replyTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  statusChanger: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusOptionText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  markSolvedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  markSolvedBtnText: {
    color: "#fff",
    ...Typography.body,
    fontWeight: "700",
  },
  typePickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  typePickerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  typePickerText: {
    fontSize: 11,
    fontWeight: "600",
  },
  secondaryBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
