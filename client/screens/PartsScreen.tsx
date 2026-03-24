import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius, Colors } from "@/constants/theme";
import { emptyStates } from "@/constants/brand";

interface DiagnosticCategory {
  id: string;
  name: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
  symptoms: Symptom[];
}

interface Symptom {
  id: string;
  name: string;
  checks: Check[];
  parts: Part[];
  torqueSpecs: TorqueSpec[];
}

interface Check {
  id: string;
  step: number;
  action: string;
  tools: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  completed: boolean;
}

interface Part {
  name: string;
  priority: "high" | "medium" | "low";
  estimatedCost: string;
}

interface TorqueSpec {
  component: string;
  spec: string;
  notes: string | null;
}

const DIAGNOSTIC_CATEGORIES: DiagnosticCategory[] = [
  {
    id: "brakes",
    name: "Brakes",
    icon: "disc",
    description: "Squeaking, grinding, soft pedal",
    symptoms: [
      {
        id: "squeaking",
        name: "Squeaking or squealing",
        checks: [
          { id: "1", step: 1, action: "Visually inspect brake pad thickness through wheel spokes", tools: ["Flashlight"], difficulty: "beginner", completed: false },
          { id: "2", step: 2, action: "Check rotor surface for scoring or grooves", tools: ["Flashlight", "Inspection mirror"], difficulty: "beginner", completed: false },
          { id: "3", step: 3, action: "Check brake fluid level and color", tools: [], difficulty: "beginner", completed: false },
          { id: "4", step: 4, action: "Measure rotor thickness with micrometer", tools: ["Micrometer", "Jack", "Jack stands"], difficulty: "intermediate", completed: false },
        ],
        parts: [
          { name: "Brake pad set (front)", priority: "high", estimatedCost: "$30-80" },
          { name: "Brake rotor (each)", priority: "medium", estimatedCost: "$40-100" },
        ],
        torqueSpecs: [
          { component: "Caliper bracket bolts", spec: "85-95 ft-lbs", notes: "Use thread locker" },
          { component: "Caliper slide pins", spec: "25-35 ft-lbs", notes: "Apply brake grease" },
          { component: "Wheel lug nuts", spec: "100-110 ft-lbs", notes: "Torque in star pattern" },
        ],
      },
      {
        id: "grinding",
        name: "Grinding noise",
        checks: [
          { id: "1", step: 1, action: "STOP DRIVING - Grinding indicates metal-on-metal contact", tools: [], difficulty: "beginner", completed: false },
          { id: "2", step: 2, action: "Remove wheel and inspect pads - should be >2mm thick", tools: ["Jack", "Jack stands", "Lug wrench"], difficulty: "beginner", completed: false },
          { id: "3", step: 3, action: "Check rotors for deep grooves or blue discoloration", tools: ["Flashlight"], difficulty: "beginner", completed: false },
          { id: "4", step: 4, action: "Inspect caliper for damage or seized pistons", tools: ["Caliper piston tool"], difficulty: "intermediate", completed: false },
        ],
        parts: [
          { name: "Brake pad set (front)", priority: "high", estimatedCost: "$30-80" },
          { name: "Brake rotor (each)", priority: "high", estimatedCost: "$40-100" },
          { name: "Brake caliper", priority: "medium", estimatedCost: "$60-150" },
        ],
        torqueSpecs: [
          { component: "Caliper bracket bolts", spec: "85-95 ft-lbs", notes: "Use thread locker" },
          { component: "Wheel lug nuts", spec: "100-110 ft-lbs", notes: "Torque in star pattern" },
        ],
      },
      {
        id: "soft-pedal",
        name: "Soft or spongy pedal",
        checks: [
          { id: "1", step: 1, action: "Check brake fluid reservoir level", tools: [], difficulty: "beginner", completed: false },
          { id: "2", step: 2, action: "Inspect brake lines for leaks or wet spots", tools: ["Flashlight"], difficulty: "beginner", completed: false },
          { id: "3", step: 3, action: "Bleed brakes starting from furthest wheel", tools: ["Brake bleeder kit", "Fresh DOT 4 fluid"], difficulty: "intermediate", completed: false },
          { id: "4", step: 4, action: "Check master cylinder for internal leaks", tools: [], difficulty: "advanced", completed: false },
        ],
        parts: [
          { name: "Brake fluid (DOT 4)", priority: "high", estimatedCost: "$10-20" },
          { name: "Brake bleeder kit", priority: "medium", estimatedCost: "$20-40" },
          { name: "Master cylinder", priority: "low", estimatedCost: "$100-200" },
        ],
        torqueSpecs: [
          { component: "Brake line fittings", spec: "10-15 ft-lbs", notes: "Use flare nut wrench" },
          { component: "Master cylinder nuts", spec: "15-20 ft-lbs", notes: null },
        ],
      },
    ],
  },
  {
    id: "engine",
    name: "Engine",
    icon: "settings",
    description: "Leaks, noises, performance",
    symptoms: [
      {
        id: "oil-leak",
        name: "Oil leak",
        checks: [
          { id: "1", step: 1, action: "Check oil level on dipstick", tools: [], difficulty: "beginner", completed: false },
          { id: "2", step: 2, action: "Clean engine and look for fresh oil after running", tools: ["Degreaser", "Paper towels"], difficulty: "beginner", completed: false },
          { id: "3", step: 3, action: "Check valve cover gasket area for wetness", tools: ["Flashlight"], difficulty: "beginner", completed: false },
          { id: "4", step: 4, action: "Inspect oil pan gasket and drain plug", tools: ["Flashlight", "Jack", "Jack stands"], difficulty: "intermediate", completed: false },
        ],
        parts: [
          { name: "Valve cover gasket set", priority: "high", estimatedCost: "$15-50" },
          { name: "Oil pan gasket", priority: "medium", estimatedCost: "$20-60" },
          { name: "Oil drain plug with washer", priority: "low", estimatedCost: "$5-15" },
        ],
        torqueSpecs: [
          { component: "Valve cover bolts", spec: "7-10 ft-lbs", notes: "Tighten from center out" },
          { component: "Oil pan bolts", spec: "15-22 ft-lbs", notes: "Use new gasket" },
          { component: "Oil drain plug", spec: "20-25 ft-lbs", notes: "Use new crush washer" },
        ],
      },
      {
        id: "rough-idle",
        name: "Rough idle or misfire",
        checks: [
          { id: "1", step: 1, action: "Scan for trouble codes with OBD2 scanner", tools: ["OBD2 scanner"], difficulty: "beginner", completed: false },
          { id: "2", step: 2, action: "Inspect spark plugs for wear or fouling", tools: ["Spark plug socket", "Ratchet"], difficulty: "beginner", completed: false },
          { id: "3", step: 3, action: "Check ignition coils for cracks or damage", tools: [], difficulty: "beginner", completed: false },
          { id: "4", step: 4, action: "Inspect vacuum hoses for cracks or disconnections", tools: [], difficulty: "beginner", completed: false },
        ],
        parts: [
          { name: "Spark plug set", priority: "high", estimatedCost: "$20-60" },
          { name: "Ignition coil", priority: "medium", estimatedCost: "$30-80" },
          { name: "Spark plug wires", priority: "medium", estimatedCost: "$30-60" },
        ],
        torqueSpecs: [
          { component: "Spark plugs", spec: "12-18 ft-lbs", notes: "Do not overtighten" },
          { component: "Ignition coil bolts", spec: "7-10 ft-lbs", notes: null },
        ],
      },
      {
        id: "overheating",
        name: "Overheating",
        checks: [
          { id: "1", step: 1, action: "Let engine cool completely before opening hood", tools: [], difficulty: "beginner", completed: false },
          { id: "2", step: 2, action: "Check coolant level in overflow tank and radiator", tools: [], difficulty: "beginner", completed: false },
          { id: "3", step: 3, action: "Inspect radiator hoses for cracks or soft spots", tools: [], difficulty: "beginner", completed: false },
          { id: "4", step: 4, action: "Check radiator cap seal and pressure rating", tools: ["Cooling system pressure tester"], difficulty: "intermediate", completed: false },
          { id: "5", step: 5, action: "Test thermostat operation in boiling water", tools: ["Thermometer", "Pot"], difficulty: "intermediate", completed: false },
        ],
        parts: [
          { name: "Coolant (50/50 mix)", priority: "high", estimatedCost: "$15-25" },
          { name: "Thermostat", priority: "medium", estimatedCost: "$15-40" },
          { name: "Radiator cap", priority: "low", estimatedCost: "$10-20" },
          { name: "Water pump", priority: "low", estimatedCost: "$50-150" },
        ],
        torqueSpecs: [
          { component: "Thermostat housing bolts", spec: "15-20 ft-lbs", notes: null },
          { component: "Water pump bolts", spec: "15-22 ft-lbs", notes: "Use new gasket" },
        ],
      },
    ],
  },
  {
    id: "electrical",
    name: "Electrical",
    icon: "zap",
    description: "Battery, starting, lights",
    symptoms: [
      {
        id: "no-start",
        name: "Won't start / no crank",
        checks: [
          { id: "1", step: 1, action: "Check if dashboard lights come on with key", tools: [], difficulty: "beginner", completed: false },
          { id: "2", step: 2, action: "Test battery voltage with multimeter (12.4-12.7V)", tools: ["Multimeter"], difficulty: "beginner", completed: false },
          { id: "3", step: 3, action: "Inspect battery terminals for corrosion", tools: ["Terminal cleaner brush"], difficulty: "beginner", completed: false },
          { id: "4", step: 4, action: "Check starter connections and ground straps", tools: ["Flashlight"], difficulty: "intermediate", completed: false },
        ],
        parts: [
          { name: "Automotive battery", priority: "high", estimatedCost: "$100-200" },
          { name: "Battery terminal cleaner", priority: "medium", estimatedCost: "$5-10" },
          { name: "Starter motor", priority: "low", estimatedCost: "$100-300" },
        ],
        torqueSpecs: [
          { component: "Battery terminal bolts", spec: "5-7 ft-lbs", notes: "Do not overtighten" },
          { component: "Starter mounting bolts", spec: "30-40 ft-lbs", notes: "Varies by vehicle" },
        ],
      },
      {
        id: "check-engine",
        name: "Check engine light",
        checks: [
          { id: "1", step: 1, action: "Scan for diagnostic trouble codes (DTCs)", tools: ["OBD2 scanner"], difficulty: "beginner", completed: false },
          { id: "2", step: 2, action: "Check gas cap seal and ensure tight fit", tools: [], difficulty: "beginner", completed: false },
          { id: "3", step: 3, action: "Record code numbers and research specific causes", tools: [], difficulty: "beginner", completed: false },
          { id: "4", step: 4, action: "Clear codes and monitor if they return", tools: ["OBD2 scanner"], difficulty: "beginner", completed: false },
        ],
        parts: [
          { name: "Gas cap with seal", priority: "high", estimatedCost: "$10-25" },
          { name: "Oxygen sensor", priority: "medium", estimatedCost: "$30-100" },
          { name: "Mass airflow sensor", priority: "medium", estimatedCost: "$40-150" },
        ],
        torqueSpecs: [],
      },
    ],
  },
  {
    id: "suspension",
    name: "Suspension",
    icon: "truck",
    description: "Ride quality, noises, handling",
    symptoms: [
      {
        id: "clunking",
        name: "Clunking over bumps",
        checks: [
          { id: "1", step: 1, action: "Bounce each corner of vehicle and listen for noise", tools: [], difficulty: "beginner", completed: false },
          { id: "2", step: 2, action: "Inspect sway bar end links for play or worn bushings", tools: ["Flashlight"], difficulty: "beginner", completed: false },
          { id: "3", step: 3, action: "Check ball joints by rocking wheel at 12 and 6 o'clock", tools: ["Jack", "Jack stands"], difficulty: "intermediate", completed: false },
          { id: "4", step: 4, action: "Inspect strut mounts for cracks or separation", tools: ["Flashlight"], difficulty: "intermediate", completed: false },
        ],
        parts: [
          { name: "Sway bar end links (pair)", priority: "high", estimatedCost: "$30-60" },
          { name: "Ball joint", priority: "medium", estimatedCost: "$40-100" },
          { name: "Strut mount", priority: "medium", estimatedCost: "$30-80" },
        ],
        torqueSpecs: [
          { component: "Sway bar end link nuts", spec: "35-45 ft-lbs", notes: null },
          { component: "Ball joint nuts", spec: "60-80 ft-lbs", notes: "Use cotter pin" },
          { component: "Strut mount nuts", spec: "30-40 ft-lbs", notes: null },
        ],
      },
      {
        id: "pulling",
        name: "Pulling to one side",
        checks: [
          { id: "1", step: 1, action: "Check tire pressures on all four tires", tools: ["Tire pressure gauge"], difficulty: "beginner", completed: false },
          { id: "2", step: 2, action: "Inspect tires for uneven wear patterns", tools: [], difficulty: "beginner", completed: false },
          { id: "3", step: 3, action: "Check for brake dragging (wheel hot after driving)", tools: [], difficulty: "beginner", completed: false },
          { id: "4", step: 4, action: "Schedule wheel alignment check", tools: ["Alignment machine"], difficulty: "advanced", completed: false },
        ],
        parts: [
          { name: "Tie rod end", priority: "medium", estimatedCost: "$25-60" },
          { name: "Control arm bushing", priority: "low", estimatedCost: "$30-80" },
        ],
        torqueSpecs: [
          { component: "Tie rod end nut", spec: "35-45 ft-lbs", notes: "Use cotter pin" },
        ],
      },
    ],
  },
];

