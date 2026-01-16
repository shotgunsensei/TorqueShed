import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BrandColors, BorderRadius } from "@/constants/theme";

interface GarageBadgeProps {
  brandKey: keyof typeof BrandColors;
  size?: number;
}

export function GarageBadge({ brandKey, size = 32 }: GarageBadgeProps) {
  const color = BrandColors[brandKey];

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    >
      <Feather name="tool" size={size * 0.5} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
  },
});
