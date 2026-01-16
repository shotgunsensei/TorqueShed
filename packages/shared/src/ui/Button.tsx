import React from 'react';
import { 
  Pressable, 
  Text, 
  StyleSheet, 
  ViewStyle, 
  TextStyle, 
  ActivityIndicator,
  PressableProps 
} from 'react-native';
import { spacing, radius, typography } from '../brand/tokens';
import { darkTheme } from '../brand/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const theme = darkTheme;

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  style,
  textStyle,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const getBackgroundColor = (pressed: boolean) => {
    if (isDisabled) return theme.surfaceActive;
    switch (variant) {
      case 'primary':
        return pressed ? theme.primaryHover : theme.primary;
      case 'secondary':
        return pressed ? theme.surfaceActive : theme.surface;
      case 'ghost':
        return pressed ? theme.surfaceHover : 'transparent';
      case 'danger':
        return pressed ? '#DC2626' : theme.danger;
    }
  };

  const getTextColor = () => {
    if (isDisabled) return theme.textMuted;
    switch (variant) {
      case 'primary':
      case 'danger':
        return '#FFFFFF';
      case 'secondary':
      case 'ghost':
        return theme.text;
    }
  };

  const getBorderColor = () => {
    if (variant === 'secondary') return theme.border;
    return 'transparent';
  };

  const sizeStyles = {
    sm: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSize.sm },
    md: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: typography.fontSize.md },
    lg: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, fontSize: typography.fontSize.lg },
  };

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: getBackgroundColor(pressed),
          borderColor: getBorderColor(),
          paddingHorizontal: sizeStyles[size].paddingHorizontal,
          paddingVertical: sizeStyles[size].paddingVertical,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          {leftIcon}
          <Text
            style={[
              styles.text,
              { color: getTextColor(), fontSize: sizeStyles[size].fontSize },
              leftIcon ? { marginLeft: spacing.sm } : undefined,
              rightIcon ? { marginRight: spacing.sm } : undefined,
              textStyle,
            ]}
          >
            {title}
          </Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    fontFamily: typography.fontFamily.bodySemiBold,
    textAlign: 'center',
  },
});
