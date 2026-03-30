import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius, Colors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import {
  DIAGNOSTIC_CATEGORIES,
  computeHypotheses,
  generateAssessment,
  generateExportSummary,
  getDtcMatchingCategories,
  createEmptySession,
  type DiagnosticSessionData,
  type DiagnosticPhase,
  type CategoryDefinition,
  type NarrowingQuestion,
  type DiagnosticTest,
  type ScoredHypothesis,
  type TestResult,
  type DiagnosticAssessment,
} from "../../shared/diagnostic-engine";

type IconName = keyof typeof Feather.glyphMap;

const CATEGORY_ICONS: Record<string, IconName> = {
  "no-crank": "battery",
  "no-start": "power",
  "overheating": "thermometer",
  "misfire": "activity",
  "charging-system": "battery-charging",
  "brake-noise": "disc",
  "front-end-clunk": "truck",
  "parasitic-drain": "zap-off",
  "ac-not-cold": "wind",
  "transmission-issue": "repeat",
};

const safetyColors: Record<string, string> = {
  "diy-safe": Colors.dark.success,
  "use-caution": Colors.dark.accent,
  "professional": Colors.dark.error,
};

const safetyLabels: Record<string, string> = {
  "diy-safe": "Safe to DIY",
  "use-caution": "Use Caution",
  "professional": "Professional Recommended",
};

const difficultyColors: Record<string, string> = {
  easy: Colors.dark.success,
  moderate: Colors.dark.accent,
  hard: Colors.dark.error,
  beginner: Colors.dark.success,
  intermediate: Colors.dark.accent,
  advanced: Colors.dark.error,
};

