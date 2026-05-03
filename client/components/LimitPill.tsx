import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Props {
  used: number;
  limit: number;
  noun: string;
  onPressAtLimit?: () => void;
  testID?: string;
}

export function LimitPill({ used, limit, noun, onPressAtLimit, testID }: Props) {
  const { theme } = useTheme();
  const atLimit = used >= limit;
  const bg = atLimit ? theme.primary + "22" : theme.backgroundTertiary;
  const fg = atLimit ? theme.primary : theme.textSecondary;
  const icon = atLimit ? "lock" : "bookmark";

  const inner = (
    <View style={[styles.pill, { backgroundColor: bg }]} testID={testID ?? `limit-pill-${noun}`}>
      <Feather name={icon} size={11} color={fg} />
      <ThemedText
        type="caption"
        style={{ color: fg, marginLeft: 4, fontWeight: "600" }}
      >
        {`${used} of ${limit} ${noun}`}
      </ThemedText>
    </View>
  );

  if (atLimit && onPressAtLimit) {
    return (
      <Pressable onPress={onPressAtLimit} testID={`${testID ?? `limit-pill-${noun}`}-pressable`}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
  },
});

export default LimitPill;
