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
        <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
          Access to this module is managed by OperatorOS. Your workspace
          doesn't currently have TorqueShed enabled — open OperatorOS to
          enable it or contact your workspace administrator.
        </ThemedText>
        {manageBillingUrl ? (
          <Pressable
            onPress={() => openExternal(manageBillingUrl)}
            style={[styles.cta, { backgroundColor: theme.primary }]}
            testID="button-return-to-operatoros"
            accessibilityRole="link"
            accessibilityLabel="Return to OperatorOS"
          >
            <Feather name="external-link" size={16} color="#0D0F12" />
            <ThemedText type="body" style={{ color: "#0D0F12", fontWeight: "700" }}>
              Return to OperatorOS
            </ThemedText>
          </Pressable>
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
