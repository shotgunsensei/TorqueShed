import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SegmentedControlProps {
  segments: string[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
}

export function SegmentedControl({
  segments,
  selectedIndex,
  onIndexChange,
}: SegmentedControlProps) {
  const { theme } = useTheme();

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withTiming(
          (selectedIndex * 100) / segments.length + "%",
          { duration: 200 }
        ),
      },
    ],
  }));

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}
    >
      <Animated.View
        style={[
          styles.indicator,
          {
            width: `${100 / segments.length}%`,
            backgroundColor: theme.backgroundDefault,
          },
          indicatorStyle,
        ]}
      />
      {segments.map((segment, index) => (
        <Pressable
          key={segment}
          style={styles.segment}
          onPress={() => onIndexChange(index)}
        >
          <ThemedText
            type="small"
            style={[
              styles.segmentText,
              {
                color:
                  index === selectedIndex ? theme.text : theme.textSecondary,
                fontWeight: index === selectedIndex ? "600" : "400",
              },
            ]}
          >
            {segment}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    padding: 3,
    position: "relative",
  },
  indicator: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: BorderRadius.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  segmentText: {
    textAlign: "center",
  },
});
