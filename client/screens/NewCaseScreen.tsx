import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { lookupObdCode, searchObdCodes } from "@/constants/obdCodes";
import type { ObdCodeInfo } from "@/constants/obdCodes";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Vehicle {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  nickname: string | null;
  mileage: number | null;
}

interface Garage {
  id: string;
  name: string;
  brandColor: string | null;
}

const SYSTEM_OPTIONS: Array<{ key: string; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { key: "engine", label: "Engine", icon: "cpu" },
  { key: "electrical", label: "Electrical", icon: "zap" },
  { key: "transmission", label: "Transmission", icon: "git-branch" },
  { key: "brakes", label: "Brakes", icon: "octagon" },
  { key: "suspension", label: "Suspension", icon: "trending-up" },
  { key: "cooling", label: "Cooling", icon: "thermometer" },
  { key: "fuel", label: "Fuel", icon: "droplet" },
  { key: "exhaust", label: "Exhaust", icon: "wind" },
  { key: "hvac", label: "HVAC", icon: "cloud-snow" },
  { key: "interior", label: "Interior", icon: "square" },
  { key: "body", label: "Body", icon: "box" },
  { key: "tires", label: "Tires & Wheels", icon: "disc" },
];

const COMMON_SYMPTOMS = [
  "Check Engine Light",
  "Rough Idle",
  "Stalling",
  "Hard Starting",
  "No Crank",
  "No Start",
  "Overheating",
  "Oil Leak",
  "Coolant Leak",
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
  "Misfire",
];

const URGENCY_OPTIONS: Array<{ key: "low" | "normal" | "high" | "stranded"; label: string; description: string }> = [
  { key: "low", label: "Low", description: "Daily driver, plenty of time" },
  { key: "normal", label: "Normal", description: "Want it fixed this week" },
  { key: "high", label: "High", description: "Driving but unsafe / urgent" },
  { key: "stranded", label: "Stranded", description: "Vehicle won't move" },
];

const TOOLS_AVAILABLE = [
  "Basic hand tools",
  "Sockets / wrenches",
  "OBD2 scanner",
  "Multimeter",
  "Floor jack & stands",
  "Torque wrench",
  "Code reader (live data)",
  "Compression tester",
  "Vacuum gauge",
];

const STEP_TITLES = ["Vehicle", "Problem", "Review"];

function pickGarageForMake(garages: Garage[], make: string | null): Garage | undefined {
  if (!garages.length) return undefined;
  const findById = (id: string) => garages.find((g) => g.id.toLowerCase() === id);
  const findByName = (needle: string) => garages.find((g) => g.name.toLowerCase().includes(needle));
  const fallback = () => findById("general") ?? findByName("general") ?? garages[0];
  if (!make) return fallback();
  const m = make.toLowerCase();
  if (m.includes("ford")) return findById("ford") ?? findByName("ford") ?? fallback();
  if (m.includes("chev") || m.includes("gmc") || m.includes("cadillac") || m.includes("buick"))
    return findById("chevy") ?? findByName("chevy") ?? fallback();
  if (m.includes("dodge") || m.includes("ram") || m.includes("chrysler"))
    return findById("dodge") ?? findByName("dodge") ?? fallback();
  if (m.includes("jeep")) return findById("jeep") ?? findByName("jeep") ?? fallback();
  const direct = findById(m) ?? findByName(m);
  return direct ?? fallback();
}

