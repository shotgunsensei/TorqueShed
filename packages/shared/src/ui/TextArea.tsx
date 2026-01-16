import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  ViewStyle, 
  TextInputProps 
} from 'react-native';
import { spacing, radius, typography } from '../brand/tokens';
import { darkTheme } from '../brand/theme';

export interface TextAreaProps extends Omit<TextInputProps, 'style' | 'multiline'> {
  label?: string;
  error?: string;
  hint?: string;
  rows?: number;
  maxLength?: number;
  showCount?: boolean;
  containerStyle?: ViewStyle;
}

const theme = darkTheme;

export function TextArea({
  label,
  error,
  hint,
  rows = 4,
  maxLength,
  showCount = false,
  containerStyle,
  value,
  ...props
}: TextAreaProps) {
  const [isFocused, setIsFocused] = useState(false);

  const getBorderColor = () => {
    if (error) return theme.danger;
    if (isFocused) return theme.borderFocus;
    return theme.border;
  };

  const charCount = value?.length || 0;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputContainer,
          { borderColor: getBorderColor(), minHeight: rows * 24 + spacing.md * 2 },
        ]}
      >
        <TextInput
          {...props}
          value={value}
          multiline
          textAlignVertical="top"
          maxLength={maxLength}
          style={styles.input}
          placeholderTextColor={theme.textMuted}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
        />
      </View>
      <View style={styles.footer}>
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : hint ? (
          <Text style={styles.hint}>{hint}</Text>
        ) : (
          <View />
        )}
        {showCount && maxLength ? (
          <Text style={[styles.count, charCount >= maxLength && styles.countMax]}>
            {charCount}/{maxLength}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodyMedium,
    color: theme.textSecondary,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    backgroundColor: theme.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.body,
    color: theme.text,
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  error: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: theme.danger,
  },
  hint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: theme.textMuted,
  },
  count: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.body,
    color: theme.textMuted,
  },
  countMax: {
    color: theme.danger,
  },
});
