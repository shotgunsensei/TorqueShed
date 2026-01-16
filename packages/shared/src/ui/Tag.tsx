import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { spacing, radius, typography } from '../brand/tokens';
import { darkTheme, badgeColors, BadgeType } from '../brand/theme';

export type TagVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'badge';

export interface TagProps {
  label: string;
  variant?: TagVariant;
  badgeType?: BadgeType;
  size?: 'sm' | 'md';
  removable?: boolean;
  onRemove?: () => void;
  onPress?: () => void;
  style?: ViewStyle;
}

const theme = darkTheme;

export function Tag({
  label,
  variant = 'default',
  badgeType,
  size = 'sm',
  removable = false,
  onRemove,
  onPress,
  style,
}: TagProps) {
  const getBackgroundColor = () => {
    if (variant === 'badge' && badgeType) {
      return badgeColors[badgeType] + '20';
    }
    switch (variant) {
      case 'primary': return theme.primaryMuted;
      case 'success': return theme.successMuted;
      case 'warning': return theme.warningMuted;
      case 'danger': return theme.dangerMuted;
      default: return theme.surfaceActive;
    }
  };

  const getTextColor = () => {
    if (variant === 'badge' && badgeType) {
      return badgeColors[badgeType];
    }
    switch (variant) {
      case 'primary': return theme.primary;
      case 'success': return theme.success;
      case 'warning': return theme.warning;
      case 'danger': return theme.danger;
      default: return theme.textSecondary;
    }
  };

  const sizeStyles = {
    sm: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
      fontSize: typography.fontSize.xs,
    },
    md: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      fontSize: typography.fontSize.sm,
    },
  };

  const content = (
    <>
      <Text
        style={[
          styles.label,
          { color: getTextColor(), fontSize: sizeStyles[size].fontSize },
        ]}
      >
        {label}
      </Text>
      {removable ? (
        <Pressable onPress={onRemove} hitSlop={8} style={styles.removeButton}>
          <Text style={[styles.removeIcon, { color: getTextColor() }]}>x</Text>
        </Pressable>
      ) : null}
    </>
  );

  const containerStyle: ViewStyle[] = [
    styles.container,
    {
      backgroundColor: getBackgroundColor(),
      paddingHorizontal: sizeStyles[size].paddingHorizontal,
      paddingVertical: sizeStyles[size].paddingVertical,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable style={containerStyle} onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: typography.fontFamily.bodyMedium,
  },
  removeButton: {
    marginLeft: spacing.xs,
  },
  removeIcon: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodySemiBold,
  },
});
