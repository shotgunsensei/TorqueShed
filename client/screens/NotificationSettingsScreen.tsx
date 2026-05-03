import React, { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Switch, Platform } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { apiRequest } from "@/lib/query-client";
import { Spacing } from "@/constants/theme";

interface NotificationPrefs {
  email: string | null;
  expoPushToken: string | null;
  notificationsEnabled: boolean;
  dailyLeadDigestEnabled?: boolean;
  canUseLeadDigest?: boolean;
}

export default function NotificationSettingsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<NotificationPrefs>({
    queryKey: ["/api/users/me/notifications"],
  });

  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [digestEnabled, setDigestEnabled] = useState(false);

  useEffect(() => {
    if (data) {
      setEmail(data.email ?? "");
      setEnabled(data.notificationsEnabled ?? true);
      setDigestEnabled(data.dailyLeadDigestEnabled ?? false);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (body: Partial<NotificationPrefs>) => {
      const res = await apiRequest("PATCH", "/api/users/me/notifications", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      toast.show("Notification settings saved", "success");
    },
    onError: () => toast.show("Failed to save settings", "error"),
  });

  const onSave = () => {
    const trimmed = email.trim();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.show("Please enter a valid email", "error");
      return;
    }
    mutation.mutate({ email: trimmed, notificationsEnabled: enabled });
  };

  const onToggle = (next: boolean) => {
    setEnabled(next);
    mutation.mutate({ notificationsEnabled: next });
  };

  const onToggleDigest = (next: boolean) => {
    setDigestEnabled(next);
    mutation.mutate({ dailyLeadDigestEnabled: next });
  };

  const pushStatus = data?.expoPushToken
    ? "Push notifications registered for this device"
    : Platform.OS === "web"
      ? "Push not available on web — open the app to register your device"
      : "Push token not yet registered. Reopen the app and grant notifications.";

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
        Maintenance Reminders
      </ThemedText>
      <ThemedText type="body" style={[styles.intro, { color: theme.textSecondary }]}>
        Garage Pro and Shop Pro members get a once-per-item reminder when service
        is due, by push if available and otherwise email.
      </ThemedText>

      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <ThemedText type="h4">Reminders enabled</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Turn off to stop all reminder delivery.
            </ThemedText>
          </View>
          <Switch
            value={enabled}
            onValueChange={onToggle}
            disabled={isLoading || mutation.isPending}
            testID="switch-notifications-enabled"
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <ThemedText type="h4">Email for reminders</ThemedText>
        <ThemedText type="small" style={[styles.fieldHelp, { color: theme.textSecondary }]}>
          Used as a fallback when push delivery isn't available.
        </ThemedText>
        <Input
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          testID="input-reminder-email"
        />
        <Button
          onPress={onSave}
          disabled={mutation.isPending}
          style={styles.saveBtn}
          testID="button-save-notifications"
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </Card>

      {data?.canUseLeadDigest ? (
        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <ThemedText type="h4">Daily lead digest email</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Get yesterday's leads emailed each morning as a CSV the front
                desk can use to run the call list. Requires Shop Pro and a
                saved email above.
              </ThemedText>
            </View>
            <Switch
              value={digestEnabled}
              onValueChange={onToggleDigest}
              disabled={isLoading || mutation.isPending || !enabled || !(data?.email)}
              testID="switch-daily-lead-digest"
            />
          </View>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <ThemedText type="h4">Push device</ThemedText>
        <ThemedText type="small" style={[styles.fieldHelp, { color: theme.textSecondary }]}>
          {pushStatus}
        </ThemedText>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { marginBottom: Spacing.xs },
  intro: { marginBottom: Spacing.lg },
  card: { marginBottom: Spacing.md, padding: Spacing.lg },
  row: { flexDirection: "row", alignItems: "center" },
  rowText: { flex: 1, marginRight: Spacing.md },
  fieldHelp: { marginTop: Spacing.xs, marginBottom: Spacing.sm },
  saveBtn: { marginTop: Spacing.sm },
});
