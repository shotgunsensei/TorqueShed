import React, { useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { SegmentedControl } from "@/components/SegmentedControl";
import { MessageBubble } from "@/components/MessageBubble";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { SAMPLE_MESSAGES, SAMPLE_THREADS } from "@/constants/garages";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type RoutePropType = RouteProp<RootStackParamList, "GarageDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function GarageDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  const { garage } = route.params;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(SAMPLE_MESSAGES);

  const threads = SAMPLE_THREADS.filter((t) => t.garageId === garage.id);

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
      style={[
        styles.threadCard,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: theme.cardBorder,
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
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
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
            <Input
              placeholder="Type a message..."
              value={message}
              onChangeText={setMessage}
              style={styles.messageInput}
              rightIcon="send"
              onRightIconPress={handleSend}
            />
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
    </View>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  messageInput: {
    marginBottom: 0,
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
