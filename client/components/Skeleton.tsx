import React, { useEffect } from "react";
import { View, StyleSheet, ViewStyle, DimensionValue } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonBox({ width = "100%", height = 16, borderRadius = BorderRadius.sm, style }: SkeletonProps) {
  const { theme } = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.7]),
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.backgroundTertiary,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

function SkeletonCard({ style }: { style?: ViewStyle }) {
  return (
    <View style={[skeletonStyles.card, style]}>
      <View style={skeletonStyles.cardRow}>
        <SkeletonBox width={48} height={48} borderRadius={24} />
        <View style={skeletonStyles.cardContent}>
          <SkeletonBox width="70%" height={18} />
          <SkeletonBox width="40%" height={14} style={{ marginTop: Spacing.xs }} />
        </View>
      </View>
      <SkeletonBox width="100%" height={14} style={{ marginTop: Spacing.md }} />
      <SkeletonBox width="60%" height={14} style={{ marginTop: Spacing.xs }} />
    </View>
  );
}

function SkeletonList({ count = 4, style }: { count?: number; style?: ViewStyle }) {
  const { theme } = useTheme();

  return (
    <View style={[skeletonStyles.list, { backgroundColor: theme.backgroundRoot }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard
          key={i}
          style={{
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.cardBorder,
          }}
        />
      ))}
    </View>
  );
}

function SkeletonGrid({ count = 4, columns = 2, style }: { count?: number; columns?: number; style?: ViewStyle }) {
  const { theme } = useTheme();

  return (
    <View style={[skeletonStyles.grid, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[skeletonStyles.gridItem, { width: `${100 / columns - 2}%` as DimensionValue }]}>
          <View
            style={[
              skeletonStyles.gridCard,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <SkeletonBox width="100%" height={80} borderRadius={0} />
            <View style={skeletonStyles.gridCardContent}>
              <SkeletonBox width="60%" height={12} />
              <SkeletonBox width="80%" height={14} style={{ marginTop: Spacing.xs }} />
              <SkeletonBox width="40%" height={16} style={{ marginTop: Spacing.sm }} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export const Skeleton = {
  Box: SkeletonBox,
  Card: SkeletonCard,
  List: SkeletonList,
  Grid: SkeletonGrid,
};

const skeletonStyles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  list: {
    padding: Spacing.lg,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  gridItem: {},
  gridCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  gridCardContent: {
    padding: Spacing.md,
  },
});
