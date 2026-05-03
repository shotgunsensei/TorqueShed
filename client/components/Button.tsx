import React, { ReactNode } from "react";
import { StyleSheet, Pressable, ViewStyle, StyleProp, AccessibilityProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

interface ButtonProps {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  testID?: string;
  variant?: ButtonVariant;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityProps["accessibilityRole"];
  accessibilityState?: AccessibilityProps["accessibilityState"];
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
  energyThreshold: 0.001,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  onPress,
  children,
  style,
  disabled = false,
  testID,
  variant = "primary",
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  accessibilityState,
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const variantStyle: ViewStyle =
    variant === "outline"
      ? { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.link }
      : variant === "ghost"
      ? { backgroundColor: "transparent" }
      : variant === "secondary"
      ? { backgroundColor: theme.backgroundSecondary }
      : variant === "danger"
      ? { backgroundColor: "#EF4444" }
      : { backgroundColor: theme.link };

  const textColor =
    variant === "outline" || variant === "ghost"
      ? theme.link
      : variant === "secondary"
      ? theme.text
      : theme.buttonText;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.98, springConfig);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1, springConfig);
    }
  };

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      testID={testID}
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityLabel={
        accessibilityLabel ?? (typeof children === "string" ? children : undefined)
      }
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...(accessibilityState ?? {}) }}
      style={[
        styles.button,
        variantStyle,
        { opacity: disabled ? 0.5 : 1 },
        style,
        animatedStyle,
      ]}
    >
      <ThemedText
        type="body"
        style={[styles.buttonText, { color: textColor }]}
      >
        {children}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontWeight: "600",
  },
});
