import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Vehicle {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  nickname: string | null;
}

interface Garage {
  id: string;
  name: string;
  brandColor: string | null;
  isJoined: boolean;
}

const COMMON_SYMPTOMS = [
  "Check Engine Light",
  "Rough Idle",
  "Stalling",
  "Hard Starting",
  "Overheating",
  "Oil Leak",
  "Strange Noise",
  "Vibration",
  "Loss of Power",
  "Poor Fuel Economy",
  "Brake Squeal",
  "Pulling to Side",
  "Transmission Slip",
  "AC Not Cooling",
  "Battery Drain",
  "Exhaust Smoke",
];

const SEVERITY_LABELS = ["Minor", "Low", "Moderate", "High", "Critical"];
const DRIVABILITY_LABELS = ["Not Drivable", "Barely", "With Caution", "Mostly Fine", "Normal"];

const STEPS = [
  { key: "vehicle", title: "Select Vehicle", icon: "truck" },
  { key: "symptoms", title: "Symptoms", icon: "alert-circle" },
  { key: "codes", title: "OBD Codes", icon: "cpu" },
  { key: "severity", title: "Severity", icon: "thermometer" },
  { key: "bay", title: "Target Bay", icon: "home" },
  { key: "preview", title: "Preview", icon: "eye" },
];

