import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

type BadgeVariant = "default" | "success" | "warning" | "error" | "primary" | "muted";

interface StatusBadgeProps {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  color?: string;
  backgroundColor?: string;
}

export function StatusBadge({
  label,
  icon,
  variant = "default",
  size = "sm",
  color: customColor,
  backgroundColor: customBg,
}: StatusBadgeProps) {
  const { theme } = useTheme();

  const variantColors: Record<BadgeVariant, { color: string; bg: string }> = {
    default: { color: theme.textSecondary, bg: theme.backgroundTertiary },
    success: { color: theme.success, bg: theme.success + "15" },
    warning: { color: theme.accent, bg: theme.accent + "15" },
    error: { color: theme.error, bg: theme.error + "15" },
    primary: { color: theme.primary, bg: theme.primary + "15" },
    muted: { color: theme.textMuted, bg: theme.backgroundSecondary },
  };

  const colors = variantColors[variant];
  const textColor = customColor || colors.color;
  const bgColor = customBg || colors.bg;
  const isSm = size === "sm";

  return (
    <View style={[styles.badge, isSm ? styles.badgeSm : styles.badgeMd, { backgroundColor: bgColor }]}>
      {icon ? (
        <Feather name={icon} size={isSm ? 10 : 12} color={textColor} />
      ) : null}
      <Text style={[isSm ? styles.textSm : styles.textMd, { color: textColor }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: Spacing.xxs,
  },
  badgeSm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  badgeMd: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  textSm: {
    ...Typography.caption,
    fontFamily: "Inter_500Medium",
  },
  textMd: {
    ...Typography.small,
    fontFamily: "Inter_500Medium",
  },
});
