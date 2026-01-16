import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { GarageBadge } from "@/components/GarageBadge";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BrandColors, Shadows } from "@/constants/theme";
import type { Garage } from "@/constants/garages";

interface GarageCardProps {
  garage: Garage;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GarageCard({ garage, onPress }: GarageCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
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
      testID={`garage-card-${garage.id}`}
    >
      <View style={styles.header}>
        <GarageBadge brandKey={garage.brandKey} size={40} />
        <View style={styles.activeIndicator}>
          <View style={[styles.activeDot, { backgroundColor: theme.success }]} />
          <ThemedText style={[styles.activeText, { color: theme.textSecondary }]}>
            {garage.activeNow} online
          </ThemedText>
        </View>
      </View>

      <ThemedText type="h3" style={styles.name} numberOfLines={1}>
        {garage.name}
      </ThemedText>

      <ThemedText
        type="small"
        style={[styles.description, { color: theme.textSecondary }]}
        numberOfLines={2}
      >
        {garage.description}
      </ThemedText>

      <View style={styles.footer}>
        <Feather name="users" size={14} color={theme.textSecondary} />
        <ThemedText style={[styles.memberCount, { color: theme.textSecondary }]}>
          {garage.memberCount.toLocaleString()} members
        </ThemedText>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: 160,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  activeIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.xs,
  },
  activeText: {
    fontSize: 11,
  },
  name: {
    marginBottom: Spacing.xs,
  },
  description: {
    flex: 1,
    marginBottom: Spacing.md,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
  },
  memberCount: {
    fontSize: 12,
    marginLeft: Spacing.xs,
  },
});