export default function PartsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useSafeTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);

  const [session, setSession] = useState<DiagnosticSessionData>(createEmptySession);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [testNotes, setTestNotes] = useState("");
  const [showExport, setShowExport] = useState(false);

  const { data: userVehicles } = useQuery<Array<{ id: string; year: number; make: string; model: string; engine: string; vin: string }>>({
    queryKey: ["/api/vehicles"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: DiagnosticSessionData) => {
      if (data.id) {
        await apiRequest("PUT", `/api/diagnostic-sessions/${data.id}`, {
          vehicleYear: data.vehicle.year,
          vehicleMake: data.vehicle.make,
          vehicleModel: data.vehicle.model,
          vehicleEngine: data.vehicle.engine,
          vehicleMileage: data.vehicle.mileage,
          vehicleVin: data.vehicle.vin,
          categoryId: data.categoryId,
          phase: data.phase,
          answers: data.answers,
          completedTests: data.completedTests,
          dtcCodes: data.dtcCodes,
          recentRepairs: data.recentRepairs,
          notes: data.notes,
        });
      } else {
        const res = await apiRequest("POST", "/api/diagnostic-sessions", {
          vehicleYear: data.vehicle.year,
          vehicleMake: data.vehicle.make,
          vehicleModel: data.vehicle.model,
          vehicleEngine: data.vehicle.engine,
          vehicleMileage: data.vehicle.mileage,
          vehicleVin: data.vehicle.vin,
          categoryId: data.categoryId,
          phase: data.phase,
          answers: data.answers,
          completedTests: data.completedTests,
          dtcCodes: data.dtcCodes,
          recentRepairs: data.recentRepairs,
          notes: data.notes,
        });
        const saved = await res.json();
        setSession(prev => ({ ...prev, id: saved.id }));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/diagnostic-sessions"] });
    },
  });

  const category = useMemo(() => {
    if (!session.categoryId) return null;
    return DIAGNOSTIC_CATEGORIES.find(c => c.id === session.categoryId) || null;
  }, [session.categoryId]);

  const assessment = useMemo<DiagnosticAssessment | null>(() => {
    if (!category) return null;
    return generateAssessment(category, session.answers, session.completedTests, session.dtcCodes);
  }, [category, session.answers, session.completedTests, session.dtcCodes]);

  const dtcMatches = useMemo(() => {
    return getDtcMatchingCategories(session.dtcCodes);
  }, [session.dtcCodes]);

  const updateSession = useCallback((updates: Partial<DiagnosticSessionData>) => {
    setSession(prev => ({ ...prev, ...updates }));
  }, []);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const handleSelectVehicle = useCallback((v: { year: number; make: string; model: string; engine: string; vin: string }) => {
    updateSession({
      vehicle: {
        year: v.year,
        make: v.make,
        model: v.model,
        engine: v.engine,
        vin: v.vin,
      },
    });
  }, [updateSession]);

  const handleIntakeComplete = useCallback(() => {
    if (!session.vehicle.make || !session.vehicle.model) {
      Alert.alert("Vehicle Required", "Please enter at least the make and model of your vehicle.");
      return;
    }
    updateSession({ phase: "category" });
    scrollToTop();
  }, [session.vehicle, updateSession, scrollToTop]);

  const handleSelectCategory = useCallback((cat: CategoryDefinition) => {
    updateSession({ categoryId: cat.id, phase: "narrowing" });
    scrollToTop();
  }, [updateSession, scrollToTop]);

  const handleAnswer = useCallback((questionId: string, value: string) => {
    setSession(prev => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: value },
    }));
  }, []);

  const handleFinishNarrowing = useCallback(() => {
    updateSession({ phase: "diagnosis" });
    scrollToTop();
  }, [updateSession, scrollToTop]);

  const handleRecordTestResult = useCallback((testId: string, result: "pass" | "fail" | "inconclusive") => {
    setSession(prev => ({
      ...prev,
      completedTests: {
        ...prev.completedTests,
        [testId]: { result, notes: testNotes, completedAt: new Date().toISOString() },
      },
    }));
    setActiveTestId(null);
    setTestNotes("");
  }, [testNotes]);

  const handleReset = useCallback(() => {
    setSession(createEmptySession());
    setActiveTestId(null);
    setTestNotes("");
    setShowExport(false);
    scrollToTop();
  }, [scrollToTop]);

  const handleExportCopy = useCallback(async () => {
    if (!category) return;
    const summary = generateExportSummary(session, category);
    const lines: string[] = [
      "TORQUEASSIST DIAGNOSTIC REPORT",
      "",
      `Vehicle: ${[summary.vehicle.year, summary.vehicle.make, summary.vehicle.model].filter(Boolean).join(" ")}`,
    ];
    if (summary.vehicle.engine) lines.push(`Engine: ${summary.vehicle.engine}`);
    if (summary.vehicle.mileage) lines.push(`Mileage: ${summary.vehicle.mileage.toLocaleString()}`);
    if (summary.vehicle.vin) lines.push(`VIN: ${summary.vehicle.vin}`);
    lines.push(`Complaint: ${summary.complaint}`);
    if (summary.dtcCodes.length > 0) lines.push(`DTCs: ${summary.dtcCodes.join(", ")}`);
    if (summary.recentRepairs) lines.push(`Recent work: ${summary.recentRepairs}`);
    if (summary.symptoms.length > 0) {
      lines.push("", "REPORTED SYMPTOMS");
      summary.symptoms.forEach(s => lines.push(`- ${s}`));
    }
    if (summary.testsPerformed.length > 0) {
      lines.push("", "TESTS PERFORMED");
      summary.testsPerformed.forEach(t => {
        lines.push(`- ${t.name}: ${t.result.toUpperCase()}`);
        if (t.notes) lines.push(`  ${t.notes}`);
      });
    }
    if (summary.likelyCauses.length > 0) {
      lines.push("", "LIKELY CAUSES");
      summary.likelyCauses.forEach((c, i) => {
        lines.push(`#${i + 1} ${c.confidence}% ${c.name}`);
        if (c.supportingEvidence.length > 0) {
          lines.push(`   Supporting: ${c.supportingEvidence.join(", ")}`);
        }
        if (c.contradictingEvidence.length > 0) {
          lines.push(`   Against: ${c.contradictingEvidence.join(", ")}`);
        }
      });
    }
    lines.push("", `NEXT STEP: ${summary.recommendedNextStep}`);
    if (summary.notes) lines.push("", `NOTES: ${summary.notes}`);
    lines.push("", new Date(summary.generatedAt).toLocaleString());
    lines.push("TorqueShed TorqueAssist");

    const text = lines.join("\n");
    await Clipboard.setStringAsync(text);
    Alert.alert("Copied", "Diagnostic summary copied to clipboard.");
  }, [session, category]);

  const vehicleLabel = useMemo(() => {
    const v = session.vehicle;
    if (!v.make) return "";
    const parts = [v.year, v.make, v.model].filter(Boolean);
    return parts.join(" ");
  }, [session.vehicle]);

  const renderIntakePhase = () => (
    <View>
      <View style={styles.phaseHeader}>
        <View style={[styles.phaseIconBg, { backgroundColor: theme.primary + "15" }]}>
          <Feather name="clipboard" size={28} color={theme.primary} />
        </View>
        <Text style={[styles.phaseTitle, { color: theme.text }]}>Vehicle Information</Text>
        <Text style={[styles.phaseSubtitle, { color: theme.textSecondary }]}>
          Enter your vehicle details for an accurate diagnosis
        </Text>
      </View>

      {userVehicles && userVehicles.length > 0 ? (
        <View style={styles.sectionWrap}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Select from your garage</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleScroll}>
            {userVehicles.map(v => (
              <Pressable
                key={v.id}
                style={({ pressed }) => [
                  styles.vehicleChip,
                  {
                    backgroundColor: session.vehicle.make === v.make && session.vehicle.model === v.model
                      ? theme.primary + "20"
                      : theme.backgroundSecondary,
                    borderColor: session.vehicle.make === v.make && session.vehicle.model === v.model
                      ? theme.primary
                      : theme.cardBorder,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => handleSelectVehicle(v)}
                testID={`vehicle-chip-${v.id}`}
              >
                <Feather name="truck" size={14} color={theme.primary} />
                <Text style={[styles.vehicleChipText, { color: theme.text }]}>
                  {v.year} {v.make} {v.model}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.sectionWrap}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Or enter manually</Text>
        <View style={styles.inputRow}>
          <View style={styles.inputHalf}>
            <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Year</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}
              placeholder="2020"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={session.vehicle.year ? String(session.vehicle.year) : ""}
              onChangeText={t => updateSession({ vehicle: { ...session.vehicle, year: parseInt(t) || undefined } })}
              testID="input-vehicle-year"
            />
          </View>
          <View style={styles.inputHalf}>
            <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Make</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}
              placeholder="Ford"
              placeholderTextColor={theme.textMuted}
              value={session.vehicle.make || ""}
              onChangeText={t => updateSession({ vehicle: { ...session.vehicle, make: t } })}
              testID="input-vehicle-make"
            />
          </View>
        </View>
        <View style={styles.inputRow}>
          <View style={styles.inputHalf}>
            <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Model</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}
              placeholder="F-150"
              placeholderTextColor={theme.textMuted}
              value={session.vehicle.model || ""}
              onChangeText={t => updateSession({ vehicle: { ...session.vehicle, model: t } })}
              testID="input-vehicle-model"
            />
          </View>
          <View style={styles.inputHalf}>
            <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Engine</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}
              placeholder="5.0L V8"
              placeholderTextColor={theme.textMuted}
              value={session.vehicle.engine || ""}
              onChangeText={t => updateSession({ vehicle: { ...session.vehicle, engine: t } })}
              testID="input-vehicle-engine"
            />
          </View>
        </View>
        <View style={styles.inputRow}>
          <View style={styles.inputHalf}>
            <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Mileage</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}
              placeholder="85000"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={session.vehicle.mileage ? String(session.vehicle.mileage) : ""}
              onChangeText={t => updateSession({ vehicle: { ...session.vehicle, mileage: parseInt(t) || undefined } })}
              testID="input-vehicle-mileage"
            />
          </View>
          <View style={styles.inputHalf}>
            <Text style={[styles.inputLabel, { color: theme.textMuted }]}>VIN (optional)</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}
              placeholder="1FTEW1E..."
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
              value={session.vehicle.vin || ""}
              onChangeText={t => updateSession({ vehicle: { ...session.vehicle, vin: t } })}
              testID="input-vehicle-vin"
            />
          </View>
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <Text style={[styles.inputLabel, { color: theme.textMuted }]}>DTC Codes (comma separated)</Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}
          placeholder="P0301, P0420..."
          placeholderTextColor={theme.textMuted}
          autoCapitalize="characters"
          value={session.dtcCodes.join(", ")}
          onChangeText={t => updateSession({ dtcCodes: t.split(",").map(s => s.trim()).filter(Boolean) })}
          testID="input-dtc-codes"
        />
      </View>

      <View style={styles.sectionWrap}>
        <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Recent repairs or changes</Text>
        <TextInput
          style={[styles.input, styles.multilineInput, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}
          placeholder="New battery last month, oil change 2 weeks ago..."
          placeholderTextColor={theme.textMuted}
          multiline
          value={session.recentRepairs}
          onChangeText={t => updateSession({ recentRepairs: t })}
          testID="input-recent-repairs"
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 }]}
        onPress={handleIntakeComplete}
        testID="button-intake-continue"
      >
        <Text style={styles.primaryButtonText}>Continue to Diagnosis</Text>
        <Feather name="arrow-right" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );

  const renderCategoryPhase = () => (
    <View>
      <Pressable style={styles.backRow} onPress={() => updateSession({ phase: "intake" })} hitSlop={8}>
        <Feather name="arrow-left" size={20} color={theme.textSecondary} />
        <Text style={[styles.backText, { color: theme.textSecondary }]}>Edit Vehicle Info</Text>
      </Pressable>

      {vehicleLabel ? (
        <View style={[styles.vehicleSnap, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
          <Feather name="truck" size={16} color={theme.primary} />
          <Text style={[styles.vehicleSnapText, { color: theme.text }]}>{vehicleLabel}</Text>
          {session.vehicle.engine ? <Text style={[styles.vehicleSnapSub, { color: theme.textMuted }]}>{session.vehicle.engine}</Text> : null}
        </View>
      ) : null}

      <View style={styles.phaseHeader}>
        <Text style={[styles.phaseTitle, { color: theme.text }]}>What's the problem?</Text>
        <Text style={[styles.phaseSubtitle, { color: theme.textSecondary }]}>
          Select the category that best describes your issue
        </Text>
      </View>

      <View style={styles.categoryGrid}>
        {DIAGNOSTIC_CATEGORIES.map(cat => {
          const match = dtcMatches.find(m => m.categoryId === cat.id);
          return (
            <Pressable
              key={cat.id}
              style={({ pressed }) => [
                styles.categoryCard,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: match ? theme.primary : theme.cardBorder,
                  borderWidth: match ? 2 : 1,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
              onPress={() => handleSelectCategory(cat)}
              testID={`category-${cat.id}`}
            >
              <View style={[styles.catIconBg, { backgroundColor: theme.primary + "15" }]}>
                <Feather name={CATEGORY_ICONS[cat.id] || "help-circle"} size={22} color={theme.primary} />
              </View>
              <Text style={[styles.catName, { color: theme.text }]}>{cat.name}</Text>
              <Text style={[styles.catDesc, { color: theme.textMuted }]} numberOfLines={2}>{cat.description}</Text>
              {match ? (
                <View style={[styles.dtcMatchBadge, { backgroundColor: theme.primary + "15" }]}>
                  <Feather name="cpu" size={10} color={theme.primary} />
                  <Text style={[styles.dtcMatchText, { color: theme.primary }]}>
                    {match.matchCount} matching DTC{match.matchCount > 1 ? "s" : ""}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderNarrowingPhase = () => {
    if (!category || !assessment) return null;

    const answeredQuestions = category.questions.filter(q => session.answers[q.id]);
    const currentQuestion = assessment.nextQuestion;

    return (
      <View>
        <Pressable style={styles.backRow} onPress={() => updateSession({ phase: "category", categoryId: null, answers: {} })} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={theme.textSecondary} />
          <Text style={[styles.backText, { color: theme.textSecondary }]}>Change Category</Text>
        </Pressable>

        <View style={[styles.vehicleSnap, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
          <Feather name="truck" size={16} color={theme.primary} />
          <Text style={[styles.vehicleSnapText, { color: theme.text }]}>{vehicleLabel}</Text>
          <View style={[styles.categoryBadge, { backgroundColor: theme.primary + "20" }]}>
            <Text style={[styles.categoryBadgeText, { color: theme.primary }]}>{category.name}</Text>
          </View>
        </View>

        {session.dtcCodes.length > 0 ? (
          <View style={styles.dtcChipRow}>
            <Feather name="cpu" size={12} color={theme.accent} />
            {session.dtcCodes.map((code, i) => (
              <View key={i} style={[styles.dtcChip, { backgroundColor: theme.accent + "15", borderColor: theme.accent + "30" }]}>
                <Text style={[styles.dtcChipText, { color: theme.accent }]}>{code}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.progressWrap, { backgroundColor: theme.backgroundTertiary }]}>
          <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${assessment.progress * 100}%` }]} />
        </View>
        <Text style={[styles.progressLabel, { color: theme.textMuted }]}>
          {assessment.answeredCount} of {assessment.totalQuestions} questions answered
        </Text>

        {assessment.hypotheses.length > 0 && assessment.answeredCount > 0 ? (
          <View style={[styles.miniHypotheses, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
            <Text style={[styles.miniHypTitle, { color: theme.textSecondary }]}>Current Leading Causes</Text>
            {assessment.hypotheses.slice(0, 3).map(h => (
              <View key={h.id} style={styles.miniHypRow}>
                <View style={[styles.miniHypBar, { backgroundColor: theme.backgroundTertiary }]}>
                  <View style={[styles.miniHypFill, { backgroundColor: theme.primary, width: `${h.confidence}%` }]} />
                </View>
                <Text style={[styles.miniHypName, { color: theme.text }]} numberOfLines={1}>{h.name}</Text>
                <Text style={[styles.miniHypPct, { color: theme.primary }]}>{h.confidence}%</Text>
              </View>
            ))}
          </View>
        ) : null}

        {answeredQuestions.length > 0 ? (
          <View style={styles.answeredSection}>
            <Text style={[styles.answeredTitle, { color: theme.textSecondary }]}>Your Answers</Text>
            {answeredQuestions.map(q => {
              const opt = q.options.find(o => o.value === session.answers[q.id]);
              return (
                <Pressable
                  key={q.id}
                  style={[styles.answeredItem, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}
                  onPress={() => {
                    setSession(prev => {
                      const next = { ...prev.answers };
                      delete next[q.id];
                      return { ...prev, answers: next };
                    });
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.answeredQ, { color: theme.textMuted }]} numberOfLines={1}>{q.text}</Text>
                    <Text style={[styles.answeredA, { color: theme.text }]}>{opt ? opt.label : session.answers[q.id]}</Text>
                  </View>
                  <Feather name="edit-2" size={14} color={theme.textMuted} />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {currentQuestion ? (
          <View style={[styles.questionCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.primary + "40" }]}>
            <View style={styles.questionHeader}>
              <View style={[styles.qNumBadge, { backgroundColor: theme.primary }]}>
                <Text style={styles.qNumText}>{assessment.answeredCount + 1}</Text>
              </View>
              <Text style={[styles.questionText, { color: theme.text }]}>{currentQuestion.text}</Text>
            </View>
            <View style={[styles.whyBox, { backgroundColor: theme.primary + "08" }]}>
              <Feather name="info" size={14} color={theme.primary} />
              <Text style={[styles.whyText, { color: theme.textSecondary }]}>{currentQuestion.whyAsking}</Text>
            </View>
            <View style={styles.optionsList}>
              {currentQuestion.options.map(opt => (
                <Pressable
                  key={opt.value}
                  style={({ pressed }) => [
                    styles.optionButton,
                    {
                      backgroundColor: session.answers[currentQuestion.id] === opt.value
                        ? theme.primary + "15"
                        : theme.backgroundTertiary,
                      borderColor: session.answers[currentQuestion.id] === opt.value
                        ? theme.primary
                        : theme.cardBorder,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  onPress={() => handleAnswer(currentQuestion.id, opt.value)}
                  testID={`option-${currentQuestion.id}-${opt.value}`}
                >
                  <View style={[
                    styles.optionRadio,
                    {
                      borderColor: session.answers[currentQuestion.id] === opt.value ? theme.primary : theme.textMuted,
                      backgroundColor: session.answers[currentQuestion.id] === opt.value ? theme.primary : "transparent",
                    },
                  ]}>
                    {session.answers[currentQuestion.id] === opt.value ? (
                      <View style={styles.optionRadioDot} />
                    ) : null}
                  </View>
                  <Text style={[styles.optionLabel, { color: theme.text }]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={[styles.allAnsweredCard, { backgroundColor: theme.success + "10", borderColor: theme.success + "40" }]}>
            <Feather name="check-circle" size={24} color={theme.success} />
            <Text style={[styles.allAnsweredText, { color: theme.text }]}>Narrowing complete</Text>
            <Text style={[styles.allAnsweredSub, { color: theme.textSecondary }]}>
              Ready for the diagnostic dashboard with ranked causes and test recommendations.
            </Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1, marginTop: Spacing.lg },
          ]}
          onPress={handleFinishNarrowing}
          testID="button-view-diagnosis"
        >
          <Feather name="bar-chart-2" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>View Diagnostic Dashboard</Text>
        </Pressable>
      </View>
    );
  };

  const renderDiagnosisPhase = () => {
    if (!category || !assessment) return null;

    if (showExport) {
      return renderExportView();
    }

    return (
      <View>
        <Pressable style={styles.backRow} onPress={() => updateSession({ phase: "narrowing" })} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={theme.textSecondary} />
          <Text style={[styles.backText, { color: theme.textSecondary }]}>Back to Questions</Text>
        </Pressable>

        <View style={[styles.vehicleSnap, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
          <Feather name="truck" size={16} color={theme.primary} />
          <Text style={[styles.vehicleSnapText, { color: theme.text }]}>{vehicleLabel}</Text>
          <View style={[styles.categoryBadge, { backgroundColor: theme.primary + "20" }]}>
            <Text style={[styles.categoryBadgeText, { color: theme.primary }]}>{category.name}</Text>
          </View>
        </View>

        {session.dtcCodes.length > 0 ? (
          <View style={styles.dtcChipRow}>
            <Feather name="cpu" size={12} color={theme.accent} />
            {session.dtcCodes.map((code, i) => (
              <View key={i} style={[styles.dtcChip, { backgroundColor: theme.accent + "15", borderColor: theme.accent + "30" }]}>
                <Text style={[styles.dtcChipText, { color: theme.accent }]}>{code}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {assessment.summary ? (
          <View style={[styles.summaryBanner, { backgroundColor: theme.primary + "10", borderColor: theme.primary + "30" }]}>
            <Feather name="zap" size={18} color={theme.primary} />
            <Text style={[styles.summaryBannerText, { color: theme.text }]}>{assessment.summary}</Text>
          </View>
        ) : null}

        <View style={[styles.dashCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
          <View style={styles.dashCardHeader}>
            <Feather name="target" size={16} color={theme.primary} />
            <Text style={[styles.dashCardTitle, { color: theme.text }]}>Likely Causes</Text>
          </View>
          {assessment.hypotheses.filter(h => h.confidence >= 5).map((h, idx) => (
            <View key={h.id} style={[styles.hypCard, idx > 0 ? { borderTopWidth: 1, borderTopColor: theme.cardBorder, paddingTop: Spacing.md } : undefined]}>
              <View style={styles.hypHeader}>
                <Text style={[styles.hypRank, { color: theme.primary }]}>#{idx + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.hypName, { color: theme.text }]}>{h.name}</Text>
                  <Text style={[styles.hypDesc, { color: theme.textMuted }]} numberOfLines={2}>{h.description}</Text>
                </View>
                <View style={styles.hypConfidence}>
                  <Text style={[styles.hypPct, { color: h.confidence >= 40 ? theme.primary : theme.textSecondary }]}>{h.confidence}%</Text>
                </View>
              </View>
              <View style={[styles.hypBar, { backgroundColor: theme.backgroundTertiary }]}>
                <View style={[
                  styles.hypBarFill,
                  {
                    backgroundColor: h.confidence >= 40 ? theme.primary : h.confidence >= 20 ? theme.accent : theme.textMuted,
                    width: `${h.confidence}%`,
                  },
                ]} />
              </View>
              <View style={styles.hypMeta}>
                <View style={[styles.hypMetaTag, { backgroundColor: safetyColors[h.safetyLevel] + "15" }]}>
                  <Feather
                    name={h.safetyLevel === "diy-safe" ? "check-circle" : h.safetyLevel === "use-caution" ? "alert-triangle" : "alert-octagon"}
                    size={12}
                    color={safetyColors[h.safetyLevel]}
                  />
                  <Text style={[styles.hypMetaTagText, { color: safetyColors[h.safetyLevel] }]}>{safetyLabels[h.safetyLevel]}</Text>
                </View>
                <View style={[styles.hypMetaTag, { backgroundColor: difficultyColors[h.difficulty] + "15" }]}>
                  <Text style={[styles.hypMetaTagText, { color: difficultyColors[h.difficulty] }]}>{h.difficulty}</Text>
                </View>
                <Text style={[styles.hypCost, { color: theme.textMuted }]}>{h.costRange}</Text>
              </View>
              {h.toolLevel ? (
                <View style={styles.hypToolRow}>
                  <Feather name="tool" size={12} color={theme.textMuted} />
                  <Text style={[styles.hypToolText, { color: theme.textMuted }]}>{h.toolLevel}</Text>
                </View>
              ) : null}
              {h.supportingEvidence.length > 0 ? (
                <View style={styles.evidenceSection}>
                  <Text style={[styles.evidenceLabel, { color: theme.success }]}>Supporting</Text>
                  <View style={styles.evidenceChips}>
                    {h.supportingEvidence.map((e, ei) => (
                      <View key={ei} style={[styles.evidenceChip, { backgroundColor: theme.success + "10", borderColor: theme.success + "30" }]}>
                        <Feather name="plus" size={10} color={theme.success} />
                        <Text style={[styles.evidenceChipText, { color: theme.text }]} numberOfLines={1}>{e}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {h.contradictingEvidence.length > 0 ? (
                <View style={styles.evidenceSection}>
                  <Text style={[styles.evidenceLabel, { color: theme.error }]}>Against</Text>
                  <View style={styles.evidenceChips}>
                    {h.contradictingEvidence.map((e, ei) => (
                      <View key={ei} style={[styles.evidenceChip, { backgroundColor: theme.error + "10", borderColor: theme.error + "30" }]}>
                        <Feather name="minus" size={10} color={theme.error} />
                        <Text style={[styles.evidenceChipText, { color: theme.text }]} numberOfLines={1}>{e}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ))}
        </View>

        {assessment.nextTest ? (
          <View style={[styles.dashCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.primary + "40" }]}>
            <View style={styles.dashCardHeader}>
              <Feather name="crosshair" size={16} color={theme.primary} />
              <Text style={[styles.dashCardTitle, { color: theme.text }]}>Recommended Next Test</Text>
            </View>
            {renderTestCard(assessment.nextTest, true)}
          </View>
        ) : null}

        <View style={[styles.dashCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
          <View style={styles.dashCardHeader}>
            <Feather name="list" size={16} color={theme.primary} />
            <Text style={[styles.dashCardTitle, { color: theme.text }]}>All Tests</Text>
            <Text style={[styles.dashCardSubtitle, { color: theme.textMuted }]}>
              {Object.keys(session.completedTests).length} of {category.tests.length} completed
            </Text>
          </View>
          {(() => {
            const topIds = assessment.hypotheses.slice(0, 3).map(h => h.id);
            const sortedTests = [...category.tests].sort((a, b) => {
              const aCompleted = session.completedTests[a.id] ? 1 : 0;
              const bCompleted = session.completedTests[b.id] ? 1 : 0;
              if (aCompleted !== bCompleted) return aCompleted - bCompleted;
              const aRelevance = a.discriminates.filter(id => topIds.includes(id)).length;
              const bRelevance = b.discriminates.filter(id => topIds.includes(id)).length;
              return bRelevance - aRelevance;
            });
            return sortedTests.map(test => {
              const completed = session.completedTests[test.id];
              if (completed) {
                return (
                  <View key={test.id} style={[styles.completedTest, { borderColor: theme.cardBorder }]}>
                    <View style={styles.completedTestHeader}>
                      <Feather
                        name={completed.result === "pass" ? "check-circle" : completed.result === "fail" ? "x-circle" : "minus-circle"}
                        size={18}
                        color={completed.result === "pass" ? theme.success : completed.result === "fail" ? theme.error : theme.accent}
                      />
                      <Text style={[styles.completedTestName, { color: theme.text }]}>{test.name}</Text>
                      <View style={[
                        styles.resultBadge,
                        { backgroundColor: (completed.result === "pass" ? theme.success : completed.result === "fail" ? theme.error : theme.accent) + "15" },
                      ]}>
                        <Text style={[
                          styles.resultBadgeText,
                          { color: completed.result === "pass" ? theme.success : completed.result === "fail" ? theme.error : theme.accent },
                        ]}>{completed.result.toUpperCase()}</Text>
                      </View>
                    </View>
                    {completed.notes ? (
                      <Text style={[styles.completedTestNotes, { color: theme.textMuted }]}>{completed.notes}</Text>
                    ) : null}
                  </View>
                );
              }
              if (assessment.nextTest && test.id === assessment.nextTest.id) return null;
              return (
                <View key={test.id}>
                  {renderTestCard(test, false)}
                </View>
              );
            });
          })()}
        </View>

        <View style={[styles.dashCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
          <View style={styles.dashCardHeader}>
            <Feather name="edit-3" size={16} color={theme.primary} />
            <Text style={[styles.dashCardTitle, { color: theme.text }]}>Notes</Text>
          </View>
          <TextInput
            style={[styles.input, styles.multilineInput, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundTertiary }]}
            placeholder="Record observations, measurements, or anything relevant..."
            placeholderTextColor={theme.textMuted}
            multiline
            value={session.notes}
            onChangeText={t => updateSession({ notes: t })}
            testID="input-diagnosis-notes"
          />
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 }]}
            onPress={() => setShowExport(true)}
            testID="button-export"
          >
            <Feather name="file-text" size={16} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Export Summary</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.cardBorder, opacity: pressed ? 0.9 : 1 }]}
            onPress={() => saveMutation.mutate(session)}
            testID="button-save-session"
          >
            <Feather name="save" size={16} color={theme.primary} />
            <Text style={[styles.actionButtonText, { color: theme.primary }]}>
              {saveMutation.isPending ? "Saving..." : session.id ? "Update" : "Save Session"}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.askHelpCard, { backgroundColor: theme.primary + "10", borderColor: theme.primary + "30", opacity: pressed ? 0.9 : 1 }]}
          onPress={() => navigation.navigate("AskForHelp")}
          testID="button-ask-help-torqueassist"
        >
          <Feather name="users" size={20} color={theme.primary} />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={[styles.askHelpTitle, { color: theme.text }]}>Still stuck?</Text>
            <Text style={[styles.askHelpDesc, { color: theme.textSecondary }]}>
              Post a structured help request with your diagnostic data.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={theme.primary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.resetButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder, opacity: pressed ? 0.9 : 1 }]}
          onPress={handleReset}
          testID="button-new-diagnosis"
        >
          <Feather name="refresh-cw" size={16} color={theme.primary} />
          <Text style={[styles.resetText, { color: theme.primary }]}>Start New Diagnosis</Text>
        </Pressable>
      </View>
    );
  };

  const renderTestCard = (test: DiagnosticTest, isRecommended: boolean) => {
    const isActive = activeTestId === test.id;

    const discriminatesNames = category
      ? test.discriminates.map(hId => {
          const h = category.hypotheses.find(hyp => hyp.id === hId);
          return h ? h.name : hId;
        })
      : [];

    return (
      <View style={[styles.testCard, isRecommended ? { borderLeftWidth: 3, borderLeftColor: theme.primary } : undefined]}>
        <Pressable
          style={styles.testHeader}
          onPress={() => setActiveTestId(isActive ? null : test.id)}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.testName, { color: theme.text }]}>{test.name}</Text>
            <Text style={[styles.testPurpose, { color: theme.textSecondary }]}>{test.purpose}</Text>
          </View>
          <View style={[styles.diffBadge, { backgroundColor: difficultyColors[test.difficulty] + "15" }]}>
            <Text style={[styles.diffBadgeText, { color: difficultyColors[test.difficulty] }]}>{test.difficulty}</Text>
          </View>
          <Feather name={isActive ? "chevron-up" : "chevron-down"} size={18} color={theme.textMuted} />
        </Pressable>

        {isActive ? (
          <View style={styles.testExpanded}>
            {discriminatesNames.length > 0 ? (
              <View style={[styles.testDiscriminates, { backgroundColor: theme.primary + "08", borderColor: theme.primary + "20" }]}>
                <Feather name="crosshair" size={12} color={theme.primary} />
                <Text style={[styles.testDiscriminatesText, { color: theme.textSecondary }]}>
                  Helps confirm or rule out: {discriminatesNames.join(", ")}
                </Text>
              </View>
            ) : null}
            <View style={styles.testSection}>
              <Text style={[styles.testSectionTitle, { color: theme.primary }]}>Procedure</Text>
              <Text style={[styles.testSectionBody, { color: theme.text }]}>{test.procedure}</Text>
            </View>
            {test.tools.length > 0 ? (
              <View style={styles.testSection}>
                <Text style={[styles.testSectionTitle, { color: theme.primary }]}>Tools Needed</Text>
                <Text style={[styles.testSectionBody, { color: theme.text }]}>{test.tools.join(", ")}</Text>
              </View>
            ) : null}
            <View style={styles.testResultsGrid}>
              <View style={[styles.testResultBox, { backgroundColor: theme.success + "08", borderColor: theme.success + "20" }]}>
                <Feather name="check" size={14} color={theme.success} />
                <Text style={[styles.testResultLabel, { color: theme.success }]}>Good Result</Text>
                <Text style={[styles.testResultBody, { color: theme.text }]}>{test.expectedGood}</Text>
              </View>
              <View style={[styles.testResultBox, { backgroundColor: theme.error + "08", borderColor: theme.error + "20" }]}>
                <Feather name="x" size={14} color={theme.error} />
                <Text style={[styles.testResultLabel, { color: theme.error }]}>Bad Result</Text>
                <Text style={[styles.testResultBody, { color: theme.text }]}>{test.expectedBad}</Text>
              </View>
            </View>

            <View style={styles.testNoteWrap}>
              <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Test notes (optional)</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.backgroundTertiary }]}
                placeholder="Record measurements or observations..."
                placeholderTextColor={theme.textMuted}
                value={testNotes}
                onChangeText={setTestNotes}
                testID={`input-test-notes-${test.id}`}
              />
            </View>

            <View style={styles.testRecordRow}>
              <Pressable
                style={[styles.testRecordBtn, { backgroundColor: theme.success }]}
                onPress={() => handleRecordTestResult(test.id, "pass")}
                testID={`button-test-pass-${test.id}`}
              >
                <Feather name="check" size={16} color="#FFFFFF" />
                <Text style={styles.testRecordBtnText}>Pass</Text>
              </Pressable>
              <Pressable
                style={[styles.testRecordBtn, { backgroundColor: theme.error }]}
                onPress={() => handleRecordTestResult(test.id, "fail")}
                testID={`button-test-fail-${test.id}`}
              >
                <Feather name="x" size={16} color="#FFFFFF" />
                <Text style={styles.testRecordBtnText}>Fail</Text>
              </Pressable>
              <Pressable
                style={[styles.testRecordBtn, { backgroundColor: theme.accent }]}
                onPress={() => handleRecordTestResult(test.id, "inconclusive")}
                testID={`button-test-inconclusive-${test.id}`}
              >
                <Feather name="minus" size={16} color="#FFFFFF" />
                <Text style={styles.testRecordBtnText}>Unclear</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderExportView = () => {
    if (!category) return null;
    const summary = generateExportSummary(session, category);

    return (
      <View>
        <Pressable style={styles.backRow} onPress={() => setShowExport(false)} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={theme.textSecondary} />
          <Text style={[styles.backText, { color: theme.textSecondary }]}>Back to Dashboard</Text>
        </Pressable>

        <View style={styles.phaseHeader}>
          <Text style={[styles.phaseTitle, { color: theme.text }]}>Diagnostic Report</Text>
          <Text style={[styles.phaseSubtitle, { color: theme.textSecondary }]}>
            Share with your shop or save for reference
          </Text>
        </View>

        <View style={[styles.exportCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
          <Text style={[styles.exportSectionTitle, { color: theme.primary }]}>Vehicle</Text>
          <Text style={[styles.exportText, { color: theme.text }]}>
            {[summary.vehicle.year, summary.vehicle.make, summary.vehicle.model].filter(Boolean).join(" ")}
            {summary.vehicle.engine ? ` - ${summary.vehicle.engine}` : ""}
          </Text>
          {summary.vehicle.mileage ? (
            <Text style={[styles.exportTextSub, { color: theme.textMuted }]}>Mileage: {summary.vehicle.mileage.toLocaleString()}</Text>
          ) : null}

          <Text style={[styles.exportSectionTitle, { color: theme.primary, marginTop: Spacing.md }]}>Complaint</Text>
          <Text style={[styles.exportText, { color: theme.text }]}>{summary.complaint}</Text>

          {summary.dtcCodes.length > 0 ? (
            <>
              <Text style={[styles.exportSectionTitle, { color: theme.primary, marginTop: Spacing.md }]}>DTC Codes</Text>
              <Text style={[styles.exportText, { color: theme.text }]}>{summary.dtcCodes.join(", ")}</Text>
            </>
          ) : null}

          {summary.symptoms.length > 0 ? (
            <>
              <Text style={[styles.exportSectionTitle, { color: theme.primary, marginTop: Spacing.md }]}>Symptoms</Text>
              {summary.symptoms.map((s, i) => (
                <Text key={i} style={[styles.exportTextSub, { color: theme.text }]}>- {s}</Text>
              ))}
            </>
          ) : null}

          {summary.testsPerformed.length > 0 ? (
            <>
              <Text style={[styles.exportSectionTitle, { color: theme.primary, marginTop: Spacing.md }]}>Tests Performed</Text>
              {summary.testsPerformed.map((t, i) => (
                <View key={i} style={styles.exportTestRow}>
                  <Feather
                    name={t.result === "pass" ? "check-circle" : t.result === "fail" ? "x-circle" : "minus-circle"}
                    size={14}
                    color={t.result === "pass" ? theme.success : t.result === "fail" ? theme.error : theme.accent}
                  />
                  <Text style={[styles.exportText, { color: theme.text }]}>{t.name}: {t.result}</Text>
                </View>
              ))}
            </>
          ) : null}

          <Text style={[styles.exportSectionTitle, { color: theme.primary, marginTop: Spacing.md }]}>Likely Causes</Text>
          {summary.likelyCauses.map((c, i) => (
            <View key={i} style={[styles.exportCauseCard, { borderColor: theme.cardBorder }]}>
              <View style={styles.exportCauseHeader}>
                <Text style={[styles.exportCauseRank, { color: theme.primary }]}>#{i + 1}</Text>
                <Text style={[styles.exportText, { color: theme.text, flex: 1 }]}>{c.name}</Text>
                <Text style={[styles.exportCausePct, { color: theme.primary }]}>{c.confidence}%</Text>
              </View>
              {c.supportingEvidence.length > 0 ? (
                <View style={styles.exportEvidenceRow}>
                  <Feather name="plus-circle" size={11} color={theme.success} />
                  <Text style={[styles.exportEvidenceText, { color: theme.textMuted }]}>
                    {c.supportingEvidence.join(" / ")}
                  </Text>
                </View>
              ) : null}
              {c.contradictingEvidence.length > 0 ? (
                <View style={styles.exportEvidenceRow}>
                  <Feather name="minus-circle" size={11} color={theme.error} />
                  <Text style={[styles.exportEvidenceText, { color: theme.textMuted }]}>
                    {c.contradictingEvidence.join(" / ")}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}

          <Text style={[styles.exportSectionTitle, { color: theme.primary, marginTop: Spacing.md }]}>Next Step</Text>
          <Text style={[styles.exportText, { color: theme.text }]}>{summary.recommendedNextStep}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 }]}
          onPress={handleExportCopy}
          testID="button-copy-summary"
        >
          <Feather name="copy" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Copy to Clipboard</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {session.phase === "intake" ? renderIntakePhase() : null}
      {session.phase === "category" ? renderCategoryPhase() : null}
      {session.phase === "narrowing" ? renderNarrowingPhase() : null}
      {session.phase === "diagnosis" ? renderDiagnosisPhase() : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },

  phaseHeader: { alignItems: "center", marginBottom: Spacing.xl },
  phaseIconBg: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: Spacing.md },
  phaseTitle: { ...Typography.h2, textAlign: "center", marginBottom: Spacing.xs },
  phaseSubtitle: { ...Typography.body, textAlign: "center" },

  sectionWrap: { marginBottom: Spacing.lg },
  sectionLabel: { ...Typography.small, fontWeight: "600", marginBottom: Spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 },

  vehicleScroll: { marginBottom: Spacing.sm },
  vehicleChip: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, marginRight: Spacing.sm },
  vehicleChipText: { ...Typography.small, fontWeight: "500" },

  inputRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.sm },
  inputHalf: { flex: 1 },
  inputLabel: { ...Typography.caption, marginBottom: 4, fontWeight: "500" },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, ...Typography.body },
  multilineInput: { minHeight: 72, textAlignVertical: "top" },

  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, paddingVertical: 14, borderRadius: BorderRadius.md },
  primaryButtonText: { color: "#FFFFFF", ...Typography.h4 },

  backRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.md },
  backText: { ...Typography.body },

  vehicleSnap: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.lg },
  vehicleSnapText: { ...Typography.body, fontWeight: "600" },
  vehicleSnapSub: { ...Typography.caption, marginLeft: "auto" },

  categoryBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full, marginLeft: "auto" },
  categoryBadgeText: { ...Typography.caption, fontWeight: "600" },

  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  categoryCard: { width: "47%", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: "center" },
  catIconBg: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: Spacing.sm },
  catName: { ...Typography.h4, marginBottom: 2, textAlign: "center" },
  catDesc: { ...Typography.caption, textAlign: "center" },
  dtcMatchBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full, marginTop: Spacing.xs },
  dtcMatchText: { ...Typography.caption, fontWeight: "600", fontSize: 10 },
  dtcChipRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.md },
  dtcChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1 },
  dtcChipText: { ...Typography.caption, fontWeight: "700", fontSize: 11 },

  progressWrap: { height: 6, borderRadius: 3, overflow: "hidden", marginBottom: Spacing.xs },
  progressFill: { height: "100%", borderRadius: 3 },
  progressLabel: { ...Typography.caption, marginBottom: Spacing.lg },

  miniHypotheses: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.lg },
  miniHypTitle: { ...Typography.caption, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: Spacing.sm },
  miniHypRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs },
  miniHypBar: { width: 60, height: 4, borderRadius: 2, overflow: "hidden" },
  miniHypFill: { height: "100%", borderRadius: 2 },
  miniHypName: { ...Typography.small, flex: 1 },
  miniHypPct: { ...Typography.caption, fontWeight: "700", width: 36, textAlign: "right" },

  answeredSection: { marginBottom: Spacing.lg },
  answeredTitle: { ...Typography.caption, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: Spacing.sm },
  answeredItem: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.xs },
  answeredQ: { ...Typography.caption },
  answeredA: { ...Typography.small, fontWeight: "600" },

  questionCard: { padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
  questionHeader: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md, marginBottom: Spacing.md },
  qNumBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  qNumText: { color: "#FFFFFF", ...Typography.small, fontWeight: "700" },
  questionText: { ...Typography.h4, flex: 1, lineHeight: 24 },
  whyBox: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.sm, marginBottom: Spacing.md },
  whyText: { ...Typography.small, flex: 1 },

  optionsList: { gap: Spacing.sm },
  optionButton: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
  optionRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  optionRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
  optionLabel: { ...Typography.body, flex: 1 },

  allAnsweredCard: { padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: "center", gap: Spacing.sm },
  allAnsweredText: { ...Typography.h4 },
  allAnsweredSub: { ...Typography.small, textAlign: "center" },

  dashCard: { padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
  dashCardHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md },
  dashCardTitle: { ...Typography.h4 },
  dashCardSubtitle: { ...Typography.caption, marginLeft: "auto" },

  summaryBanner: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
  summaryBannerText: { ...Typography.body, flex: 1 },

  hypCard: { marginBottom: Spacing.md },
  hypHeader: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  hypRank: { ...Typography.h3, fontWeight: "700", width: 30 },
  hypName: { ...Typography.body, fontWeight: "600" },
  hypDesc: { ...Typography.caption, marginTop: 2 },
  hypConfidence: { alignItems: "flex-end" },
  hypPct: { ...Typography.h3, fontWeight: "700" },
  hypBar: { height: 4, borderRadius: 2, marginTop: Spacing.sm, marginBottom: Spacing.sm, overflow: "hidden" },
  hypBarFill: { height: "100%", borderRadius: 2 },
  hypMeta: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, flexWrap: "wrap" },
  hypMetaTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  hypMetaTagText: { ...Typography.caption, fontWeight: "600" },
  hypCost: { ...Typography.caption, marginLeft: "auto" },
  hypToolRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.xs },
  hypToolText: { ...Typography.caption },
  evidenceSection: { marginTop: Spacing.sm },
  evidenceLabel: { ...Typography.caption, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, fontSize: 10 },
  evidenceChips: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  evidenceChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full, borderWidth: 1 },
  evidenceChipText: { ...Typography.caption, fontSize: 10 },

  testCard: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm, marginBottom: Spacing.sm },
  testHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  testName: { ...Typography.body, fontWeight: "600" },
  testPurpose: { ...Typography.caption, marginTop: 2 },
  diffBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  diffBadgeText: { ...Typography.caption, fontWeight: "600", textTransform: "capitalize" },
  testExpanded: { marginTop: Spacing.md, paddingTop: Spacing.md },
  testDiscriminates: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, padding: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, marginBottom: Spacing.md },
  testDiscriminatesText: { ...Typography.caption, flex: 1 },
  testSection: { marginBottom: Spacing.md },
  testSectionTitle: { ...Typography.caption, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  testSectionBody: { ...Typography.body },
  testResultsGrid: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  testResultBox: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, gap: 4 },
  testResultLabel: { ...Typography.caption, fontWeight: "600" },
  testResultBody: { ...Typography.small },
  testNoteWrap: { marginBottom: Spacing.md },
  testRecordRow: { flexDirection: "row", gap: Spacing.sm },
  testRecordBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.xs, paddingVertical: 10, borderRadius: BorderRadius.md },
  testRecordBtnText: { color: "#FFFFFF", ...Typography.small, fontWeight: "600" },

  completedTest: { paddingVertical: Spacing.sm, borderBottomWidth: 1, marginBottom: Spacing.xs },
  completedTestHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  completedTestName: { ...Typography.body, fontWeight: "500", flex: 1 },
  resultBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  resultBadgeText: { ...Typography.caption, fontWeight: "700" },
  completedTestNotes: { ...Typography.caption, marginTop: 4, marginLeft: 26 },

  actionRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.md },
  actionButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, paddingVertical: 12, borderRadius: BorderRadius.md },
  actionButtonText: { color: "#FFFFFF", ...Typography.small, fontWeight: "600" },

  askHelpCard: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
  askHelpTitle: { ...Typography.body, fontWeight: "600", marginBottom: 2 },
  askHelpDesc: { ...Typography.caption },

  resetButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, paddingVertical: 12, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.xl },
  resetText: { ...Typography.body, fontWeight: "600" },

  exportCard: { padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.lg },
  exportSectionTitle: { ...Typography.caption, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  exportText: { ...Typography.body, marginBottom: 2 },
  exportTextSub: { ...Typography.small, marginBottom: 2 },
  exportTestRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: 4 },
  exportCauseCard: { borderBottomWidth: 1, paddingVertical: Spacing.sm, marginBottom: Spacing.xs },
  exportCauseHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  exportCauseRank: { ...Typography.body, fontWeight: "700" },
  exportCausePct: { ...Typography.body, fontWeight: "700" },
  exportEvidenceRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 4, paddingLeft: Spacing.lg },
  exportEvidenceText: { ...Typography.caption, flex: 1 },
});
