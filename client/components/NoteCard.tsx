import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { VehicleNote } from "@/constants/vehicles";

interface NoteCardProps {
  note: VehicleNote;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function NoteCard({ note, onPress }: NoteCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: theme.cardBorder,
        },
        animatedStyle,
      ]}
      testID={`note-card-${note.id}`}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="file-text" size={16} color={theme.primary} />
          <ThemedText type="h4" style={styles.title} numberOfLines={1}>
            {note.title}
          </ThemedText>
        </View>
        {note.isPrivate ? (
          <Feather name="lock" size={14} color={theme.textSecondary} />
        ) : (
          <Feather name="globe" size={14} color={theme.textSecondary} />
        )}
      </View>

      <ThemedText
        type="small"
        numberOfLines={2}
        style={[styles.content, { color: theme.textSecondary }]}
      >
        {note.content}
      </ThemedText>

      <ThemedText
        type="caption"
        style={[styles.date, { color: theme.textSecondary }]}
      >
        {formatDate(note.createdAt)}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  title: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  content: {
    marginBottom: Spacing.sm,
  },
  date: {},
});
