import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TextInputProps,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightIconPress?: () => void;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  multiline,
  numberOfLines,
  ...props
}: InputProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? theme.error
    : isFocused
      ? theme.primary
      : theme.border;

  const isMultiline = multiline === true;

  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText type="small" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          {
            borderColor,
            backgroundColor: theme.backgroundDefault,
          },
          isMultiline && styles.multilineContainer,
        ]}
      >
        {leftIcon && !isMultiline ? (
          <Feather
            name={leftIcon}
            size={20}
            color={theme.textSecondary}
            style={styles.leftIcon}
          />
        ) : null}

        <TextInput
          style={[
            styles.input,
            { color: theme.text },
            leftIcon && !isMultiline ? { paddingLeft: 0 } : null,
            isMultiline && styles.multilineInput,
            style,
          ]}
          placeholderTextColor={theme.textSecondary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={isMultiline ? "top" : "center"}
          {...props}
        />

        {rightIcon ? (
          <Pressable onPress={onRightIconPress} style={styles.rightIcon}>
            <Feather name={rightIcon} size={20} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <ThemedText type="caption" style={[styles.error, { color: theme.error }]}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: BorderRadius.sm,
    minHeight: Spacing.inputHeight,
    paddingHorizontal: Spacing.md,
  },
  multilineContainer: {
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    minHeight: Spacing.inputHeight - Spacing.md,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: 0,
    paddingBottom: 0,
  },
  rightIcon: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  error: {
    marginTop: Spacing.xs,
  },
});
