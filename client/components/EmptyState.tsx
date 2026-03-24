import React from "react";
import { View, StyleSheet, Image, ImageSourcePropType } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface EmptyStateProps {
  icon?: keyof typeof Feather.glyphMap;
  image?: ImageSourcePropType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  image,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {icon ? (
        <View style={[styles.iconCircle, { backgroundColor: theme.primary + "15" }]}>
          <Feather name={icon} size={48} color={theme.primary} />
        </View>
      ) : image ? (
        <Image source={image} style={styles.image} resizeMode="contain" />
      ) : null}
      <ThemedText type="h2" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText
        type="body"
        style={[styles.description, { color: theme.textSecondary }]}
      >
        {description}
      </ThemedText>
      {actionLabel && onAction ? (
        <Button onPress={onAction} style={styles.button}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing["2xl"],
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  image: {
    width: 200,
    height: 200,
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  description: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  button: {
    minWidth: 160,
    paddingHorizontal: Spacing["2xl"],
  },
});
