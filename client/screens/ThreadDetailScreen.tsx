import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
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
import { useTheme } from "@/hooks/useTheme";
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
      setReplyText("");
      inputRef.current?.blur();
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to post reply");
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
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to mark solution");
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
      navigation.goBack();
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to delete thread");
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

  const renderReply = ({ item }: { item: ThreadReply }) => (
    <Card style={item.isSolution ? { ...styles.replyCard, borderColor: theme.success, borderWidth: 2 } : styles.replyCard}>
      {item.isSolution ? (
        <View style={[styles.solutionBadge, { backgroundColor: theme.success }]}>
          <Feather name="check-circle" size={12} color="#fff" />
          <ThemedText type="caption" style={{ color: "#fff", marginLeft: 4 }}>
            Solution
          </ThemedText>
        </View>
      ) : null}
      <View style={styles.replyHeader}>
        <ThemedText type="body" style={{ fontWeight: "600" }}>{item.userName}</ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {formatDate(item.createdAt)}
        </ThemedText>
      </View>
      <ThemedText type="body" style={styles.replyContent}>
        {item.content}
      </ThemedText>
      {isThreadAuthor && !item.isSolution && !thread?.hasSolution ? (
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
                <ThemedText type="caption" style={{ color: "#fff", marginLeft: 4 }}>
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
            <View>
              <ThemedText type="body" style={{ fontWeight: "600" }}>{thread.userName}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatDate(thread.createdAt)}
              </ThemedText>
            </View>
          </View>
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
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
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
        data={replies}
        keyExtractor={(item) => item.id}
        renderItem={renderReply}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          !repliesLoading ? (
            <View style={styles.emptyContainer}>
              <Feather name="message-circle" size={48} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                No replies yet. Be the first to respond!
              </ThemedText>
            </View>
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
        <View style={styles.replyHeader}>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  replyCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  replyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  replyContent: {
    lineHeight: 20,
  },
  solutionBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
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
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  inputContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  replyHeader: {
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
