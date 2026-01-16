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
  focusAreas?: string[];
  yearsWrenching?: number | null;
}

export function MessageBubble({
  message,
  userName,
  timestamp,
  isOwn,
  showAvatar = true,
  focusAreas = [],
  yearsWrenching,
}: MessageBubbleProps) {
  const { theme } = useTheme();

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getCredibilityBadge = () => {
    if (!yearsWrenching && focusAreas.length === 0) return null;
    
    const parts: string[] = [];
    if (yearsWrenching && yearsWrenching > 0) {
      parts.push(`${yearsWrenching}yr`);
    }
    if (focusAreas.length > 0) {
      parts.push(focusAreas.slice(0, 2).join(", "));
    }
    return parts.join(" | ");
  };

  const credibilityBadge = getCredibilityBadge();

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
          <View style={styles.userInfo}>
            <ThemedText
              type="caption"
              style={[styles.userName, { color: theme.textSecondary }]}
            >
              {userName}
            </ThemedText>
            {credibilityBadge ? (
              <View style={[styles.credibilityBadge, { backgroundColor: theme.backgroundTertiary }]}>
                <ThemedText
                  type="small"
                  style={{ color: theme.textMuted }}
                >
                  {credibilityBadge}
                </ThemedText>
              </View>
            ) : null}
          </View>
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
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
    flexWrap: "wrap",
  },
  userName: {
    marginLeft: Spacing.xs,
  },
  credibilityBadge: {
    marginLeft: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
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
