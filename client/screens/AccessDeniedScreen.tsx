import React from "react";
import { View, StyleSheet, Pressable, Linking, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useEntitlements } from "@/lib/entitlements";

async function openExternal(url: string) {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank");
      return;
    }
    await WebBrowser.openBrowserAsync(url);
  } catch {
    try {
      await Linking.openURL(url);
    } catch {
      /* ignore */
    }
  }
}

export default function AccessDeniedScreen() {
  const { theme } = useTheme();
  const { manageBillingUrl } = useEntitlements();
  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <Card elevation={2} style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: theme.primary + "22" }]}>
          <Feather name="lock" size={28} color={theme.primary} />
        </View>
        <ThemedText type="h2" style={styles.title}>
          Access is managed by OperatorOS
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }} testID="text-access-denied-message">
          Access to this module is managed by OperatorOS. Contact your tenant administrator or upgrade your OperatorOS plan.
        </ThemedText>
        {/* The "Return to OperatorOS" button is always rendered so users
            always have a clear escape hatch back to OperatorOS even when the
            server hasn't been given OPERATOROS_BASE_URL. When the URL is
            missing the button is disabled and we surface a small hint. */}
        <Pressable
          onPress={() => {
            if (manageBillingUrl) void openExternal(manageBillingUrl);
          }}
          disabled={!manageBillingUrl}
          style={[
            styles.cta,
            { backgroundColor: manageBillingUrl ? theme.primary : theme.cardBorder },
            !manageBillingUrl ? { opacity: 0.6 } : null,
          ]}
          testID="button-return-to-operatoros"
          accessibilityRole="link"
          accessibilityLabel="Return to OperatorOS"
          accessibilityState={{ disabled: !manageBillingUrl }}
        >
          <Feather name="external-link" size={16} color="#0D0F12" />
          <ThemedText type="body" style={{ color: "#0D0F12", fontWeight: "700" }}>
            Return to OperatorOS
          </ThemedText>
        </Pressable>
        {!manageBillingUrl ? (
          <ThemedText type="caption" style={{ color: theme.textMuted, textAlign: "center" }}>
            OperatorOS URL is not configured on the server. Contact your administrator.
          </ThemedText>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  card: {
    maxWidth: 480,
    width: "100%",
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
  },
  cta: {
    marginTop: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    minHeight: 44,
  },
});
