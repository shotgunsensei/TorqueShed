import React, { type ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { Button } from "@/components/Button";
import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { BorderRadius, Spacing, Typography } from "@/constants/theme";

type IconName = keyof typeof Feather.glyphMap;

interface PageShellProps {
  children: ReactNode;
  maxWidth?: number;
  withHeaderOffset?: boolean;
  withTabBarOffset?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}

export function PageShell({
  children,
  maxWidth = 1120,
  withHeaderOffset = true,
  withTabBarOffset = true,
  contentContainerStyle,
  style,
}: PageShellProps) {
  const { theme } = useTheme();
  const { isDesktop } = useResponsive();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useSafeTabBarHeight();

  return (
    <ScrollView
      style={[styles.shell, { backgroundColor: theme.backgroundRoot }, style]}
      contentContainerStyle={[
        styles.shellContent,
        {
          paddingTop: withHeaderOffset ? headerHeight + Spacing.md : Spacing.lg,
          paddingBottom: withTabBarOffset ? tabBarHeight + Spacing.xl : Spacing.xl,
          maxWidth: isDesktop ? maxWidth : undefined,
          alignSelf: isDesktop ? "center" : undefined,
          width: isDesktop ? "100%" : undefined,
        },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

interface ResponsiveGridProps {
  children: ReactNode;
  minItemWidth?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

export function ResponsiveGrid({
  children,
  minItemWidth = 280,
  gap = Spacing.md,
  style,
}: ResponsiveGridProps) {
  const { width, isDesktop, isTablet } = useResponsive();
  const available = Math.max(width - Spacing.lg * 2, minItemWidth);
  const targetColumns = isDesktop ? 3 : isTablet ? 2 : 1;
  const columns = Math.max(1, Math.min(targetColumns, Math.floor(available / minItemWidth)));
  const basis: DimensionValue = `${100 / columns}%`;

  return (
    <View style={[styles.grid, { marginHorizontal: -gap / 2 }, style]}>
      {React.Children.map(children, (child, index) => (
        <View key={index} style={{ width: basis, paddingHorizontal: gap / 2, marginBottom: gap }}>
          {child}
        </View>
      ))}
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({
  title,
  eyebrow,
  description,
  icon,
  actionLabel,
  onAction,
  style,
}: SectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionTitleBlock}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: theme.primary }]}>{eyebrow}</Text>
        ) : null}
        <View style={styles.sectionTitleRow}>
          {icon ? <Feather name={icon} size={18} color={theme.primary} /> : null}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
        </View>
        {description ? (
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
            {description}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Button variant="outline" onPress={onAction} style={styles.sectionAction}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

interface HeroActionCardProps {
  title: string;
  description: string;
  icon?: IconName;
  actionLabel: string;
  onPress: () => void;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function HeroActionCard({
  title,
  description,
  icon = "activity",
  actionLabel,
  onPress,
  secondaryLabel,
  onSecondaryPress,
  style,
}: HeroActionCardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.heroCard,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.primary + "55",
        },
        style,
      ]}
    >
      <View style={styles.heroTopRow}>
        <View style={[styles.heroIcon, { backgroundColor: theme.primary + "18" }]}>
          <Feather name={icon} size={24} color={theme.primary} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.heroTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.heroDescription, { color: theme.textSecondary }]}>
            {description}
          </Text>
        </View>
      </View>
      <View style={styles.heroActions}>
        <Button onPress={onPress} style={styles.heroPrimary}>
          {actionLabel}
        </Button>
        {secondaryLabel && onSecondaryPress ? (
          <Button variant="outline" onPress={onSecondaryPress} style={styles.heroSecondary}>
            {secondaryLabel}
          </Button>
        ) : null}
      </View>
    </View>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: IconName;
  tone?: "default" | "primary" | "success" | "warning" | "error";
}

export function MetricCard({ label, value, icon = "bar-chart-2", tone = "default" }: MetricCardProps) {
  const { theme } = useTheme();
  const color =
    tone === "primary"
      ? theme.primary
      : tone === "success"
        ? theme.success
        : tone === "warning"
          ? theme.accent
          : tone === "error"
            ? theme.error
            : theme.text;

  return (
    <View style={[styles.metricCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
      <Feather name={icon} size={16} color={color} />
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

interface FixPathRailProps {
  steps: string[];
  currentIndex: number;
  style?: StyleProp<ViewStyle>;
}

export function FixPathRail({ steps, currentIndex, style }: FixPathRailProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.rail, style]}>
      {steps.map((step, index) => {
        const complete = index < currentIndex;
        const active = index === currentIndex;
        const color = complete ? theme.success : active ? theme.primary : theme.textMuted;
        return (
          <View key={step} style={styles.railItem}>
            <View
              style={[
                styles.railDot,
                {
                  backgroundColor: complete || active ? color : theme.backgroundSecondary,
                  borderColor: color,
                },
              ]}
            >
              {complete ? <Feather name="check" size={11} color="#FFFFFF" /> : null}
            </View>
            <Text style={[styles.railLabel, { color }]} numberOfLines={1}>
              {step}
            </Text>
            {index < steps.length - 1 ? (
              <View style={[styles.railLine, { backgroundColor: complete ? theme.success : theme.cardBorder }]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

interface EmptyStatePanelProps {
  icon?: IconName;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyStatePanel({
  icon = "clipboard",
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStatePanelProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.emptyPanel, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }, style]}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.primary + "18" }]}>
        <Feather name={icon} size={28} color={theme.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>{description}</Text>
      {actionLabel && onAction ? (
        <Button onPress={onAction} style={styles.emptyButton}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

interface ActionBarProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ActionBar({ children, style }: ActionBarProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.actionBar, { backgroundColor: theme.backgroundRoot, borderTopColor: theme.cardBorder }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  shellContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitleBlock: {
    flex: 1,
  },
  eyebrow: {
    ...Typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
  },
  sectionDescription: {
    ...Typography.small,
    marginTop: 2,
  },
  sectionAction: {
    minWidth: 112,
    height: 42,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    ...Typography.h2,
  },
  heroDescription: {
    ...Typography.body,
    marginTop: 4,
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  heroPrimary: {
    flexGrow: 1,
    minWidth: 160,
  },
  heroSecondary: {
    flexGrow: 1,
    minWidth: 150,
  },
  metricCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 96,
    justifyContent: "space-between",
  },
  metricValue: {
    ...Typography.h2,
    marginTop: Spacing.xs,
  },
  metricLabel: {
    ...Typography.caption,
  },
  rail: {
    flexDirection: "row",
    alignItems: "center",
  },
  railItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  railDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  railLabel: {
    ...Typography.caption,
    marginLeft: 6,
    fontWeight: "700",
    minWidth: 0,
  },
  railLine: {
    flex: 1,
    height: 1,
    marginHorizontal: Spacing.sm,
  },
  emptyPanel: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: "center",
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h3,
    textAlign: "center",
  },
  emptyDescription: {
    ...Typography.body,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  emptyButton: {
    marginTop: Spacing.lg,
    minWidth: 160,
  },
  actionBar: {
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
});
