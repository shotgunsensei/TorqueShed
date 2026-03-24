import React, { useState, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
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
  createdAt: string;
  userName: string;
}

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

  const { data: thread, isLoading: threadLoading } = useQuery<Thread>({
    queryKey: [`/api/threads/${threadId}`],
  });

  const { data: replies = [], isLoading: repliesLoading } = useQuery<ThreadReply[]>({
    queryKey: [`/api/threads/${threadId}/replies`],
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
    mutationFn: async (replyId: string) => {
      return apiRequest("POST", `/api/threads/${threadId}/replies/${replyId}/solution`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/threads/${threadId}/replies`] });
      queryClient.invalidateQueries({ queryKey: [`/api/threads/${threadId}`] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Solution marked", "success");
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
    Alert.alert(
      "Mark as Solution",
      "Mark this reply as the solution to your question?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Mark Solution", onPress: () => markSolutionMutation.mutate(replyId) },
      ]
    );
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
            <ThemedText type="body" style={styles.replyContent}>
              {item.content}
            </ThemedText>
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

  const renderHeader = () => {
    if (!thread) return null;
    return (
      <View style={styles.headerSection}>
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
          <ThemedText type="body" style={styles.threadContent}>
            {thread.content}
          </ThemedText>
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
  deleteThreadButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.md,
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
});
