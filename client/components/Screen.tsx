import React, { ReactNode } from "react";
import { View, ScrollView, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  keyboardAware?: boolean;
  edges?: ("top" | "bottom" | "left" | "right")[];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  withTabBar?: boolean;
  transparentHeader?: boolean;
}

export function Screen({
  children,
  scroll = true,
  keyboardAware = false,
  edges = ["top", "bottom"],
  style,
  contentContainerStyle,
  withTabBar = true,
  transparentHeader = true,
}: ScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useSafeTabBarHeight();

  const topPadding = edges.includes("top")
    ? transparentHeader
      ? headerHeight + Spacing.md
      : Spacing.md
    : 0;

  const bottomPadding = edges.includes("bottom")
    ? withTabBar
      ? tabBarHeight + Spacing.lg
      : insets.bottom + Spacing.lg
    : 0;

  const paddingStyle = {
    paddingTop: topPadding,
    paddingBottom: bottomPadding,
  };

  if (!scroll) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.backgroundRoot },
          paddingStyle,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  if (keyboardAware) {
    return (
      <KeyboardAwareScrollViewCompat
        style={[styles.container, { backgroundColor: theme.backgroundRoot }, style]}
        contentContainerStyle={[
          styles.contentContainer,
          paddingStyle,
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </KeyboardAwareScrollViewCompat>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }, style]}
      contentContainerStyle={[
        styles.contentContainer,
        paddingStyle,
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      bounces
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
});
