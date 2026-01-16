import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle, PressableProps } from 'react-native';
import { spacing, radius, elevation } from '../brand/tokens';
import { darkTheme } from '../brand/theme';

export interface CardProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  pressable?: boolean;
  style?: ViewStyle;
}

const theme = darkTheme;

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  pressable = false,
  style,
  onPress,
  ...props
}: CardProps) {
  const getBackgroundColor = (pressed: boolean) => {
    if (pressed && pressable) return theme.surfaceHover;
    return variant === 'elevated' ? theme.bgElevated : theme.surface;
  };

  const getPadding = () => {
    switch (padding) {
      case 'none': return 0;
      case 'sm': return spacing.sm;
      case 'md': return spacing.md;
      case 'lg': return spacing.lg;
    }
  };

  const baseStyle: ViewStyle = {
    borderRadius: radius.lg,
    padding: getPadding(),
    borderWidth: variant === 'outlined' ? 1 : 0,
    borderColor: theme.border,
    ...(variant === 'elevated' ? elevation.md : {}),
  };

  if (pressable || onPress) {
    return (
      <Pressable
        {...props}
        onPress={onPress}
        style={({ pressed }) => [
          baseStyle,
          { backgroundColor: getBackgroundColor(pressed) },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[baseStyle, { backgroundColor: getBackgroundColor(false) }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({});
