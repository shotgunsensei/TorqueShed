import React, { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { SegmentedControl } from "@/components/SegmentedControl";
import { MessageBubble } from "@/components/MessageBubble";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useChat } from "@/hooks/useChat";
import { useResponsive } from "@/hooks/useResponsive";
import { Spacing, BorderRadius } from "@/constants/theme";
import { SAMPLE_THREADS, type Thread } from "@/constants/garages";
import { placeholders, microcopy } from "@/constants/brand";
import type { GaragesStackParamList } from "@/navigation/GaragesStackNavigator";

function calculateHotScore(thread: Thread): number {
  const MAX_RECENCY_SCORE = 100;
  const HOUR = 3600000;
  const hoursAgo = (Date.now() - thread.lastActivityTime) / HOUR;
  const recencyScore = Math.max(0, MAX_RECENCY_SCORE - hoursAgo * 10);
  return thread.replies + recencyScore;
}

type RoutePropType = RouteProp<GaragesStackParamList, "GarageDetail">;

const TEMP_USER_ID = "user-" + Math.random().toString(36).substring(2, 9);
const TEMP_USER_NAME = "Guest" + Math.floor(Math.random() * 1000);

export default function GarageDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { isDesktop } = useResponsive();
  const route = useRoute<RoutePropType>();
  const { garageId } = route.params;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [messageInput, setMessageInput] = useState("");

  const {
    messages,
    isLoading,
    connectionStatus,
    typingUsers,
    sendMessage,
    sendTyping,
  } = useChat({
    garageId,
    userId: TEMP_USER_ID,
    userName: TEMP_USER_NAME,
  });

  const allThreads = useMemo(
    () => SAMPLE_THREADS.filter((t) => t.garageId === garageId),
    [garageId]
  );

  const hotThreads = useMemo(() => {
    return [...allThreads]
      .sort((a, b) => calculateHotScore(b) - calculateHotScore(a))
      .slice(0, 3);
  }, [allThreads]);

  const threads = useMemo(() => {
    return [...allThreads].sort((a, b) => b.lastActivityTime - a.lastActivityTime);
  }, [allThreads]);

  const handleSend = useCallback(() => {
    if (!messageInput.trim()) return;
    sendMessage(messageInput.trim());
    setMessageInput("");
  }, [messageInput, sendMessage]);

  const handleInputChange = useCallback((text: string) => {
    setMessageInput(text);
    sendTyping();
  }, [sendTyping]);

  const displayMessages = useMemo(() => {
    return messages.map((msg) => ({
      id: msg.id,
      userId: msg.userId,
      userName: msg.userName || "Unknown",
      message: msg.content,
      timestamp: new Date(msg.createdAt),
      isOwn: msg.userId === TEMP_USER_ID,
      focusAreas: (msg as any).userFocusAreas || [],
      yearsWrenching: (msg as any).userYearsWrenching || null,
    }));
  }, [messages]);

  const renderMessage = useCallback(({ item }: { item: typeof displayMessages[0] }) => (
    <MessageBubble
      message={item.message}
      userName={item.userName}
      timestamp={item.timestamp}
      isOwn={item.isOwn}
      focusAreas={item.focusAreas}
      yearsWrenching={item.yearsWrenching}
    />
  ), []);

  const renderThread = useCallback(({ item, isHot = false }: { item: Thread; isHot?: boolean }) => (
    <Pressable
      style={({ pressed }) => [
        styles.threadCard,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: item.isNew ? theme.primary + "40" : theme.cardBorder,
          borderLeftWidth: item.isNew ? 3 : 1,
          borderLeftColor: item.isNew ? theme.primary : theme.cardBorder,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
      onPress={() => {}}
      testID={`thread-card-${item.id}`}
    >
      <View style={styles.threadHeader}>
        <ThemedText type="h4" numberOfLines={2} style={styles.threadTitle}>
          {item.title}
        </ThemedText>
        <View style={styles.threadBadges}>
          {item.isNew ? (
            <View style={[styles.badge, { backgroundColor: theme.primary + "20" }]}>
              <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "600" }}>
                {microcopy.new}
              </ThemedText>
            </View>
          ) : null}
          {item.hasSolution ? (
            <View style={[styles.badge, { backgroundColor: theme.success + "20" }]}>
              <Feather name="check-circle" size={10} color={theme.success} />
              <ThemedText type="caption" style={{ color: theme.success, fontWeight: "600", marginLeft: 2 }}>
                {microcopy.solved}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.threadMeta}>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          by {item.author}
        </ThemedText>
        <View style={styles.threadStats}>
          <Feather name="message-circle" size={12} color={theme.textSecondary} />
          <ThemedText
            type="caption"
            style={[styles.replyCount, { color: theme.textSecondary }]}
          >
            {item.replies}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {item.lastActivity}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  ), [theme]);

  const renderEmptyThreads = () => (
    <EmptyState
      image={require("../../assets/images/empty-threads.png")}
      title="No Discussions Yet"
      description="Start a new thread and get the conversation going"
      actionLabel="New Thread"
      onAction={() => {}}
    />
  );

  const renderEmptyChat = () => (
    <View style={styles.emptyChatContainer}>
      {isLoading ? (
        <ActivityIndicator size="large" color={theme.primary} />
      ) : (
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          Be the first to say something!
        </ThemedText>
      )}
    </View>
  );

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;
    const names = typingUsers.slice(0, 2).join(", ");
    const suffix = typingUsers.length > 2 ? ` and ${typingUsers.length - 2} others` : "";
    return (
      <View style={styles.typingIndicator}>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {names}{suffix} typing...
        </ThemedText>
      </View>
    );
  };

  const desktopContentStyle = isDesktop ? {
    maxWidth: 800,
    alignSelf: "center" as const,
    width: "100%" as const,
  } : {};

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.segmentContainer,
          { paddingTop: isDesktop ? Spacing.xl : headerHeight + Spacing.md },
          desktopContentStyle,
        ]}
      >
        <SegmentedControl
          segments={["Chat", "Threads"]}
          selectedIndex={selectedIndex}
          onIndexChange={setSelectedIndex}
        />
        {connectionStatus !== "connected" && selectedIndex === 0 ? (
          <View style={styles.connectionStatus}>
            <View style={[styles.statusDot, { backgroundColor: connectionStatus === "connecting" ? theme.accent : theme.error }]} />
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {connectionStatus === "connecting" ? "Connecting..." : "Reconnecting..."}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {selectedIndex === 0 ? (
        <View style={[styles.chatWrapper, desktopContentStyle]}>
          <FlatList
            style={styles.chatList}
            contentContainerStyle={[
              styles.chatContent,
              displayMessages.length === 0 ? styles.emptyContent : null,
            ]}
            data={displayMessages.toReversed()}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            inverted={displayMessages.length > 0}
            ListEmptyComponent={renderEmptyChat}
            ListHeaderComponent={renderTypingIndicator}
            showsVerticalScrollIndicator={false}
          />
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: theme.backgroundDefault,
                paddingBottom: insets.bottom + Spacing.sm,
                borderTopColor: theme.border,
              },
            ]}
          >
            <TextInput
              style={[
                styles.messageInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                },
              ]}
              placeholder={placeholders.message}
              placeholderTextColor={theme.textMuted}
              value={messageInput}
              onChangeText={handleInputChange}
              multiline
              maxLength={2000}
              testID="input-message"
            />
            <Pressable
              onPress={handleSend}
              disabled={!messageInput.trim()}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: messageInput.trim() ? theme.primary : theme.backgroundTertiary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              testID="button-send"
            >
              <Feather
                name="send"
                size={20}
                color={messageInput.trim() ? "#FFFFFF" : theme.textMuted}
              />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.chatWrapper, desktopContentStyle]}>
          <FlatList
            style={styles.threadList}
            contentContainerStyle={[
              styles.threadContent,
              { paddingBottom: insets.bottom + Spacing.xl },
              threads.length === 0 ? styles.emptyContent : null,
            ]}
            data={threads}
            renderItem={renderThread}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={renderEmptyThreads}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              hotThreads.length > 0 ? (
                <View style={styles.hotSection}>
                  <View style={styles.hotSectionHeader}>
                    <Feather name="zap" size={16} color={theme.primary} />
                    <ThemedText type="h4" style={{ color: theme.primary }}>
                      {microcopy.hotThreads}
                    </ThemedText>
                  </View>
                  {hotThreads.map((thread) => (
                    <View key={`hot-${thread.id}`}>
                      {renderThread({ item: thread, isHot: true })}
                    </View>
                  ))}
                  <ThemedText type="h4" style={styles.allThreadsHeader}>
                    All Threads
                  </ThemedText>
                </View>
              ) : null
            }
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatWrapper: {
    flex: 1,
  },
  segmentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chatList: {
    flex: 1,
  },
  chatContent: {
    paddingVertical: Spacing.md,
  },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
  },
  typingIndicator: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  messageInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  threadList: {
    flex: 1,
  },
  threadContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  threadCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  threadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  threadTitle: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  threadBadges: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  threadMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  threadStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  replyCount: {
    marginLeft: 4,
    marginRight: Spacing.sm,
  },
  hotSection: {
    marginBottom: Spacing.lg,
  },
  hotSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  allThreadsHeader: {
    marginBottom: Spacing.md,
  },
  emptyChatContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
