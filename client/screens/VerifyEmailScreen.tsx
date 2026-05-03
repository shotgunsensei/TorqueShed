import React, { useMemo, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { MoreStackParamList } from "@/navigation/MoreStackNavigator";

interface MeResponse {
  email: string | null;
  emailVerifiedAt: string | null;
}

type Nav = NativeStackNavigationProp<MoreStackParamList>;

export default function VerifyEmailScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigation = useNavigation<Nav>();
  const [sentAt, setSentAt] = useState<Date | null>(null);

  const { data, isLoading } = useQuery<MeResponse>({ queryKey: ["/api/users/me"] });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/email/send-verification", {});
      return res.json();
    },
    onSuccess: (body) => {
      setSentAt(new Date());
      if (body?.alreadyVerified) {
        toast.show("Email already verified", "success");
        queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      } else {
        toast.show("Verification email sent", "success");
      }
    },
    onError: (err: Error) => {
      const msg = err?.message || "";
      if (msg.includes("429")) {
        toast.show("Too many requests. Try again later.", "error");
      } else if (msg.includes("400")) {
        toast.show("Add an email address first", "error");
      } else {
        toast.show("Failed to send verification email", "error");
      }
    },
  });

  const status = useMemo(() => {
    if (!data?.email) return "no_email" as const;
    if (data.emailVerifiedAt) return "verified" as const;
    return "pending" as const;
  }, [data]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <ThemedText type="h3" style={styles.heading}>
        Email verification
      </ThemedText>
      <ThemedText type="body" style={[styles.intro, { color: theme.textSecondary }]}>
        Confirming your email lets us deliver maintenance reminders and account
        notices reliably.
      </ThemedText>

      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(status, theme) }]} />
          <View style={styles.rowText}>
            <ThemedText type="h4">{statusLabel(status)}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {data?.email || "No email on file."}
            </ThemedText>
          </View>
        </View>
      </Card>

      {status === "no_email" ? (
        <Card style={styles.card}>
          <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
            Add your email under Notifications, then come back to verify it.
          </ThemedText>
          <Button onPress={() => navigation.navigate("NotificationSettings")} testID="button-open-notifications">
            Open Notifications
          </Button>
        </Card>
      ) : null}

      {status === "pending" ? (
        <Card style={styles.card}>
          <ThemedText type="h4">Send a verification link</ThemedText>
          <ThemedText type="small" style={[styles.fieldHelp, { color: theme.textSecondary }]}>
            We'll email a one-time link to {data?.email}. The link expires in 24 hours.
          </ThemedText>
          <Button
            onPress={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || isLoading}
            style={styles.actionBtn}
            testID="button-send-verification"
          >
            {sendMutation.isPending ? "Sending…" : sentAt ? "Resend verification email" : "Send verification email"}
          </Button>
          {sentAt ? (
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
              Last sent at {sentAt.toLocaleTimeString()}. Check your inbox and spam folder.
            </ThemedText>
          ) : null}
        </Card>
      ) : null}

      {status === "verified" ? (
        <Card style={styles.card}>
          <View style={styles.row}>
            <Feather name="check-circle" size={22} color={theme.success || "#22C55E"} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
              Verified on {data?.emailVerifiedAt ? new Date(data.emailVerifiedAt).toLocaleDateString() : "—"}.
            </ThemedText>
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function statusLabel(s: "no_email" | "pending" | "verified"): string {
  if (s === "verified") return "Verified";
  if (s === "pending") return "Awaiting verification";
  return "No email on file";
}

function statusColor(s: "no_email" | "pending" | "verified", theme: { primary: string; success?: string; textMuted: string }): string {
  if (s === "verified") return theme.success || "#22C55E";
  if (s === "pending") return theme.primary;
  return theme.textMuted;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { marginBottom: Spacing.xs },
  intro: { marginBottom: Spacing.lg },
  card: { marginBottom: Spacing.md, padding: Spacing.lg },
  row: { flexDirection: "row", alignItems: "center" },
  rowText: { flex: 1, marginLeft: Spacing.md },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: BorderRadius.full,
  },
  fieldHelp: { marginTop: Spacing.xs, marginBottom: Spacing.sm },
  actionBtn: { marginTop: Spacing.sm },
});