export default function AskForHelpScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");
  const [obdCodes, setObdCodes] = useState("");
  const [severity, setSeverity] = useState(3);
  const [drivability, setDrivability] = useState(3);
  const [recentChanges, setRecentChanges] = useState("");
  const [selectedGarageId, setSelectedGarageId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: garages = [] } = useQuery<Garage[]>({
    queryKey: ["/api/garages"],
  });

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  const suggestedGarageId = useMemo(() => {
    if (!selectedVehicle?.make) return null;
    const make = selectedVehicle.make.toLowerCase();
    const match = garages.find((g) => g.name.toLowerCase().includes(make));
    return match?.id || null;
  }, [selectedVehicle, garages]);

  const vehicleLabel = (v: Vehicle) => {
    if (v.nickname) return v.nickname;
    return [v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown Vehicle";
  };

  const parsedObdCodes = obdCodes
    .split(/[,\s]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[PBCU]\d{4}$/.test(c));

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  };

  const addCustomSymptom = () => {
    const trimmed = customSymptom.trim();
    if (trimmed && !selectedSymptoms.includes(trimmed)) {
      setSelectedSymptoms((prev) => [...prev, trimmed]);
      setCustomSymptom("");
    }
  };

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      const garageId = selectedGarageId!;
      return apiRequest("POST", `/api/garages/${garageId}/threads`, {
        title: title.trim(),
        content: details.trim(),
        vehicleId: selectedVehicleId,
        symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : null,
        obdCodes: parsedObdCodes.length > 0 ? parsedObdCodes : null,
        severity,
        drivability,
        recentChanges: recentChanges.trim() || null,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/garages"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Help request posted", "success");
      navigation.goBack();
      setTimeout(() => {
        navigation.navigate("ThreadDetail", { threadId: data.id });
      }, 100);
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to post help request", "error");
    },
  });

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedVehicleId;
      case 1: return selectedSymptoms.length > 0;
      case 2: return true;
      case 3: return true;
      case 4: return !!selectedGarageId;
      case 5: return title.trim().length > 0 && details.trim().length > 0;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      if (step === 0 && suggestedGarageId && !selectedGarageId) {
        setSelectedGarageId(suggestedGarageId);
      }
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = () => {
    createThreadMutation.mutate();
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((s, i) => (
        <View
          key={s.key}
          style={[
            styles.stepDot,
            {
              backgroundColor: i <= step ? theme.primary : theme.border,
            },
          ]}
        />
      ))}
    </View>
  );

  const renderVehicleStep = () => (
    <View>
      <ThemedText type="h3" style={styles.stepTitle}>Which vehicle needs help?</ThemedText>
      <ThemedText type="body" style={[styles.stepDesc, { color: theme.textSecondary }]}>
        Select the vehicle you need help with
      </ThemedText>
      {vehicles.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Feather name="truck" size={32} color={theme.textMuted} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            No vehicles in your garage yet
          </ThemedText>
          <Button
            variant="outline"
            onPress={() => navigation.navigate("AddVehicle")}
            style={{ marginTop: Spacing.md }}
          >
            Add a Vehicle
          </Button>
        </Card>
      ) : (
        <View style={styles.optionList}>
          {vehicles.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => setSelectedVehicleId(v.id)}
              style={[
                styles.optionCard,
                {
                  backgroundColor: selectedVehicleId === v.id ? theme.primary + "15" : theme.backgroundDefault,
                  borderColor: selectedVehicleId === v.id ? theme.primary : theme.cardBorder,
                },
              ]}
              testID={`vehicle-option-${v.id}`}
            >
              <Feather
                name={selectedVehicleId === v.id ? "check-circle" : "circle"}
                size={20}
                color={selectedVehicleId === v.id ? theme.primary : theme.textMuted}
              />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {vehicleLabel(v)}
                </ThemedText>
                {v.nickname ? (
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                  </ThemedText>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  const renderSymptomsStep = () => (
    <View>
      <ThemedText type="h3" style={styles.stepTitle}>What symptoms are you seeing?</ThemedText>
      <ThemedText type="body" style={[styles.stepDesc, { color: theme.textSecondary }]}>
        Select all that apply, or add your own
      </ThemedText>
      <View style={styles.chipGrid}>
        {COMMON_SYMPTOMS.map((symptom) => {
          const isActive = selectedSymptoms.includes(symptom);
          return (
            <Pressable
              key={symptom}
              onPress={() => toggleSymptom(symptom)}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? theme.primary + "20" : theme.backgroundDefault,
                  borderColor: isActive ? theme.primary : theme.cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isActive ? theme.primary : theme.text },
                ]}
              >
                {symptom}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.customSymptomRow}>
        <View style={{ flex: 1 }}>
          <Input
            placeholder="Add custom symptom..."
            value={customSymptom}
            onChangeText={setCustomSymptom}
            leftIcon="plus"
          />
        </View>
        <Button
          variant="outline"
          onPress={addCustomSymptom}
          disabled={!customSymptom.trim()}
          style={{ marginLeft: Spacing.sm, marginTop: Spacing.lg }}
        >
          Add
        </Button>
      </View>
      {selectedSymptoms.filter((s) => !COMMON_SYMPTOMS.includes(s)).length > 0 ? (
        <View style={[styles.chipGrid, { marginTop: Spacing.sm }]}>
          {selectedSymptoms
            .filter((s) => !COMMON_SYMPTOMS.includes(s))
            .map((s) => (
              <Pressable
                key={s}
                onPress={() => toggleSymptom(s)}
                style={[styles.chip, { backgroundColor: theme.primary + "20", borderColor: theme.primary }]}
              >
                <Text style={[styles.chipText, { color: theme.primary }]}>{s}</Text>
                <Feather name="x" size={14} color={theme.primary} style={{ marginLeft: 4 }} />
              </Pressable>
            ))}
        </View>
      ) : null}
    </View>
  );

  const renderCodesStep = () => (
    <View>
      <ThemedText type="h3" style={styles.stepTitle}>Any OBD codes?</ThemedText>
      <ThemedText type="body" style={[styles.stepDesc, { color: theme.textSecondary }]}>
        Enter diagnostic trouble codes if you have them (optional)
      </ThemedText>
      <Input
        label="OBD-II Codes"
        placeholder="e.g., P0300, P0171, B1234"
        value={obdCodes}
        onChangeText={setObdCodes}
        leftIcon="cpu"
      />
      {parsedObdCodes.length > 0 ? (
        <View style={[styles.chipGrid, { marginTop: Spacing.md }]}>
          {parsedObdCodes.map((code) => (
            <View
              key={code}
              style={[styles.codeChip, { backgroundColor: "#EF444420", borderColor: "#EF4444" }]}
            >
              <Text style={[styles.codeText, { color: "#EF4444" }]}>{code}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={[styles.tipCard, { backgroundColor: theme.backgroundSecondary, marginTop: Spacing.lg }]}>
        <Feather name="info" size={16} color={theme.textSecondary} />
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.sm, flex: 1 }}>
          OBD codes start with P (Powertrain), B (Body), C (Chassis), or U (Network), followed by 4 digits. You can find these with an OBD-II scanner.
        </ThemedText>
      </View>
      <Input
        label="Recent Changes"
        placeholder="Any recent work, mods, or changes to the vehicle?"
        value={recentChanges}
        onChangeText={setRecentChanges}
        leftIcon="edit-3"
        multiline
        numberOfLines={3}
        style={{ marginTop: Spacing.md }}
      />
    </View>
  );

  const renderSeverityStep = () => (
    <View>
      <ThemedText type="h3" style={styles.stepTitle}>How bad is it?</ThemedText>
      <ThemedText type="body" style={[styles.stepDesc, { color: theme.textSecondary }]}>
        Rate the severity and how drivable the vehicle is
      </ThemedText>

      <ThemedText type="h4" style={styles.ratingLabel}>Severity</ThemedText>
      <View style={styles.ratingRow}>
        {SEVERITY_LABELS.map((label, i) => {
          const value = i + 1;
          const isActive = severity === value;
          return (
            <Pressable
              key={label}
              onPress={() => setSeverity(value)}
              style={[
                styles.ratingOption,
                {
                  backgroundColor: isActive ? theme.primary + "20" : theme.backgroundDefault,
                  borderColor: isActive ? theme.primary : theme.cardBorder,
                },
              ]}
            >
              <Text style={[styles.ratingNumber, { color: isActive ? theme.primary : theme.text }]}>
                {value}
              </Text>
              <Text style={[styles.ratingText, { color: isActive ? theme.primary : theme.textSecondary }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="h4" style={[styles.ratingLabel, { marginTop: Spacing.xl }]}>Drivability</ThemedText>
      <View style={styles.ratingRow}>
        {DRIVABILITY_LABELS.map((label, i) => {
          const value = i + 1;
          const isActive = drivability === value;
          return (
            <Pressable
              key={label}
              onPress={() => setDrivability(value)}
              style={[
                styles.ratingOption,
                {
                  backgroundColor: isActive ? theme.primary + "20" : theme.backgroundDefault,
                  borderColor: isActive ? theme.primary : theme.cardBorder,
                },
              ]}
            >
              <Text style={[styles.ratingNumber, { color: isActive ? theme.primary : theme.text }]}>
                {value}
              </Text>
              <Text style={[styles.ratingText, { color: isActive ? theme.primary : theme.textSecondary }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderBayStep = () => (
    <View>
      <ThemedText type="h3" style={styles.stepTitle}>Post to which Bay?</ThemedText>
      <ThemedText type="body" style={[styles.stepDesc, { color: theme.textSecondary }]}>
        Choose the community Bay for your help request
      </ThemedText>
      <View style={styles.optionList}>
        {garages.map((g) => {
          const isSelected = selectedGarageId === g.id;
          const isSuggested = suggestedGarageId === g.id;
          return (
            <Pressable
              key={g.id}
              onPress={() => setSelectedGarageId(g.id)}
              style={[
                styles.optionCard,
                {
                  backgroundColor: isSelected ? theme.primary + "15" : theme.backgroundDefault,
                  borderColor: isSelected ? theme.primary : theme.cardBorder,
                },
              ]}
              testID={`bay-option-${g.id}`}
            >
              <View style={[styles.bayColor, { backgroundColor: g.brandColor || theme.textMuted }]} />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <View style={styles.bayNameRow}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>{g.name}</ThemedText>
                  {isSuggested ? (
                    <View style={[styles.suggestedBadge, { backgroundColor: theme.primary + "20" }]}>
                      <Text style={[styles.suggestedText, { color: theme.primary }]}>Suggested</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Feather
                name={isSelected ? "check-circle" : "circle"}
                size={20}
                color={isSelected ? theme.primary : theme.textMuted}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderPreviewStep = () => {
    const garage = garages.find((g) => g.id === selectedGarageId);
    return (
      <View>
        <ThemedText type="h3" style={styles.stepTitle}>Preview Your Request</ThemedText>
        <ThemedText type="body" style={[styles.stepDesc, { color: theme.textSecondary }]}>
          Add a title and details, then review before posting
        </ThemedText>

        <Input
          label="Title"
          placeholder="Summarize your issue in a few words"
          value={title}
          onChangeText={setTitle}
          leftIcon="edit-2"
        />

        <Input
          label="Details"
          placeholder="Describe the problem in detail. When does it happen? What have you tried?"
          value={details}
          onChangeText={setDetails}
          multiline
          numberOfLines={5}
          style={styles.detailsInput}
        />

        <Card style={[styles.previewCard, { marginTop: Spacing.lg }]}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Summary</ThemedText>

          {selectedVehicle ? (
            <View style={styles.previewRow}>
              <Feather name="truck" size={14} color={theme.textMuted} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {vehicleLabel(selectedVehicle)}
              </ThemedText>
            </View>
          ) : null}

          {garage ? (
            <View style={styles.previewRow}>
              <Feather name="home" size={14} color={theme.textMuted} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                Posting to {garage.name}
              </ThemedText>
            </View>
          ) : null}

          {selectedSymptoms.length > 0 ? (
            <View style={styles.previewRow}>
              <Feather name="alert-circle" size={14} color={theme.textMuted} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>
                {selectedSymptoms.join(", ")}
              </ThemedText>
            </View>
          ) : null}

          {parsedObdCodes.length > 0 ? (
            <View style={styles.previewRow}>
              <Feather name="cpu" size={14} color={theme.textMuted} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {parsedObdCodes.join(", ")}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.previewRow}>
            <Feather name="thermometer" size={14} color={theme.textMuted} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              Severity: {severity}/5 ({SEVERITY_LABELS[severity - 1]})
            </ThemedText>
          </View>

          <View style={styles.previewRow}>
            <Feather name="navigation" size={14} color={theme.textMuted} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              Drivability: {drivability}/5 ({DRIVABILITY_LABELS[drivability - 1]})
            </ThemedText>
          </View>

          {recentChanges.trim() ? (
            <View style={styles.previewRow}>
              <Feather name="edit-3" size={14} color={theme.textMuted} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }} numberOfLines={2}>
                {recentChanges.trim()}
              </ThemedText>
            </View>
          ) : null}
        </Card>
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return renderVehicleStep();
      case 1: return renderSymptomsStep();
      case 2: return renderCodesStep();
      case 3: return renderSeverityStep();
      case 4: return renderBayStep();
      case 5: return renderPreviewStep();
      default: return null;
    }
  };

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
      {renderStepIndicator()}

      <View style={styles.stepContent}>
        {renderCurrentStep()}
      </View>

      <View style={styles.navRow}>
        {step > 0 ? (
          <Button variant="outline" onPress={handleBack} style={{ flex: 1 }}>
            Back
          </Button>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={{ width: Spacing.md }} />
        {step < STEPS.length - 1 ? (
          <Button onPress={handleNext} disabled={!canProceed()} style={{ flex: 1 }}>
            Next
          </Button>
        ) : (
          <Button
            onPress={handleSubmit}
            disabled={!canProceed() || createThreadMutation.isPending}
            style={{ flex: 1 }}
          >
            {createThreadMutation.isPending ? "Posting..." : "Post Request"}
          </Button>
        )}
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepContent: {
    flex: 1,
    marginBottom: Spacing.xl,
  },
  stepTitle: {
    marginBottom: Spacing.xs,
  },
  stepDesc: {
    marginBottom: Spacing.lg,
  },
  optionList: {
    gap: Spacing.sm,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xl,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    ...Typography.caption,
    fontFamily: "Inter_500Medium",
  },
  customSymptomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: Spacing.md,
  },
  codeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  codeText: {
    ...Typography.body,
    fontFamily: "Inter_500Medium",
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  ratingLabel: {
    marginBottom: Spacing.md,
  },
  ratingRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  ratingOption: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  ratingNumber: {
    ...Typography.h3,
    marginBottom: 2,
  },
  ratingText: {
    ...Typography.caption,
    fontSize: 10,
    textAlign: "center",
  },
  bayColor: {
    width: 4,
    height: 36,
    borderRadius: 2,
  },
  bayNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  suggestedBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  suggestedText: {
    ...Typography.caption,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
  },
  detailsInput: {
    height: 100,
    textAlignVertical: "top",
    paddingTop: Spacing.md,
  },
  previewCard: {
    padding: Spacing.lg,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  navRow: {
    flexDirection: "row",
    marginTop: Spacing.md,
  },
});
