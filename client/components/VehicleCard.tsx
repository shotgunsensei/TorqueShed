import React from "react";
import { View, StyleSheet, Pressable, Image } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import type { Vehicle } from "@/constants/vehicles";

interface VehicleCardProps {
  vehicle: Vehicle;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function VehicleCard({ vehicle, onPress }: VehicleCardProps) {
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

  const displayName = vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

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
      testID={`vehicle-card-${vehicle.id}`}
    >
      <View style={[styles.imageContainer, { backgroundColor: theme.backgroundSecondary }]}>
        {vehicle.imageUri ? (
          <Image source={{ uri: vehicle.imageUri }} style={styles.image} />
        ) : (
          <Feather name="truck" size={32} color={theme.textSecondary} />
        )}
      </View>

      <View style={styles.content}>
        <ThemedText type="h4" numberOfLines={1}>
          {displayName}
        </ThemedText>
        
        {vehicle.nickname ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </ThemedText>
        ) : null}

        {vehicle.vin ? (
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            VIN: ...{vehicle.vin.slice(-6)}
          </ThemedText>
        ) : null}

        <View style={styles.notesRow}>
          <Feather name="file-text" size={14} color={theme.primary} />
          <ThemedText style={[styles.notesText, { color: theme.primary }]}>
            {vehicle.notesCount} notes
          </ThemedText>
        </View>
      </View>

      <Feather name="chevron-right" size={20} color={theme.textSecondary} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  imageContainer: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.sm,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  notesRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  notesText: {
    fontSize: 13,
    fontWeight: "500",
    marginLeft: Spacing.xs,
  },
});
