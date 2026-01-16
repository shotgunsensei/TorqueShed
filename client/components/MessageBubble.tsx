import React from "react";
import { View, StyleSheet, Image } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface MessageBubbleProps {
  message: string;
  userName: string;
  timestamp: Date;
  isOwn: boolean;
  showAvatar?: boolean;
}

export function MessageBubble({
  message,
  userName,
  timestamp,
  isOwn,
  showAvatar = true,
}: MessageBubbleProps) {
  const { theme } = useTheme();

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : null]}>
      {!isOwn && showAvatar ? (
        <View
          style={[
            styles.avatar,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <Image
            source={require("../../assets/images/avatar-default.png")}
            style={styles.avatarImage}
          />
        </View>
      ) : null}

      <View style={styles.bubbleWrapper}>
        {!isOwn ? (
          <ThemedText
            type="caption"
            style={[styles.userName, { color: theme.textSecondary }]}
          >
            {userName}
          </ThemedText>
        ) : null}

        <View
          style={[
            styles.bubble,
            isOwn
              ? { backgroundColor: theme.primary }
              : { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <ThemedText
            type="body"
            style={{ color: isOwn ? "#FFFFFF" : theme.text }}
          >
            {message}
          </ThemedText>
        </View>

        <ThemedText
          type="caption"
          style={[
            styles.timestamp,
            { color: theme.textSecondary },
            isOwn ? styles.ownTimestamp : null,
          ]}
        >
          {formatTime(timestamp)}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  ownContainer: {
    flexDirection: "row-reverse",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: Spacing.sm,
    overflow: "hidden",
  },
  avatarImage: {
    width: 32,
    height: 32,
  },
  bubbleWrapper: {
    maxWidth: "75%",
  },
  userName: {
    marginBottom: 2,
    marginLeft: Spacing.xs,
  },
  bubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  timestamp: {
    marginTop: 2,
    marginLeft: Spacing.xs,
  },
  ownTimestamp: {
    marginLeft: 0,
    marginRight: Spacing.xs,
    textAlign: "right",
  },
});
