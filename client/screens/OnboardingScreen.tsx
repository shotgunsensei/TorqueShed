import React, { useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Text,
  ScrollView,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/Toast";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

const TOTAL_STEPS = 4;

interface VinDecodeResult {
  year: string;
  make: string;
  model: string;
  error?: string;
}

async function decodeVIN(vin: string): Promise<VinDecodeResult | null> {
  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`;
    const res = await fetch(url);
    const data = await res.json();
    const results: { Variable: string; Value: string | null }[] = data.Results || [];
    const get = (key: string) =>
      results.find((r) => r.Variable === key)?.Value || "";
    const year = get("Model Year");
    const make = get("Make");
    const model = get("Model");
    if (!year && !make && !model) return null;
    const errorCode = get("Error Code");
    if (errorCode && errorCode !== "0") {
      return { year, make, model, error: get("Error Text") || "Could not fully decode VIN" };
    }
    return { year, make, model };
  } catch {
    return null;
  }
}

const BAYS = [
  { id: "ford", name: "Ford", color: BrandColors.ford },
  { id: "dodge", name: "Dodge", color: BrandColors.dodge },
  { id: "chevy", name: "Chevy", color: BrandColors.chevy },
  { id: "jeep", name: "Jeep", color: BrandColors.jeep },
  { id: "general", name: "General", color: BrandColors.general },
] as const;

const GOALS = [
  { id: "learn", label: "Learn to wrench", icon: "book-open" as const },
  { id: "diagnose", label: "Diagnose issues", icon: "activity" as const },
  { id: "build", label: "Track my build", icon: "tool" as const },
  { id: "community", label: "Join the community", icon: "users" as const },
  { id: "trade", label: "Buy/sell/trade parts", icon: "shopping-bag" as const },
  { id: "find-parts", label: "Find parts and tools", icon: "search" as const },
] as const;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { accessToken, completeOnboarding } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [inputMode, setInputMode] = useState(0);
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [nickname, setNickname] = useState("");
  const [vinDecoding, setVinDecoding] = useState(false);
  const [vinDecoded, setVinDecoded] = useState(false);
  const [vinError, setVinError] = useState<string | null>(null);
  const decodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedBays, setSelectedBays] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  const handleVinChange = (value: string) => {
    const upper = value.toUpperCase();
    setVin(upper);
    setVinDecoded(false);
    setVinError(null);
    if (decodeTimeoutRef.current) clearTimeout(decodeTimeoutRef.current);
    if (upper.length === 17) {
      setVinDecoding(true);
      decodeTimeoutRef.current = setTimeout(async () => {
        const result = await decodeVIN(upper);
        setVinDecoding(false);
        if (result) {
          setYear(result.year || "");
          setMake(result.make || "");
          setModel(result.model || "");
          setVinDecoded(true);
          if (result.error) setVinError(result.error);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          setVinError("VIN not found. Try manual entry instead.");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }, 500);
    }
  };

  const toggleBay = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedBays((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  const toggleGoal = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const vehicleValid =
    nickname.trim().length > 0 &&
    ((inputMode === 0 && vin.length >= 11) ||
      (inputMode === 1 && year && make && model));

  const canProceed = () => {
    if (step === 0) return vehicleValid;
    if (step === 1) return selectedBays.length > 0;
    if (step === 2) return selectedGoals.length > 0;
    return true;
  };

  const handleNext = async () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
      return;
    }
    await handleComplete();
  };

  const handleSkip = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      if (vehicleValid) {
        const vehicleUrl = new URL("/api/vehicles", getApiUrl());
        await fetch(vehicleUrl.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            vin: vin || null,
            year: year ? parseInt(year, 10) : null,
            make: make || null,
            model: model || null,
            nickname,
          }),
        });
      }

      const onboardingUrl = new URL("/api/users/me/onboarding", getApiUrl());
      const resp = await fetch(onboardingUrl.toString(), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          goals: selectedGoals,
          brandIds: selectedBays,
        }),
      });

      if (!resp.ok) throw new Error("Failed to complete onboarding");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Welcome to TorqueShed", "success");
      completeOnboarding();
    } catch (error) {
      toast.show("Something went wrong. Try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressDot,
            {
              backgroundColor:
                i <= step ? theme.primary : theme.backgroundTertiary,
              flex: i === step ? 2 : 1,
            },
          ]}
        />
      ))}
    </View>
  );

  const renderStepHeader = (title: string, subtitle: string) => (
    <View style={styles.stepHeader}>
      <ThemedText type="h1" style={styles.stepTitle}>
        {title}
      </ThemedText>
      <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        {subtitle}
      </ThemedText>
    </View>
  );

  const renderStep0 = () => (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(100)} style={styles.stepContent}>
      {renderStepHeader("Add Your Ride", "Start by adding your primary vehicle")}

      <SegmentedControl
        segments={["VIN", "Manual Entry"]}
        selectedIndex={inputMode}
        onIndexChange={(i) => {
          setInputMode(i);
          setVinDecoded(false);
          setVinError(null);
        }}
      />

      <View style={styles.formSection}>
        {inputMode === 0 ? (
          <>
            <Input
              label="VIN (Vehicle Identification Number)"
              placeholder="Enter 17-character VIN"
              value={vin}
              onChangeText={handleVinChange}
              leftIcon="hash"
              autoCapitalize="characters"
              maxLength={17}
              testID="input-onboarding-vin"
            />
            {vinDecoding ? (
              <View style={[styles.vinStatus, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={[styles.vinStatusText, { color: theme.textSecondary }]}>
                  Decoding VIN...
                </Text>
              </View>
            ) : vinDecoded ? (
              <View style={[styles.vinStatus, { backgroundColor: theme.success + "15", borderColor: theme.success + "40" }]}>
                <Feather name="check-circle" size={14} color={theme.success} />
                <Text style={[styles.vinStatusText, { color: theme.success }]}>
                  Vehicle identified
                </Text>
              </View>
            ) : vinError ? (
              <View style={[styles.vinStatus, { backgroundColor: theme.error + "15", borderColor: theme.error + "40" }]}>
                <Feather name="alert-circle" size={14} color={theme.error} />
                <Text style={[styles.vinStatusText, { color: theme.error }]} numberOfLines={2}>
                  {vinError}
                </Text>
              </View>
            ) : null}
            {vinDecoded ? (
              <View style={[styles.decodedResult, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
                <View style={styles.decodedRow}>
                  <Text style={[styles.decodedLabel, { color: theme.textMuted }]}>Year</Text>
                  <Text style={[styles.decodedValue, { color: theme.text }]}>{year || "--"}</Text>
                </View>
                <View style={styles.decodedRow}>
                  <Text style={[styles.decodedLabel, { color: theme.textMuted }]}>Make</Text>
                  <Text style={[styles.decodedValue, { color: theme.text }]}>{make || "--"}</Text>
                </View>
                <View style={styles.decodedRow}>
                  <Text style={[styles.decodedLabel, { color: theme.textMuted }]}>Model</Text>
                  <Text style={[styles.decodedValue, { color: theme.text }]}>{model || "--"}</Text>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Input
              label="Year"
              placeholder="e.g., 2019"
              value={year}
              onChangeText={setYear}
              leftIcon="calendar"
              keyboardType="number-pad"
              maxLength={4}
              testID="input-onboarding-year"
            />
            <Input
              label="Make"
              placeholder="e.g., Ford"
              value={make}
              onChangeText={setMake}
              leftIcon="truck"
              testID="input-onboarding-make"
            />
            <Input
              label="Model"
              placeholder="e.g., F-150"
              value={model}
              onChangeText={setModel}
              leftIcon="tag"
              testID="input-onboarding-model"
            />
          </>
        )}
        <Input
          label="Nickname"
          placeholder="Give your ride a name"
          value={nickname}
          onChangeText={setNickname}
          leftIcon="heart"
          testID="input-onboarding-nickname"
        />
      </View>
    </Animated.View>
  );

  const renderStep1 = () => (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(100)} style={styles.stepContent}>
      {renderStepHeader("Pick Your Bays", "Select brands you follow -- we will add you to their communities")}

      <View style={styles.bayGrid}>
        {BAYS.map((bay) => {
          const selected = selectedBays.includes(bay.id);
          return (
            <Pressable
              key={bay.id}
              testID={`button-bay-${bay.id}`}
              onPress={() => toggleBay(bay.id)}
              style={[
                styles.bayCard,
                {
                  backgroundColor: selected
                    ? bay.color + "20"
                    : theme.backgroundSecondary,
                  borderColor: selected ? bay.color : theme.cardBorder,
                },
              ]}
            >
              {selected ? (
                <View style={[styles.bayCheck, { backgroundColor: bay.color }]}>
                  <Feather name="check" size={14} color="#FFF" />
                </View>
              ) : null}
              <View
                style={[
                  styles.bayIcon,
                  { backgroundColor: bay.color + "30" },
                ]}
              >
                <Feather name="truck" size={20} color={bay.color} />
              </View>
              <ThemedText type="h4" style={styles.bayName}>
                {bay.name}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(100)} style={styles.stepContent}>
      {renderStepHeader("What Brings You Here?", "Help us tailor your experience")}

      <View style={styles.goalsList}>
        {GOALS.map((goal) => {
          const selected = selectedGoals.includes(goal.id);
          return (
            <Pressable
              key={goal.id}
              testID={`button-goal-${goal.id}`}
              onPress={() => toggleGoal(goal.id)}
              style={[
                styles.goalCard,
                {
                  backgroundColor: selected
                    ? theme.primary + "15"
                    : theme.backgroundSecondary,
                  borderColor: selected ? theme.primary : theme.cardBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.goalIcon,
                  {
                    backgroundColor: selected
                      ? theme.primary + "20"
                      : theme.backgroundTertiary,
                  },
                ]}
              >
                <Feather
                  name={goal.icon}
                  size={18}
                  color={selected ? theme.primary : theme.textSecondary}
                />
              </View>
              <ThemedText
                type="body"
                style={[
                  styles.goalLabel,
                  { color: selected ? theme.text : theme.textSecondary },
                ]}
              >
                {goal.label}
              </ThemedText>
              {selected ? (
                <Feather name="check-circle" size={18} color={theme.primary} />
              ) : (
                <View style={[styles.goalCircle, { borderColor: theme.border }]} />
              )}
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );

  const renderStep3 = () => (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(100)} style={styles.stepContent}>
      {renderStepHeader("You are All Set", "Here is what is waiting for you")}

      <View style={styles.summaryList}>
        {nickname.trim().length > 0 ? (
          <View style={[styles.summaryItem, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
            <Feather name="truck" size={20} color={theme.primary} />
            <View style={styles.summaryText}>
              <ThemedText type="h4">{nickname}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {[year, make, model].filter(Boolean).join(" ") || "Your ride"}
              </ThemedText>
            </View>
          </View>
        ) : null}

        {selectedBays.length > 0 ? (
          <View style={[styles.summaryItem, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
            <Feather name="users" size={20} color={theme.primary} />
            <View style={styles.summaryText}>
              <ThemedText type="h4">
                {selectedBays.length} {selectedBays.length === 1 ? "Bay" : "Bays"} joined
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {selectedBays
                  .map((id) => BAYS.find((b) => b.id === id)?.name)
                  .filter(Boolean)
                  .join(", ")}
              </ThemedText>
            </View>
          </View>
        ) : null}

        {selectedGoals.length > 0 ? (
          <View style={[styles.summaryItem, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
            <Feather name="target" size={20} color={theme.primary} />
            <View style={styles.summaryText}>
              <ThemedText type="h4">Your goals</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {selectedGoals
                  .map((id) => GOALS.find((g) => g.id === id)?.label)
                  .filter(Boolean)
                  .join(", ")}
              </ThemedText>
            </View>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 0:
        return renderStep0();
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return null;
    }
  };

  const canSkip = step >= 1 && step < TOTAL_STEPS - 1;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        {step > 0 ? (
          <Pressable
            onPress={() => setStep(step - 1)}
            style={styles.backButton}
            testID="button-onboarding-back"
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}

        <View style={styles.progressWrapper}>{renderProgressBar()}</View>

        {canSkip ? (
          <Pressable
            onPress={handleSkip}
            style={styles.skipButton}
            testID="button-onboarding-skip"
          >
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Skip
            </ThemedText>
          </Pressable>
        ) : (
          <View style={styles.skipButton} />
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderCurrentStep()}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + Spacing.md,
            backgroundColor: theme.backgroundRoot,
            borderTopColor: theme.border,
          },
        ]}
      >
        <Button
          onPress={handleNext}
          disabled={!canProceed() || submitting}
          testID="button-onboarding-next"
        >
          {submitting
            ? "Setting up..."
            : step === TOTAL_STEPS - 1
            ? "Let's Go"
            : "Continue"}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  progressWrapper: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  progressContainer: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  progressDot: {
    height: 4,
    borderRadius: 2,
  },
  skipButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  stepContent: {
    flex: 1,
  },
  stepHeader: {
    marginBottom: Spacing.xl,
  },
  stepTitle: {
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    lineHeight: 22,
  },
  formSection: {
    marginTop: Spacing.md,
    gap: 0,
  },
  vinStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: -Spacing.md,
    marginBottom: Spacing.md,
  },
  vinStatusText: {
    fontSize: 13,
    flex: 1,
  },
  decodedResult: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  decodedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  decodedLabel: {
    fontSize: 13,
  },
  decodedValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  bayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  bayCard: {
    width: (Dimensions.get("window").width - Spacing.lg * 2 - Spacing.md) / 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
    position: "relative",
  },
  bayCheck: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  bayIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  bayName: {
    textAlign: "center",
  },
  goalsList: {
    gap: Spacing.md,
  },
  goalCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  goalIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  goalLabel: {
    flex: 1,
  },
  goalCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
  },
  summaryList: {
    gap: Spacing.md,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  summaryText: {
    flex: 1,
    gap: Spacing.xxs,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
});