type WizardStep = "category" | "symptom" | "checklist" | "results";

const difficultyColors: Record<string, string> = {
  beginner: Colors.dark.success,
  intermediate: Colors.dark.accent,
  advanced: Colors.dark.error,
};

const priorityColors: Record<string, string> = {
  high: Colors.dark.error,
  medium: Colors.dark.accent,
  low: Colors.dark.success,
};

export default function PartsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useSafeTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [step, setStep] = useState<WizardStep>("category");
  const [selectedCategory, setSelectedCategory] = useState<DiagnosticCategory | null>(null);
  const [selectedSymptom, setSelectedSymptom] = useState<Symptom | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [notes, setNotes] = useState("");

  const handleSelectCategory = (category: DiagnosticCategory) => {
    setSelectedCategory(category);
    setStep("symptom");
  };

  const handleSelectSymptom = (symptom: Symptom) => {
    setSelectedSymptom(symptom);
    setChecks(symptom.checks.map(c => ({ ...c, completed: false })));
    setStep("checklist");
  };

  const handleToggleCheck = (checkId: string) => {
    setChecks(prev =>
      prev.map(c =>
        c.id === checkId ? { ...c, completed: !c.completed } : c
      )
    );
  };

  const handleViewResults = () => {
    setStep("results");
  };

  const handleReset = () => {
    setStep("category");
    setSelectedCategory(null);
    setSelectedSymptom(null);
    setChecks([]);
    setNotes("");
  };

  const completedCount = checks.filter(c => c.completed).length;
  const progress = checks.length > 0 ? completedCount / checks.length : 0;

  const renderCategoryStep = () => (
    <View>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: theme.primary + "15" }]}>
          <Feather name="tool" size={32} color={theme.primary} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>
          {emptyStates.parts.title}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Select a system to diagnose
        </Text>
      </View>

      <View style={styles.categoryGrid}>
        {DIAGNOSTIC_CATEGORIES.map(category => (
          <Pressable
            key={category.id}
            style={({ pressed }) => [
              styles.categoryCard,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.cardBorder,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            onPress={() => handleSelectCategory(category)}
            testID={`category-${category.id}`}
          >
            <View style={[styles.categoryIconBg, { backgroundColor: theme.primary + "15" }]}>
              <Feather name={category.icon} size={24} color={theme.primary} />
            </View>
            <Text style={[styles.categoryName, { color: theme.text }]}>
              {category.name}
            </Text>
            <Text style={[styles.categoryDesc, { color: theme.textSecondary }]}>
              {category.description}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderSymptomStep = () => {
    if (!selectedCategory) return null;
    
    return (
    <View>
      <Pressable
        style={styles.backButton}
        onPress={() => setStep("category")}
        hitSlop={8}
      >
        <Feather name="arrow-left" size={20} color={theme.textSecondary} />
        <Text style={[styles.backText, { color: theme.textSecondary }]}>Back</Text>
      </Pressable>

      <View style={styles.stepHeader}>
        <View style={[styles.categoryIconBg, { backgroundColor: theme.primary + "15" }]}>
          <Feather name={selectedCategory.icon} size={24} color={theme.primary} />
        </View>
        <Text style={[styles.stepTitle, { color: theme.text }]}>
          {selectedCategory.name} Issues
        </Text>
        <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          What symptom are you experiencing?
        </Text>
      </View>

      <View style={styles.symptomList}>
        {selectedCategory.symptoms.map(symptom => (
          <Pressable
            key={symptom.id}
            style={({ pressed }) => [
              styles.symptomCard,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.cardBorder,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            onPress={() => handleSelectSymptom(symptom)}
            testID={`symptom-${symptom.id}`}
          >
            <Text style={[styles.symptomName, { color: theme.text }]}>
              {symptom.name}
            </Text>
            <View style={styles.symptomMeta}>
              <Text style={[styles.symptomSteps, { color: theme.textMuted }]}>
                {symptom.checks.length} diagnostic steps
              </Text>
              <Feather name="chevron-right" size={18} color={theme.textMuted} />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
    );
  };

  const renderChecklistStep = () => {
    if (!selectedSymptom) return null;
    
    return (
    <View>
      <Pressable
        style={styles.backButton}
        onPress={() => setStep("symptom")}
        hitSlop={8}
      >
        <Feather name="arrow-left" size={20} color={theme.textSecondary} />
        <Text style={[styles.backText, { color: theme.textSecondary }]}>Back</Text>
      </Pressable>

      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: theme.text }]}>
          {selectedSymptom.name}
        </Text>
        <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          Work through each step to diagnose the issue
        </Text>
      </View>

      <View style={[styles.progressBar, { backgroundColor: theme.backgroundTertiary }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: theme.primary, width: `${progress * 100}%` },
          ]}
        />
      </View>
      <Text style={[styles.progressText, { color: theme.textSecondary }]}>
        {completedCount} of {checks.length} steps completed
      </Text>

      <View style={styles.checkList}>
        {checks.map(check => (
          <Pressable
            key={check.id}
            style={[
              styles.checkItem,
              {
                backgroundColor: check.completed
                  ? theme.success + "10"
                  : theme.backgroundSecondary,
                borderColor: check.completed ? theme.success + "40" : theme.cardBorder,
              },
            ]}
            onPress={() => handleToggleCheck(check.id)}
            testID={`check-${check.id}`}
          >
            <View style={styles.checkHeader}>
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: check.completed ? theme.success : "transparent",
                    borderColor: check.completed ? theme.success : theme.textMuted,
                  },
                ]}
              >
                {check.completed ? (
                  <Feather name="check" size={14} color="#FFFFFF" />
                ) : null}
              </View>
              <View style={[styles.stepBadge, { backgroundColor: theme.primary }]}>
                <Text style={styles.stepNum}>{check.step}</Text>
              </View>
              <View
                style={[
                  styles.difficultyBadge,
                  { backgroundColor: difficultyColors[check.difficulty] + "20" },
                ]}
              >
                <Text
                  style={[
                    styles.difficultyText,
                    { color: difficultyColors[check.difficulty] },
                  ]}
                >
                  {check.difficulty}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.checkAction,
                {
                  color: check.completed ? theme.textSecondary : theme.text,
                  textDecorationLine: check.completed ? "line-through" : "none",
                },
              ]}
            >
              {check.action}
            </Text>
            {check.tools.length > 0 ? (
              <View style={styles.toolsRow}>
                <Feather name="tool" size={12} color={theme.textMuted} />
                <Text style={[styles.toolsText, { color: theme.textMuted }]}>
                  {check.tools.join(", ")}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      <View style={styles.notesSection}>
        <Text style={[styles.notesLabel, { color: theme.text }]}>Notes</Text>
        <TextInput
          style={[
            styles.notesInput,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.cardBorder,
              color: theme.text,
            },
          ]}
          placeholder="Record your observations..."
          placeholderTextColor={theme.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          testID="input-notes"
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.resultsButton,
          {
            backgroundColor: theme.primary,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
        onPress={handleViewResults}
        testID="button-view-results"
      >
        <Feather name="list" size={18} color="#FFFFFF" />
        <Text style={styles.resultsButtonText}>View Parts & Specs</Text>
      </Pressable>
    </View>
    );
  };

  const renderResultsStep = () => {
    if (!selectedCategory || !selectedSymptom) return null;
    
    return (
    <View>
      <Pressable
        style={styles.backButton}
        onPress={() => setStep("checklist")}
        hitSlop={8}
      >
        <Feather name="arrow-left" size={20} color={theme.textSecondary} />
        <Text style={[styles.backText, { color: theme.textSecondary }]}>Back to Checklist</Text>
      </Pressable>

      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: theme.text }]}>
          Diagnostic Summary
        </Text>
        <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          {selectedCategory.name} - {selectedSymptom.name}
        </Text>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
            Steps Completed
          </Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {completedCount} of {checks.length}
          </Text>
        </View>
        {notes ? (
          <View style={styles.summaryNotes}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              Your Notes
            </Text>
            <Text style={[styles.notesText, { color: theme.text }]}>{notes}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Suggested Parts
      </Text>
      {selectedSymptom.parts.map((part, index) => (
        <View
          key={index}
          style={[
            styles.partCard,
            { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder },
          ]}
        >
          <View style={styles.partHeader}>
            <Text style={[styles.partName, { color: theme.text }]}>{part.name}</Text>
            <View
              style={[styles.priorityDot, { backgroundColor: priorityColors[part.priority] }]}
            />
          </View>
          <View style={styles.partDetails}>
            <Text style={[styles.partPriority, { color: theme.textSecondary }]}>
              {part.priority} priority
            </Text>
            <Text style={[styles.partCost, { color: theme.primary }]}>
              {part.estimatedCost}
            </Text>
          </View>
        </View>
      ))}

      {selectedSymptom.torqueSpecs.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Torque Specifications
          </Text>
          <View
            style={[
              styles.specsTable,
              { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder },
            ]}
          >
            {selectedSymptom.torqueSpecs.map((spec, index) => (
              <View
                key={index}
                style={[
                  styles.specRow,
                  index < selectedSymptom.torqueSpecs.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.cardBorder,
                  },
                ]}
              >
                <Text style={[styles.specComponent, { color: theme.text }]}>
                  {spec.component}
                </Text>
                <Text style={[styles.specValue, { color: theme.primary }]}>
                  {spec.spec}
                </Text>
                {spec.notes ? (
                  <Text style={[styles.specNotes, { color: theme.textMuted }]}>
                    {spec.notes}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </>
      ) : null}

      <View style={[styles.disclaimer, { backgroundColor: theme.backgroundTertiary }]}>
        <Feather name="info" size={14} color={theme.textMuted} />
        <Text style={[styles.disclaimerText, { color: theme.textMuted }]}>
          Torque specs are general guidelines. Always verify with your vehicle's
          service manual.
        </Text>
      </View>

      <View style={[styles.askHelpCard, { backgroundColor: theme.primary + "10", borderColor: theme.primary + "30" }]}>
        <Feather name="users" size={20} color={theme.primary} />
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={[styles.askHelpTitle, { color: theme.text }]}>
            Still stuck?
          </Text>
          <Text style={[styles.askHelpDesc, { color: theme.textSecondary }]}>
            Post a structured help request to the community with your symptoms and diagnostics.
          </Text>
        </View>
        <Pressable
          style={[styles.askHelpButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate("AskForHelp")}
          testID="button-ask-help-torqueassist"
        >
          <Text style={styles.askHelpButtonText}>Ask for Help</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.resetButton,
          {
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.cardBorder,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
        onPress={handleReset}
        testID="button-new-diagnosis"
      >
        <Feather name="refresh-cw" size={18} color={theme.primary} />
        <Text style={[styles.resetButtonText, { color: theme.primary }]}>
          Start New Diagnosis
        </Text>
      </Pressable>
    </View>
    );
  };

  return (
    <ScrollView
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
      {step === "category" ? renderCategoryStep() : null}
      {step === "symptom" ? renderSymptomStep() : null}
      {step === "checklist" ? renderChecklistStep() : null}
      {step === "results" ? renderResultsStep() : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  subtitle: {
    ...Typography.body,
    textAlign: "center",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  categoryCard: {
    width: "47%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  categoryIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  categoryName: {
    ...Typography.h4,
    marginBottom: Spacing.xxs,
  },
  categoryDesc: {
    ...Typography.caption,
    textAlign: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  backText: {
    ...Typography.body,
  },
  stepHeader: {
    marginBottom: Spacing.lg,
  },
  stepTitle: {
    ...Typography.h2,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    ...Typography.body,
  },
  symptomList: {
    gap: Spacing.md,
  },
  symptomCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  symptomName: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  symptomMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  symptomSteps: {
    ...Typography.caption,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: Spacing.xs,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    ...Typography.caption,
    marginBottom: Spacing.lg,
  },
  checkList: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  checkItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  checkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: {
    color: "#FFFFFF",
    ...Typography.caption,
    fontWeight: "700",
  },
  difficultyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginLeft: "auto",
  },
  difficultyText: {
    ...Typography.caption,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  checkAction: {
    ...Typography.body,
    marginLeft: 32,
  },
  toolsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    marginLeft: 32,
  },
  toolsText: {
    ...Typography.caption,
  },
  notesSection: {
    marginBottom: Spacing.lg,
  },
  notesLabel: {
    ...Typography.h4,
    marginBottom: Spacing.sm,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 80,
    ...Typography.body,
    textAlignVertical: "top",
  },
  resultsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  resultsButtonText: {
    color: "#FFFFFF",
    ...Typography.h4,
  },
  summaryCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    ...Typography.body,
  },
  summaryValue: {
    ...Typography.h4,
  },
  summaryNotes: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  notesText: {
    ...Typography.body,
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  partCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  partHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  partName: {
    ...Typography.body,
    fontWeight: "600",
    flex: 1,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  partDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  partPriority: {
    ...Typography.caption,
    textTransform: "capitalize",
  },
  partCost: {
    ...Typography.body,
    fontWeight: "600",
  },
  specsTable: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  specRow: {
    padding: Spacing.md,
  },
  specComponent: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: Spacing.xxs,
  },
  specValue: {
    ...Typography.h4,
  },
  specNotes: {
    ...Typography.caption,
    marginTop: Spacing.xxs,
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  disclaimerText: {
    ...Typography.caption,
    flex: 1,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  resetButtonText: {
    ...Typography.body,
    fontWeight: "600",
  },
  askHelpCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  askHelpTitle: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: 2,
  },
  askHelpDesc: {
    ...Typography.caption,
  },
  askHelpButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  askHelpButtonText: {
    ...Typography.caption,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
