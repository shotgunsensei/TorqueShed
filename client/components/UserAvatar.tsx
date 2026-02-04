import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius } from "@/constants/theme";

interface User {
  id?: string;
  username?: string;
  avatarUrl?: string | null;
  role?: string | null;
}

interface UserAvatarProps {
  user?: User | null;
  size?: "sm" | "md" | "lg";
  showFallbackIcon?: boolean;
}

const SIZES = {
  sm: 32,
  md: 40,
  lg: 64,
};

export function UserAvatar({ user, size = "md", showFallbackIcon = true }: UserAvatarProps) {
  const { theme } = useTheme();
  const sizeValue = SIZES[size];
  const iconSize = size === "sm" ? 14 : size === "md" ? 18 : 28;
  const fontSize = size === "sm" ? 12 : size === "md" ? 16 : 24;

  const initial = user?.username?.charAt(0)?.toUpperCase() || "";

  if (user?.avatarUrl) {
    return (
      <Image
        source={{ uri: user.avatarUrl }}
        style={[
          styles.avatar,
          {
            width: sizeValue,
            height: sizeValue,
            borderRadius: sizeValue / 2,
          },
        ]}
      />
    );
  }

  if (initial) {
    return (
      <View
        style={[
          styles.avatarPlaceholder,
          {
            width: sizeValue,
            height: sizeValue,
            borderRadius: sizeValue / 2,
            backgroundColor: theme.primary + "20",
          },
        ]}
      >
        <ThemedText
          type="body"
          style={{ color: theme.primary, fontSize, fontWeight: "600" }}
        >
          {initial}
        </ThemedText>
      </View>
    );
  }

  if (showFallbackIcon) {
    return (
      <View
        style={[
          styles.avatarPlaceholder,
          {
            width: sizeValue,
            height: sizeValue,
            borderRadius: sizeValue / 2,
            backgroundColor: theme.backgroundTertiary,
          },
        ]}
      >
        <Feather name="user" size={iconSize} color={theme.textSecondary} />
      </View>
    );
  }

  return null;
}

export function getUserRoleDisplay(role?: string | null): string | null {
  if (!role) return null;
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Moderator";
  return null;
}

const styles = StyleSheet.create({
  avatar: {
    resizeMode: "cover",
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
});
