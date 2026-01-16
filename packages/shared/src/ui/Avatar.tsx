import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { spacing, radius, typography } from '../brand/tokens';
import { darkTheme } from '../brand/theme';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  source?: string | null;
  name?: string;
  size?: AvatarSize;
  showOnline?: boolean;
  style?: ViewStyle;
}

const theme = darkTheme;

const sizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const fontSizeMap = {
  xs: typography.fontSize.xs,
  sm: typography.fontSize.sm,
  md: typography.fontSize.md,
  lg: typography.fontSize.xl,
  xl: typography.fontSize.xxxl,
};

export function Avatar({
  source,
  name,
  size = 'md',
  showOnline = false,
  style,
}: AvatarProps) {
  const dimension = sizeMap[size];

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const getBackgroundColor = (name?: string) => {
    if (!name) return theme.surfaceActive;
    const colors = [
      '#FF6B35', '#22C55E', '#3B82F6', '#F59E0B', 
      '#7C3AED', '#0891B2', '#65A30D', '#EC4899'
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: source ? theme.surface : getBackgroundColor(name),
        },
        style,
      ]}
    >
      {source ? (
        <Image
          source={{ uri: source }}
          style={[styles.image, { borderRadius: dimension / 2 }]}
          contentFit="cover"
        />
      ) : (
        <Text
          style={[
            styles.initials,
            { fontSize: fontSizeMap[size] },
          ]}
        >
          {getInitials(name)}
        </Text>
      )}
      {showOnline ? (
        <View
          style={[
            styles.onlineIndicator,
            {
              width: dimension * 0.3,
              height: dimension * 0.3,
              borderRadius: dimension * 0.15,
              borderWidth: dimension * 0.06,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initials: {
    fontFamily: typography.fontFamily.headingSemiBold,
    color: '#FFFFFF',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.success,
    borderColor: theme.bg,
  },
});
