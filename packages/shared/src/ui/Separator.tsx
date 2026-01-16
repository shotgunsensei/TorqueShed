import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { spacing } from '../brand/tokens';
import { darkTheme } from '../brand/theme';

export interface SeparatorProps {
  direction?: 'horizontal' | 'vertical';
  spacing?: 'none' | 'sm' | 'md' | 'lg';
  color?: string;
  style?: ViewStyle;
}

const theme = darkTheme;

const spacingMap = {
  none: 0,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
};

export function Separator({
  direction = 'horizontal',
  spacing: spacingProp = 'md',
  color = theme.border,
  style,
}: SeparatorProps) {
  const marginValue = spacingMap[spacingProp];

  return (
    <View
      style={[
        direction === 'horizontal' ? styles.horizontal : styles.vertical,
        {
          backgroundColor: color,
          ...(direction === 'horizontal'
            ? { marginVertical: marginValue }
            : { marginHorizontal: marginValue }),
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  horizontal: {
    height: 1,
    width: '100%',
  },
  vertical: {
    width: 1,
    height: '100%',
  },
});
