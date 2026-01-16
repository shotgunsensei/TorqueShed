import React, { useState } from "react";
import { View, StyleSheet, FlatList, Pressable, TextInput, Platform, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { SegmentedControl } from "@/components/SegmentedControl";
import { MessageBubble } from "@/components/MessageBubble";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { SAMPLE_MESSAGES, SAMPLE_THREADS } from "@/constants/garages";
import { microcopy, placeholders } from "@/constants/brand";
import type { GaragesStackParamList } from "@/navigation/GaragesStackNavigator";

type RoutePropType = RouteProp<GaragesStackParamList, "GarageDetail">;

export default function GarageDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RoutePropType>();
  const { garageId, garageName } = route.params;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(SAMPLE_MESSAGES);

  const threads = SAMPLE_THREADS.filter((t) => t.garageId === garageId);

  const handleSend = () => {
    if (!message.trim()) return;
    const newMessage = {
      id: Date.now().toString(),
      userId: "current",
      userName: "You",
      message: message.trim(),
      timestamp: new Date(),
      isOwn: true,
    };
    setMessages((prev) => [...prev, newMessage]);
    setMessage("");
  };

  const renderMessage = ({ item }: { item: typeof SAMPLE_MESSAGES[0] }) => (
    <MessageBubble
      message={item.message}
      userName={item.userName}
      timestamp={item.timestamp}
      isOwn={item.isOwn}
    />
  );

  const renderThread = ({ item }: { item: typeof SAMPLE_THREADS[0] }) => (
    <Pressable
      style={({ pressed }) => [
        styles.threadCard,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: theme.cardBorder,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
      onPress={() => {}}
    >
      <ThemedText type="h4" numberOfLines={2}>
        {item.title}
      </ThemedText>
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
  );

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
      <ThemedText type="body" style={{ color: theme.textSecondary }}>
        Be the first to say something!
      </ThemedText>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View
        style={[styles.segmentContainer, { paddingTop: headerHeight + Spacing.md }]}
      >
        <SegmentedControl
          segments={["Chat", "Forums"]}
          selectedIndex={selectedIndex}
          onIndexChange={setSelectedIndex}
        />
      </View>

      {selectedIndex === 0 ? (
        <>
          <FlatList
            style={styles.chatList}
            contentContainerStyle={[
              styles.chatContent,
              messages.length === 0 ? styles.emptyContent : null,
            ]}
            data={messages.slice().reverse()}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            inverted={messages.length > 0}
            ListEmptyComponent={renderEmptyChat}
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
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={2000}
            />
            <Pressable
              onPress={handleSend}
              disabled={!message.trim()}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: message.trim() ? theme.primary : theme.backgroundTertiary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather
                name="send"
                size={20}
                color={message.trim() ? "#FFFFFF" : theme.textMuted}
              />
            </Pressable>
          </View>
        </>
      ) : (
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
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
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
  emptyChatContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
