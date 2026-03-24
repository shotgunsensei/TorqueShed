import React, { useState } from "react";
import { View, StyleSheet, Modal, Pressable, TextInput, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: "forum_thread" | "forum_reply" | "user";
  contentId?: string;
  reportedUserId?: string;
}

const REPORT_REASONS = [
  { id: "spam", label: "Spam or advertising" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "scam", label: "Scam or fraud" },
  { id: "illegal", label: "Illegal content" },
  { id: "impersonation", label: "Impersonation" },
  { id: "other", label: "Other" },
];

export function ReportModal({
  visible,
  onClose,
  contentType,
  contentId,
  reportedUserId,
}: ReportModalProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");

  const reportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/reports", {
        reportedUserId,
        contentType,
        contentId,
        reason: selectedReason,
        details: details.trim() || null,
      });
      return response.json();
    },
    onSuccess: () => {
      onClose();
      setSelectedReason(null);
      setDetails("");
    },
  });

  const handleSubmit = () => {
    if (!selectedReason) return;
    reportMutation.mutate();
  };

  const handleClose = () => {
    onClose();
    setSelectedReason(null);
    setDetails("");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={16}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3" style={styles.title}>
            Report Content
          </ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            Why are you reporting this?
          </ThemedText>

          {REPORT_REASONS.map((reason) => (
            <Pressable
              key={reason.id}
              style={[
                styles.reasonOption,
                {
                  backgroundColor:
                    selectedReason === reason.id
                      ? theme.primary + "20"
                      : theme.backgroundDefault,
                  borderColor:
                    selectedReason === reason.id ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setSelectedReason(reason.id)}
            >
              <ThemedText type="body">{reason.label}</ThemedText>
              {selectedReason === reason.id ? (
                <Feather name="check" size={20} color={theme.primary} />
              ) : null}
            </Pressable>
          ))}

          <ThemedText
            type="caption"
            style={[styles.detailsLabel, { color: theme.textSecondary }]}
          >
            Additional details (optional)
          </ThemedText>
          <TextInput
            style={[
              styles.detailsInput,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Provide more context..."
            placeholderTextColor={theme.textMuted}
            value={details}
            onChangeText={setDetails}
            multiline
            maxLength={500}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            onPress={handleSubmit}
            disabled={!selectedReason || reportMutation.isPending}
          >
            {reportMutation.isPending ? "Submitting..." : "Submit Report"}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  subtitle: {
    marginBottom: Spacing.lg,
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  detailsLabel: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  detailsInput: {
    minHeight: 100,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
});
