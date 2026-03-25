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
}

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
}

const SEVERITY_LABELS = ["Minor", "Low", "Moderate", "High", "Critical"];
const DRIVABILITY_LABELS = ["Not Drivable", "Barely", "With Caution", "Mostly Fine", "Normal"];
const DIFFICULTY_LABELS = ["Easy", "Simple", "Moderate", "Difficult", "Expert"];

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
  const inputRef = useRef<TextInput>(null);

  const [showSolutionModal, setShowSolutionModal] = useState<string | null>(null);
  const [solDifficulty, setSolDifficulty] = useState<number | null>(null);
  const [solCost, setSolCost] = useState("");
  const [solTools, setSolTools] = useState("");
  const [solParts, setSolParts] = useState("");

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
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/threads/${threadId}/replies`] });
      queryClient.invalidateQueries({ queryKey: [`/api/threads/${threadId}`] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Reply posted", "success");
      setReplyText("");
      inputRef.current?.blur();
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to post reply", "error");
    },
  });

  const markSolutionMutation = useMutation({
    mutationFn: async ({ replyId, meta }: { replyId: string; meta: any }) => {
      return apiRequest("POST", `/api/threads/${threadId}/replies/${replyId}/solution`, meta);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/threads/${threadId}/replies`] });
      queryClient.invalidateQueries({ queryKey: [`/api/threads/${threadId}`] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Solution marked", "success");
      setShowSolutionModal(null);
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to mark solution", "error");
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

  const handleMarkSolution = (replyId: string) => {
    setShowSolutionModal(replyId);
    setSolDifficulty(null);
    setSolCost("");
    setSolTools("");
    setSolParts("");
  };

  const handleConfirmSolution = () => {
    if (!showSolutionModal) return;
    const toolsList = solTools.trim() ? solTools.split(",").map((t) => t.trim()).filter(Boolean) : null;
    const partsList = solParts.trim() ? solParts.split(",").map((p) => p.trim()).filter(Boolean) : null;
    markSolutionMutation.mutate({
      replyId: showSolutionModal,
      meta: {
        solutionDifficulty: solDifficulty,
        solutionCost: solCost.trim() || null,
        solutionTools: toolsList,
        solutionParts: partsList,
      },
    });
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
    const signals: string[] = [];
    if (item.yearsWrenching) {
      signals.push(`${item.yearsWrenching}yr`);
    }
    if (item.focusAreas && item.focusAreas.length > 0) {
      signals.push(item.focusAreas.slice(0, 2).join(", "));
    }
    if (!isTrustedSolver && signals.length === 0) return null;
    return (
      <View style={styles.replyBadgeRow}>
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
            {renderReplyBadges(item)}
            <ThemedText type="body" style={styles.replyContent}>
              {item.content}
            </ThemedText>
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
        {renderReplyBadges(item)}
        <ThemedText type="body" style={styles.replyContent}>
          {item.content}
        </ThemedText>
        {isThreadAuthor && !thread?.hasSolution ? (
          <Pressable
            style={[styles.solutionButton, { borderColor: theme.success }]}
            onPress={() => handleMarkSolution(item.id)}
          >
            <Feather name="check" size={14} color={theme.success} />
            <ThemedText type="caption" style={{ color: theme.success, marginLeft: 4 }}>
              Mark as Solution
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

  const renderSolutionForm = () => {
    if (!showSolutionModal) return null;

    return (
      <View style={[styles.solutionForm, { backgroundColor: theme.backgroundSecondary, borderTopColor: theme.border }]}>
        <View style={styles.solutionFormHeader}>
          <ThemedText type="h4">Solution Details</ThemedText>
          <Pressable onPress={() => setShowSolutionModal(null)}>
            <Feather name="x" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
          Help others by adding details about this fix (optional)
        </ThemedText>

        <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
          Difficulty
        </ThemedText>
        <View style={styles.difficultyRow}>
          {DIFFICULTY_LABELS.map((label, i) => {
            const val = i + 1;
            const isActive = solDifficulty === val;
            return (
              <Pressable
                key={label}
                onPress={() => setSolDifficulty(solDifficulty === val ? null : val)}
                style={[
                  styles.difficultyOption,
                  {
                    backgroundColor: isActive ? theme.primary + "20" : theme.backgroundDefault,
                    borderColor: isActive ? theme.primary : theme.cardBorder,
                  },
                ]}
              >
                <Text style={[styles.difficultyText, { color: isActive ? theme.primary : theme.textSecondary }]}>
                  {val}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Input
          label="Estimated Cost"
          placeholder="e.g., 150"
          value={solCost}
          onChangeText={setSolCost}
          leftIcon="dollar-sign"
          keyboardType="decimal-pad"
        />
        <Input
          label="Tools Used"
          placeholder="Comma-separated, e.g., Socket set, Torque wrench"
          value={solTools}
          onChangeText={setSolTools}
          leftIcon="tool"
        />
        <Input
          label="Parts Used"
          placeholder="Comma-separated, e.g., Spark plugs, Ignition coils"
          value={solParts}
          onChangeText={setSolParts}
          leftIcon="package"
        />

        <View style={styles.solutionFormButtons}>
          <Button variant="outline" onPress={() => setShowSolutionModal(null)} style={{ flex: 1 }}>
            Cancel
          </Button>
          <View style={{ width: Spacing.sm }} />
          <Button
            onPress={handleConfirmSolution}
            disabled={markSolutionMutation.isPending}
            style={{ flex: 1 }}
          >
            {markSolutionMutation.isPending ? "Saving..." : "Confirm Solution"}
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
        <ThemedText type="h4" style={styles.repliesHeader}>
          Replies ({replies.length})
        </ThemedText>
      </View>
    );
  };

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
      {showSolutionModal ? (
        renderSolutionForm()
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
          <View style={styles.replyLabel}>
            <Feather name="corner-down-right" size={16} color={theme.textSecondary} />
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
              Replying to thread
            </ThemedText>
          </View>
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
              placeholder="Write your reply..."
              placeholderTextColor={theme.textSecondary}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              maxLength={2000}
              onFocus={() => setIsComposing(true)}
              onBlur={() => setIsComposing(false)}
            />
            <Pressable
              style={[
                styles.sendButton,
                { backgroundColor: replyText.trim() ? theme.primary : theme.border },
              ]}
              onPress={handleSubmitReply}
              disabled={!replyText.trim() || createReplyMutation.isPending}
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
});
