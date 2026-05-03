import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useEntitlements } from "@/lib/entitlements";

const DISMISS_KEY_PREFIX = "trial_reminder_dismissed:";
const REMINDER_THRESHOLD_DAYS = 3;

interface TrialReminderBannerProps {
  onManageBilling: () => void;
}

export function TrialReminderBanner({ onManageBilling }: TrialReminderBannerProps) {
  const { theme } = useTheme();
  const { subscription } = useEntitlements();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  const trialEndsAt = subscription?.trialEndsAt ?? null;
  const status = subscription?.status;
  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;

  const trialEndsDate = trialEndsAt ? new Date(trialEndsAt) : null;
  const msLeft = trialEndsDate ? trialEndsDate.getTime() - Date.now() : 0;
  const daysLeft = trialEndsDate ? Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24))) : 0;

  const inWindow =
    status === "trialing" &&
    !cancelAtPeriodEnd &&
    trialEndsDate !== null &&
    msLeft > 0 &&
    daysLeft <= REMINDER_THRESHOLD_DAYS;

  const dismissKey = trialEndsAt ? `${DISMISS_KEY_PREFIX}${trialEndsAt}` : null;

  useEffect(() => {
    let cancelled = false;
    if (!dismissKey) {
      setDismissed(null);
      return;
    }
    AsyncStorage.getItem(dismissKey)
      .then((value) => {
        if (!cancelled) setDismissed(value === "1");
      })
      .catch(() => {
        if (!cancelled) setDismissed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dismissKey]);

  if (!inWindow) return null;
  if (dismissed === null || dismissed) return null;

  const handleDismiss = async () => {
    setDismissed(true);
    if (dismissKey) {
      try {
        await AsyncStorage.setItem(dismissKey, "1");
      } catch {}
    }
  };

  const countdownLabel =
    daysLeft <= 1
      ? "Your free trial ends within 24 hours"
      : `Your free trial ends in ${daysLeft} days`;

  return (
    <Card
      elevation={2}
      style={[
        styles.banner,
        { backgroundColor: theme.primary + "15", borderColor: theme.primary + "55" },
      ]}
      testID="banner-trial-reminder"
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: theme.primary + "25" }]}>
          <Feather name="clock" size={20} color={theme.primary} />
        </View>
        <View style={styles.text}>
          <ThemedText type="h4" testID="text-trial-reminder-title">
            {countdownLabel}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Your card will be charged automatically. Manage or cancel anytime in billing.
          </ThemedText>
        </View>
        <Pressable
          onPress={handleDismiss}
          hitSlop={10}
          style={styles.closeBtn}
          testID="button-dismiss-trial-reminder"
          accessibilityLabel="Dismiss trial reminder"
        >
          <Feather name="x" size={18} color={theme.textMuted} />
        </Pressable>
      </View>
      <Pressable
        onPress={onManageBilling}
        style={[styles.cta, { backgroundColor: theme.primary }]}
        testID="button-trial-reminder-manage-billing"
      >
        <Feather name="credit-card" size={16} color="#0D0F12" />
        <ThemedText type="body" style={{ color: "#0D0F12", fontWeight: "700" }}>
          Manage billing
        </ThemedText>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    gap: 2,
  },
  closeBtn: {
    padding: 4,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    minHeight: 44,
  },
});
