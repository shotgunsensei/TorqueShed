import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { radius } from '../brand/tokens';
import { darkTheme } from '../brand/theme';

export interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  variant?: 'text' | 'circular' | 'rectangular';
  style?: ViewStyle;
}

const theme = darkTheme;

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius: customRadius,
  variant = 'rectangular',
  style,
}: SkeletonProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const getBorderRadius = () => {
    if (customRadius !== undefined) return customRadius;
    switch (variant) {
      case 'circular':
        return typeof height === 'number' ? height / 2 : radius.full;
      case 'text':
        return radius.sm;
      default:
        return radius.md;
    }
  };

  const getWidth = () => {
    if (variant === 'circular' && typeof height === 'number') {
      return height;
    }
    return width;
  };

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: getWidth(),
          height,
          borderRadius: getBorderRadius(),
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.textContainer}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={14}
          width={index === lines - 1 ? '60%' : '100%'}
          variant="text"
          style={index < lines - 1 ? styles.textLine : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: theme.surfaceActive,
  },
  textContainer: {
    width: '100%',
  },
  textLine: {
    marginBottom: 8,
  },
});