export default function NewCaseScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [step, setStep] = useState(0);

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [systemCategory, setSystemCategory] = useState<string | null>("engine");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [obdCodes, setObdCodes] = useState<string[]>([]);
  const [codeInput, setCodeInput] = useState("");
  const [whenItHappens, setWhenItHappens] = useState("");
  const [partsReplaced, setPartsReplaced] = useState("");
  const [urgency, setUrgency] = useState<"low" | "normal" | "high" | "stranded">("normal");
  const [budget, setBudget] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [mileage, setMileage] = useState("");

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: garages = [] } = useQuery<Garage[]>({
    queryKey: ["/api/garages"],
  });

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === vehicleId) ?? null,
    [vehicles, vehicleId],
  );

  useEffect(() => {
    if (!vehicleId && vehicles.length > 0) {
      setVehicleId(vehicles[0].id);
      if (vehicles[0].mileage) setMileage(String(vehicles[0].mileage));
    }
  }, [vehicles, vehicleId]);

  const targetGarage = useMemo(
    () => pickGarageForMake(garages, selectedVehicle?.make ?? null),
    [garages, selectedVehicle],
  );

  const codeSuggestions = useMemo<ObdCodeInfo[]>(() => {
    if (!codeInput.trim()) return [];
    return searchObdCodes(codeInput.trim()).slice(0, 4);
  }, [codeInput]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!targetGarage) throw new Error("No bay available to post to");
      const body: Record<string, unknown> = {
        title: title.trim(),
        content: content.trim() || `Symptoms: ${symptoms.join(", ") || "(none provided)"}`,
        vehicleId: vehicleId ?? undefined,
        symptoms: symptoms.length ? symptoms : undefined,
        obdCodes: obdCodes.length ? obdCodes : undefined,
        systemCategory: systemCategory ?? undefined,
        urgency,
        budget: budget.trim() || undefined,
        toolsAvailable: tools.length ? tools.join(", ") : undefined,
        whenItHappens: whenItHappens.trim() || undefined,
        partsReplaced: partsReplaced.trim() || undefined,
        mileage: mileage.trim() ? Number(mileage.trim()) : undefined,
        status: "open",
      };
      return apiRequest("POST", `/api/garages/${targetGarage.id}/threads`, body);
    },
    onSuccess: (created: unknown) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/threads"] });
      if (targetGarage) {
        queryClient.invalidateQueries({ queryKey: [`/api/garages/${targetGarage.id}/threads`] });
      }
      toast.show("Case opened", "success");
      const createdId =
        created && typeof created === "object" && "id" in created && typeof (created as { id: unknown }).id === "string"
          ? (created as { id: string }).id
          : null;
      if (createdId) {
        navigation.replace("ThreadDetail", { threadId: createdId });
      } else {
        navigation.goBack();
      }
    },
    onError: (err: Error) => {
      toast.show(err.message || "Failed to create case", "error");
    },
  });

  const toggleArrayValue = (arr: string[], setArr: (v: string[]) => void, value: string) => {
    if (arr.includes(value)) setArr(arr.filter((v) => v !== value));
    else setArr([...arr, value]);
  };

  const addCode = (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    if (obdCodes.includes(trimmed)) return;
    setObdCodes([...obdCodes, trimmed]);
    setCodeInput("");
  };

  const canAdvance = (s: number) => {
    if (s === 0) return Boolean(vehicleId);
    if (s === 1) {
      if (!title.trim()) return false;
      if (!systemCategory) return false;
      if (symptoms.length === 0 && obdCodes.length === 0) return false;
      return true;
    }
    return true;
  };

  const validationMessage = (s: number): string | null => {
    if (s === 0 && !vehicleId) return "Pick a vehicle to continue.";
    if (s === 1) {
      if (!title.trim()) return "Add a short title for the case.";
      if (!systemCategory) return "Pick a system category (e.g., Engine, Brakes).";
      if (symptoms.length === 0 && obdCodes.length === 0) {
        return "Add at least one symptom or an OBD code.";
      }
    }
    return null;
  };

  const goNext = () => {
    const msg = validationMessage(step);
    if (msg) {
      toast.show(msg, "info");
      return;
    }
    if (step < STEP_TITLES.length - 1) {
      setStep(step + 1);
      Haptics.selectionAsync();
    }
  };
  const goPrev = () => {
    if (step > 0) {
      setStep(step - 1);
      Haptics.selectionAsync();
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepRow}>
      {STEP_TITLES.map((label, idx) => {
        const active = idx === step;
        const done = idx < step;
        const color = done ? theme.success : active ? theme.primary : theme.textMuted;
        return (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor: done ? theme.success : active ? theme.primary : theme.backgroundSecondary,
                  borderColor: color,
                },
              ]}
            >
              {done ? (
                <Feather name="check" size={12} color="#fff" />
              ) : (
                <Text style={[styles.stepDotText, { color: active ? "#fff" : theme.textMuted }]}>
                  {idx + 1}
                </Text>
              )}
            </View>
            <Text style={[styles.stepLabel, { color }]}>{label}</Text>
            {idx < STEP_TITLES.length - 1 ? (
              <View style={[styles.stepLine, { backgroundColor: theme.cardBorder }]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );

  const renderStepVehicle = () => (
    <View style={styles.stepBody}>
      <ThemedText type="h3">Pick the vehicle</ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
        Mechanics need year, make, model, and engine to give useful answers.
      </ThemedText>

      {vehicles.length === 0 ? (
        <View style={[styles.emptyVehicleBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
          <Feather name="truck" size={28} color={theme.textMuted} />
          <ThemedText type="body" style={{ marginTop: Spacing.sm }}>
            No vehicles in your garage yet.
          </ThemedText>
          <Button onPress={() => navigation.navigate("AddVehicle")} style={{ marginTop: Spacing.md }}>
            Add a vehicle
          </Button>
        </View>
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {vehicles.map((v) => {
            const active = v.id === vehicleId;
            const label = `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.trim() || v.nickname || "Unnamed";
            return (
              <Pressable
                key={v.id}
                testID={`vehicle-option-${v.id}`}
                onPress={() => {
                  setVehicleId(v.id);
                  if (v.mileage) setMileage(String(v.mileage));
                  Haptics.selectionAsync();
                }}
                style={[
                  styles.vehicleRow,
                  {
                    backgroundColor: active ? theme.primary : theme.backgroundSecondary,
                    borderColor: active ? theme.primary : theme.cardBorder,
                  },
                ]}
              >
                <Feather name="truck" size={18} color={active ? "#fff" : theme.text} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.vehicleTitle, { color: active ? "#fff" : theme.text }]}>{label}</Text>
                  {v.trim || v.nickname ? (
                    <Text style={[styles.vehicleSub, { color: active ? "#fff" : theme.textMuted }]}>
                      {[v.trim, v.nickname].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}
                </View>
                {active ? <Feather name="check-circle" size={18} color="#fff" /> : null}
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => navigation.navigate("AddVehicle")}
            style={[styles.addNewRow, { borderColor: theme.cardBorder }]}
          >
            <Feather name="plus" size={16} color={theme.text} />
            <Text style={{ color: theme.text }}>Add a new vehicle</Text>
          </Pressable>
        </View>
      )}

      <Input
        label="Current mileage (optional)"
        placeholder="e.g., 124500"
        value={mileage}
        onChangeText={setMileage}
        keyboardType="number-pad"
        leftIcon="hash"
      />
    </View>
  );

  const renderStepProblem = () => (
    <View style={styles.stepBody}>
      <ThemedText type="h3">Describe the problem</ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
        The more detail, the better the diagnosis.
      </ThemedText>

      <Input
        label="Title"
        placeholder="e.g., P0301 misfire on cyl 1, runs fine cold"
        value={title}
        onChangeText={setTitle}
        leftIcon="edit-3"
      />

      <Text style={[styles.sectionLabel, { color: theme.text }]}>System category</Text>
      <View style={styles.chipWrap}>
        {SYSTEM_OPTIONS.map((s) => {
          const active = systemCategory === s.key;
          return (
            <Pressable
              key={s.key}
              testID={`chip-system-${s.key}`}
              onPress={() => {
                setSystemCategory(s.key);
                Haptics.selectionAsync();
              }}
              style={[
                styles.pickChip,
                {
                  backgroundColor: active ? theme.primary : theme.backgroundSecondary,
                  borderColor: active ? theme.primary : theme.cardBorder,
                },
              ]}
            >
              <Feather name={s.icon} size={12} color={active ? "#fff" : theme.text} />
              <Text style={[styles.pickChipText, { color: active ? "#fff" : theme.text }]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: theme.text }]}>Symptoms (tap all that apply)</Text>
      <View style={styles.chipWrap}>
        {COMMON_SYMPTOMS.map((s) => {
          const active = symptoms.includes(s);
          return (
            <Pressable
              key={s}
              onPress={() => toggleArrayValue(symptoms, setSymptoms, s)}
              style={[
                styles.pickChip,
                {
                  backgroundColor: active ? theme.primary : theme.backgroundSecondary,
                  borderColor: active ? theme.primary : theme.cardBorder,
                },
              ]}
            >
              <Text style={[styles.pickChipText, { color: active ? "#fff" : theme.text }]}>{s}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: theme.text }]}>OBD-II codes</Text>
      <View style={[styles.codeInputRow, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
        <Feather name="cpu" size={14} color={theme.textMuted} />
        <TextInput
          value={codeInput}
          onChangeText={(v) => setCodeInput(v.toUpperCase())}
          placeholder="e.g., P0301"
          placeholderTextColor={theme.textMuted}
          style={[styles.codeInput, { color: theme.text }]}
          autoCapitalize="characters"
          onSubmitEditing={() => addCode(codeInput)}
          returnKeyType="done"
        />
        <Pressable onPress={() => addCode(codeInput)} hitSlop={8}>
          <Feather name="plus-circle" size={18} color={theme.primary} />
        </Pressable>
      </View>
      {codeSuggestions.length > 0 ? (
        <View style={{ gap: 4, marginTop: 6 }}>
          {codeSuggestions.map((c) => (
            <Pressable
              key={c.code}
              onPress={() => addCode(c.code)}
              style={[styles.suggestionRow, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}
            >
              <Text style={[styles.suggestionCode, { color: theme.primary }]}>{c.code}</Text>
              <Text style={[styles.suggestionDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                {c.description}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {obdCodes.length > 0 ? (
        <View style={[styles.chipWrap, { marginTop: Spacing.sm }]}>
          {obdCodes.map((code) => {
            const info = lookupObdCode(code);
            return (
              <View
                key={code}
                style={[
                  styles.activeCodeChip,
                  { backgroundColor: theme.backgroundTertiary, borderColor: theme.cardBorder },
                ]}
              >
                <Text style={[styles.activeCodeText, { color: theme.text }]}>{code}</Text>
                {info ? (
                  <Text style={[styles.activeCodeInfo, { color: theme.textMuted }]} numberOfLines={1}>
                    {info.description.slice(0, 36)}
                  </Text>
                ) : null}
                <Pressable onPress={() => setObdCodes(obdCodes.filter((c) => c !== code))} hitSlop={8}>
                  <Feather name="x" size={12} color={theme.textMuted} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      <Input
        label="When does it happen?"
        placeholder="Cold start, after 20 min driving, only in rain..."
        value={whenItHappens}
        onChangeText={setWhenItHappens}
        leftIcon="clock"
      />

      <Input
        label="Recent repairs / parts replaced"
        placeholder="New plugs last week, ignition coil 2 months ago..."
        value={partsReplaced}
        onChangeText={setPartsReplaced}
        multiline
        numberOfLines={3}
        leftIcon="settings"
      />

      <Text style={[styles.sectionLabel, { color: theme.text }]}>Urgency</Text>
      <View style={{ gap: Spacing.sm }}>
        {URGENCY_OPTIONS.map((u) => {
          const active = urgency === u.key;
          return (
            <Pressable
              key={u.key}
              testID={`urgency-${u.key}`}
              onPress={() => {
                setUrgency(u.key);
                Haptics.selectionAsync();
              }}
              style={[
                styles.urgencyRow,
                {
                  backgroundColor: active ? theme.primary : theme.backgroundSecondary,
                  borderColor: active ? theme.primary : theme.cardBorder,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.urgencyLabel, { color: active ? "#fff" : theme.text }]}>{u.label}</Text>
                <Text style={[styles.urgencyDesc, { color: active ? "#fff" : theme.textMuted }]}>
                  {u.description}
                </Text>
              </View>
              {active ? <Feather name="check" size={16} color="#fff" /> : null}
            </Pressable>
          );
        })}
      </View>

      <Input
        label="Budget (optional)"
        placeholder="e.g., under $200, parts only, whatever it takes"
        value={budget}
        onChangeText={setBudget}
        leftIcon="dollar-sign"
      />

      <Text style={[styles.sectionLabel, { color: theme.text }]}>Tools available</Text>
      <View style={styles.chipWrap}>
        {TOOLS_AVAILABLE.map((t) => {
          const active = tools.includes(t);
          return (
            <Pressable
              key={t}
              onPress={() => toggleArrayValue(tools, setTools, t)}
              style={[
                styles.pickChip,
                {
                  backgroundColor: active ? theme.primary : theme.backgroundSecondary,
                  borderColor: active ? theme.primary : theme.cardBorder,
                },
              ]}
            >
              <Text style={[styles.pickChipText, { color: active ? "#fff" : theme.text }]}>{t}</Text>
            </Pressable>
          );
        })}
      </View>

      <Input
        label="Extra details (optional)"
        placeholder="Anything else mechanics should know..."
        value={content}
        onChangeText={setContent}
        multiline
        numberOfLines={4}
        leftIcon="message-circle"
      />

      <Pressable
        onPress={() => toast.show("Photo uploads are coming soon", "info")}
        style={[styles.placeholderRow, { borderColor: theme.cardBorder }]}
      >
        <Feather name="camera" size={16} color={theme.textMuted} />
        <Text style={{ color: theme.textMuted }}>Add photos (coming soon)</Text>
      </Pressable>
    </View>
  );

  const renderStepReview = () => {
    const decoded = obdCodes.map((c) => ({ code: c, info: lookupObdCode(c) }));
    const topCauses = decoded
      .map((d) => d.info?.description)
      .filter((v): v is string => Boolean(v))
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 5);

    return (
      <View style={styles.stepBody}>
        <ThemedText type="h3">Review your case</ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
          Posting to {targetGarage ? targetGarage.name : "General"} bay.
        </ThemedText>

        <View style={[styles.reviewCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
          <Text style={[styles.reviewTitle, { color: theme.text }]}>{title || "(no title)"}</Text>
          <View style={styles.reviewBadges}>
            {systemCategory ? <StatusBadge label={systemCategory} variant="muted" size="sm" /> : null}
            <StatusBadge label={`Urgency: ${urgency}`} variant={urgency === "stranded" || urgency === "high" ? "error" : "default"} size="sm" />
            {selectedVehicle ? (
              <StatusBadge
                label={`${selectedVehicle.year ?? ""} ${selectedVehicle.make ?? ""} ${selectedVehicle.model ?? ""}`.trim()}
                variant="primary"
                size="sm"
                icon="truck"
              />
            ) : null}
          </View>

          {symptoms.length > 0 ? (
            <View style={styles.reviewSection}>
              <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>Symptoms</Text>
              <Text style={{ color: theme.text }}>{symptoms.join(", ")}</Text>
            </View>
          ) : null}

          {obdCodes.length > 0 ? (
            <View style={styles.reviewSection}>
              <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>OBD codes</Text>
              <Text style={{ color: theme.text }}>{obdCodes.join(", ")}</Text>
            </View>
          ) : null}

          {whenItHappens ? (
            <View style={styles.reviewSection}>
              <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>When it happens</Text>
              <Text style={{ color: theme.text }}>{whenItHappens}</Text>
            </View>
          ) : null}

          {partsReplaced ? (
            <View style={styles.reviewSection}>
              <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>Parts replaced</Text>
              <Text style={{ color: theme.text }}>{partsReplaced}</Text>
            </View>
          ) : null}

          {tools.length > 0 ? (
            <View style={styles.reviewSection}>
              <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>Tools available</Text>
              <Text style={{ color: theme.text }}>{tools.join(", ")}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.previewCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.primary }]}>
          <View style={styles.previewHeader}>
            <Feather name="activity" size={16} color={theme.primary} />
            <Text style={[styles.previewTitle, { color: theme.primary }]}>TorqueAssist preview</Text>
          </View>
          {topCauses.length > 0 ? (
            <View style={{ gap: 6, marginTop: Spacing.sm }}>
              <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Top probable causes</Text>
              {topCauses.map((c) => (
                <View key={c} style={styles.previewItem}>
                  <Feather name="circle" size={6} color={theme.primary} />
                  <Text style={{ color: theme.text, flex: 1 }}>{c}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.previewLabel, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
              Add OBD codes for instant probable-cause suggestions, or open the case to walk through TorqueAssist.
            </Text>
          )}
          <View style={{ gap: 6, marginTop: Spacing.md }}>
            <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Suggested next steps</Text>
            <View style={styles.previewItem}>
              <Feather name="check-square" size={12} color={theme.text} />
              <Text style={{ color: theme.text, flex: 1 }}>Pull live data to confirm symptoms</Text>
            </View>
            <View style={styles.previewItem}>
              <Feather name="check-square" size={12} color={theme.text} />
              <Text style={{ color: theme.text, flex: 1 }}>Inspect related sensors and connectors</Text>
            </View>
            <View style={styles.previewItem}>
              <Feather name="check-square" size={12} color={theme.text} />
              <Text style={{ color: theme.text, flex: 1 }}>Run TorqueAssist for full diagnostic tree</Text>
            </View>
          </View>
          <View style={[styles.previewItem, { marginTop: Spacing.md, opacity: 0.7 }]}>
            <Feather name="users" size={12} color={theme.textMuted} />
            <Text style={{ color: theme.textMuted, flex: 1 }}>Similar solved cases (coming soon)</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.lg,
          gap: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom + 60 }}
      >
        {renderStepIndicator()}
        {step === 0 ? renderStepVehicle() : null}
        {step === 1 ? renderStepProblem() : null}
        {step === 2 ? renderStepReview() : null}
      </KeyboardAwareScrollViewCompat>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.backgroundRoot,
            borderTopColor: theme.cardBorder,
            paddingBottom: insets.bottom + Spacing.md,
          },
        ]}
      >
        {step > 0 ? (
          <Pressable
            onPress={goPrev}
            style={[
              styles.secondaryBtn,
              styles.footerBtn,
              { borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary },
            ]}
            testID="button-prev-step"
          >
            <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.footerBtn} />
        )}
        {step < STEP_TITLES.length - 1 ? (
          <Button onPress={goNext} style={styles.footerBtn} testID="button-next-step">
            Next
          </Button>
        ) : (
          <Button
            onPress={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            style={styles.footerBtn}
          >
            {createMutation.isPending ? "Opening..." : "Open Case"}
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md },
  stepItem: { flexDirection: "row", alignItems: "center", flex: 1 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotText: { ...Typography.caption, fontWeight: "700" },
  stepLabel: { ...Typography.caption, marginLeft: 6, fontWeight: "600" },
  stepLine: { flex: 1, height: 1, marginHorizontal: Spacing.sm },
  stepBody: { gap: Spacing.md },
  emptyVehicleBox: {
    padding: Spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  vehicleTitle: { ...Typography.body, fontWeight: "600" },
  vehicleSub: { ...Typography.caption },
  addNewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
  },
  sectionLabel: { ...Typography.caption, fontWeight: "700", textTransform: "uppercase", marginTop: Spacing.sm },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pickChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  pickChipText: { ...Typography.caption, fontWeight: "600" },
  codeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  codeInput: { flex: 1, ...Typography.body, fontFamily: "monospace", paddingVertical: 0 },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  suggestionCode: { ...Typography.caption, fontFamily: "monospace", fontWeight: "700" },
  suggestionDesc: { ...Typography.caption, flex: 1 },
  activeCodeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  activeCodeText: { ...Typography.caption, fontFamily: "monospace", fontWeight: "700" },
  activeCodeInfo: { ...Typography.caption, fontSize: 11, maxWidth: 140 },
  urgencyRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  urgencyLabel: { ...Typography.body, fontWeight: "700" },
  urgencyDesc: { ...Typography.caption },
  placeholderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
  },
  reviewCard: { padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.sm },
  reviewTitle: { ...Typography.h4 },
  reviewBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reviewSection: { gap: 4 },
  reviewLabel: { ...Typography.caption, fontWeight: "700", textTransform: "uppercase" },
  previewCard: { padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1 },
  previewHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  previewTitle: { ...Typography.body, fontWeight: "700" },
  previewLabel: { ...Typography.caption, fontWeight: "700", textTransform: "uppercase" },
  previewItem: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  footerBtn: { flex: 1 },
  secondaryBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { ...Typography.body, fontWeight: "600" },
});
