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
  name: {
    marginBottom: Spacing.xs,
  },
  description: {
    flex: 1,
    marginBottom: Spacing.md,
  },
});
