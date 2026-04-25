import React, { useState } from "react";
import { View, Text, StyleSheet, Switch, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ThemedText } from "@/components/ThemedText";
import { LockedFeature } from "@/components/LockedFeature";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { useEntitlements } from "@/lib/entitlements";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { NoteType } from "@/constants/vehicles";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type RoutePropType = RouteProp<RootStackParamList, "AddNote">;

const NOTE_TYPES: { key: NoteType; label: string; icon: string; color: string; description: string }[] = [
  { key: "maintenance", label: "Maintenance", icon: "settings", color: "#3B82F6", description: "Oil changes, brake jobs, fluid flushes" },
  { key: "mod", label: "Mod", icon: "zap", color: "#8B5CF6", description: "Upgrades, performance parts, cosmetics" },
  { key: "issue", label: "Issue", icon: "alert-triangle", color: "#EF4444", description: "Problems, diagnostics, things to fix" },
  { key: "general", label: "General", icon: "file-text", color: "#6B7280", description: "Notes, reminders, anything else" },
];

export default function AddNoteScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RoutePropType>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { vehicleId } = route.params;
  const { hasFeature } = useEntitlements();
  const canTrackMaintenance = hasFeature("maintenance_tracking");

  const [type, setType] = useState<NoteType>("general");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [cost, setCost] = useState("");
  const [mileage, setMileage] = useState("");
  const [partsInput, setPartsInput] = useState("");
  const [beforeState, setBeforeState] = useState("");
  const [afterState, setAfterState] = useState("");
  const [nextDueMileage, setNextDueMileage] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);

  const showCostField = type === "maintenance" || type === "mod";
  const showMileageField = type === "maintenance" || type === "issue";
  const showPartsField = type === "maintenance" || type === "mod";
  const showBeforeAfter = type === "mod";
  const showNextDue = type === "maintenance";

  const createNoteMutation = useMutation({
    mutationFn: async () => {
      const partsUsed = partsInput.trim()
        ? partsInput.split(",").map((p) => p.trim()).filter(Boolean)
        : null;
      return apiRequest("POST", `/api/vehicles/${vehicleId}/notes`, {
        title: title.trim(),
        content: content.trim(),
        type,
        cost: cost.trim() || null,
        mileage: mileage.trim() ? parseInt(mileage, 10) : null,
        partsUsed,
        beforeState: beforeState.trim() || null,
        afterState: afterState.trim() || null,
        nextDueMileage: canTrackMaintenance && nextDueMileage.trim() ? parseInt(nextDueMileage, 10) : null,
        nextDueDate: canTrackMaintenance && nextDueDate.trim() ? nextDueDate.trim() : null,
        isPrivate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}/notes`] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Entry saved", "success");
      navigation.goBack();
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to save entry", "error");
    },
  });

  const handleSave = () => {
    createNoteMutation.mutate();
  };

  const isValid = title.trim() && content.trim();

  const selectedType = NOTE_TYPES.find((t) => t.key === type);

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <ThemedText type="h2" style={styles.heading}>
        Add Journal Entry
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
        Document your work, mods, or issues
      </ThemedText>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.label}>
          Entry Type
        </ThemedText>
        <View style={styles.typeGrid}>
          {NOTE_TYPES.map((t) => {
            const isActive = type === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setType(t.key)}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: isActive
                      ? t.color + "15"
                      : theme.backgroundDefault,
                    borderColor: isActive ? t.color : theme.cardBorder,
                  },
                ]}
                testID={`type-${t.key}`}
              >
                <View
                  style={[
                    styles.typeIcon,
                    { backgroundColor: t.color + "20" },
                  ]}
                >
                  <Feather name={t.icon as any} size={16} color={t.color} />
                </View>
                <Text
                  style={[
                    styles.typeLabel,
                    { color: isActive ? t.color : theme.text },
                  ]}
                >
                  {t.label}
                </Text>
                <Text
                  style={[styles.typeDesc, { color: theme.textMuted }]}
                  numberOfLines={2}
                >
                  {t.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Input
          label="Title"
          placeholder={
            type === "maintenance"
              ? "e.g., Oil Change at 75k"
              : type === "mod"
                ? "e.g., Cold Air Intake Install"
                : type === "issue"
                  ? "e.g., Rough Idle on Cold Start"
                  : "e.g., Quick Note"
          }
          value={title}
          onChangeText={setTitle}
          leftIcon={selectedType?.icon || "file-text"}
        />

        <Input
          label="Details"
          placeholder={
            type === "maintenance"
              ? "Describe the work done..."
              : type === "mod"
                ? "Describe the modification..."
                : type === "issue"
                  ? "Describe the problem and symptoms..."
                  : "Write your note..."
          }
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={6}
          style={styles.contentInput}
        />

        {showCostField ? (
          <Input
            label="Cost"
            placeholder="e.g., 85.50"
            value={cost}
            onChangeText={setCost}
            leftIcon="dollar-sign"
            keyboardType="decimal-pad"
          />
        ) : null}

        {showMileageField ? (
          <Input
            label="Mileage"
            placeholder="e.g., 75000"
            value={mileage}
            onChangeText={setMileage}
            leftIcon="navigation"
            keyboardType="number-pad"
          />
        ) : null}

        {showBeforeAfter ? (
          <>
            <Input
              label="Before"
              placeholder="e.g., Stock exhaust, 280hp"
              value={beforeState}
              onChangeText={setBeforeState}
              leftIcon="arrow-left"
            />
            <Input
              label="After"
              placeholder="e.g., Borla cat-back, 295hp"
              value={afterState}
              onChangeText={setAfterState}
              leftIcon="arrow-right"
            />
          </>
        ) : null}

        {showPartsField ? (
          <Input
            label="Parts Used"
            placeholder="Comma-separated, e.g., K&N Filter, Mobil 1 5W-30"
            value={partsInput}
            onChangeText={setPartsInput}
            leftIcon="package"
          />
        ) : null}

        {showNextDue ? (
          canTrackMaintenance ? (
            <View style={{ gap: Spacing.md, marginTop: Spacing.xs }}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Next service reminder (optional)
              </ThemedText>
              <Input
                label="Next due mileage"
                placeholder="e.g., 80000"
                value={nextDueMileage}
                onChangeText={setNextDueMileage}
                leftIcon="navigation"
                keyboardType="number-pad"
                testID="input-next-due-mileage"
              />
              <Input
                label="Next due date (YYYY-MM-DD)"
                placeholder="e.g., 2026-08-15"
                value={nextDueDate}
                onChangeText={setNextDueDate}
                leftIcon="calendar"
                autoCapitalize="none"
                testID="input-next-due-date"
              />
            </View>
          ) : (
            <LockedFeature
              feature="maintenance_tracking"
              title="Maintenance reminders"
              description="Set a next-service date or mileage so TorqueShed reminds you before it's overdue."
              onUpgrade={() => navigation.navigate("Main", { screen: "MoreTab", params: { screen: "Subscription" } })}
              compact
            />
          )
        ) : null}

        <View style={styles.switchRow}>
          <View>
            <ThemedText type="body">Keep Private</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Only you can see this entry
            </ThemedText>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <Button onPress={handleSave} disabled={!isValid || createNoteMutation.isPending}>
        {createNoteMutation.isPending ? "Saving..." : "Save Entry"}
      </Button>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heading: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  label: {
    marginBottom: Spacing.md,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  typeCard: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "45%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  typeLabel: {
    ...Typography.body,
    fontFamily: "Inter_500Medium",
    marginBottom: 2,
  },
  typeDesc: {
    ...Typography.caption,
    lineHeight: 16,
  },
  contentInput: {
    height: 120,
    textAlignVertical: "top",
    paddingTop: Spacing.md,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
  },
});
