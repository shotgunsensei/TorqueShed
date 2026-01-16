import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius, Colors } from "@/constants/theme";
import { SegmentedControl } from "@/components/SegmentedControl";
import { emptyStates, microcopy, placeholders, garageBrandColors } from "@/constants/brand";
import { getApiUrl } from "@/lib/query-client";

interface DecodedVehicle {
  year: number;
  make: string;
  model: string;
  trim: string | null;
  engine: string | null;
  transmission: string | null;
  drivetrain: string | null;
}

interface LikelyCause {
  cause: string;
  probability: "high" | "medium" | "low";
  explanation: string;
}

interface RecommendedCheck {
  step: number;
  action: string;
  tools: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
}

interface TorqueSpec {
  component: string;
  spec: string;
  notes: string | null;
}

interface SuggestedPart {
  name: string;
  category: string;
  priority: "high" | "medium" | "low";
  estimatedCost: string | null;
}

interface PurchaseLink {
  provider: string;
  url: string;
  type: "oem" | "aftermarket" | "used";
}

interface TorqueAssistResponse {
  vehicle: DecodedVehicle;
  normalizedIssue: string;
  likelyCauses: LikelyCause[];
  recommendedChecks: RecommendedCheck[];
  torqueSpecs: TorqueSpec[] | null;
  suggestedParts: SuggestedPart[];
  purchaseLinks: PurchaseLink[];
  confidenceNote: "common_issue" | "vehicle_specific" | "general_guidance" | "requires_diagnosis";
  disclaimer: string;
}

const confidenceLabels: Record<string, string> = {
  common_issue: "Common Issue",
  vehicle_specific: "Vehicle-Specific",
  general_guidance: "General Guidance",
  requires_diagnosis: "Requires Diagnosis",
};

const difficultyColors: Record<string, string> = {
  beginner: Colors.success,
  intermediate: Colors.warning,
  advanced: Colors.error,
};

const priorityColors: Record<string, string> = {
  high: Colors.error,
  medium: Colors.warning,
  low: Colors.success,
};

export default function PartsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [issue, setIssue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<TorqueAssistResponse | null>(null);

  const handleAssist = async () => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const vehicleData = selectedIndex === 0
        ? { type: "vin" as const, vin }
        : { type: "ymm" as const, year: parseInt(year), make, model };

      const res = await fetch(new URL("/api/torque-assist", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle: vehicleData, issue }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to get assistance");
      }

      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskTheBay = () => {
    if (!response) return;

    const bayId = getBayForMake(response.vehicle.make);
    const vehicleSummary = `${response.vehicle.year} ${response.vehicle.make} ${response.vehicle.model}`;
    
    const topCauses = response.likelyCauses
      .slice(0, 2)
      .map(c => `- ${c.cause} (${c.probability} probability)`)
      .join("\n");
    
    const prefilledContent = `Vehicle: ${vehicleSummary}
Issue: ${response.normalizedIssue}

TorqueAssist identified these likely causes:
${topCauses}

Has anyone dealt with this before? Looking for advice.`;

    navigation.navigate("GarageDetail", {
      garageId: bayId,
      prefillThread: {
        title: `${response.normalizedIssue} - ${vehicleSummary}`,
        content: prefilledContent,
      },
    });
  };

  const getBayForMake = (vehicleMake: string): string => {
    const makeLower = vehicleMake.toLowerCase();
    if (makeLower.includes("ford")) return "ford";
    if (makeLower.includes("dodge") || makeLower.includes("ram") || makeLower.includes("chrysler")) return "dodge";
    if (makeLower.includes("chevy") || makeLower.includes("chevrolet") || makeLower.includes("gmc")) return "chevy";
    if (makeLower.includes("jeep")) return "jeep";
    return "general";
  };

  const canSearch = selectedIndex === 0 
    ? vin.length === 17 && issue.trim().length >= 3
    : year && make && model && issue.trim().length >= 3;

  const resetForm = () => {
    setResponse(null);
    setError(null);
    setVin("");
    setYear("");
    setMake("");
    setModel("");
    setIssue("");
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: tabBarHeight + Spacing.xl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {response ? (
        <View>
          <View style={styles.resultHeader}>
            <View style={[styles.confidenceBadge, { backgroundColor: theme.primary + "20" }]}>
              <Text style={[styles.confidenceText, { color: theme.primary }]}>
                {confidenceLabels[response.confidenceNote]}
              </Text>
            </View>
            <Pressable onPress={resetForm} style={styles.resetButton}>
              <Feather name="refresh-cw" size={16} color={theme.textSecondary} />
              <Text style={[styles.resetText, { color: theme.textSecondary }]}>New Search</Text>
            </Pressable>
          </View>

          <View style={[styles.vehicleCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <Text style={[styles.vehicleTitle, { color: theme.text }]}>
              {response.vehicle.year} {response.vehicle.make} {response.vehicle.model}
            </Text>
            {response.vehicle.engine ? (
              <Text style={[styles.vehicleDetail, { color: theme.textSecondary }]}>
                {response.vehicle.engine} {response.vehicle.transmission ? `/ ${response.vehicle.transmission}` : ""}
              </Text>
            ) : null}
            <View style={[styles.issueBadge, { backgroundColor: theme.primary + "15" }]}>
              <Text style={[styles.issueText, { color: theme.primary }]}>
                {response.normalizedIssue}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Likely Causes</Text>
            {response.likelyCauses.map((cause, index) => (
              <View key={index} style={[styles.causeCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <View style={styles.causeHeader}>
                  <View style={[styles.probabilityBadge, { backgroundColor: priorityColors[cause.probability] + "20" }]}>
                    <Text style={[styles.probabilityText, { color: priorityColors[cause.probability] }]}>
                      {cause.probability.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.causeName, { color: theme.text }]}>{cause.cause}</Text>
                </View>
                <Text style={[styles.causeExplanation, { color: theme.textSecondary }]}>
                  {cause.explanation}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recommended Checks</Text>
            {response.recommendedChecks.map((check) => (
              <View key={check.step} style={[styles.checkCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <View style={styles.checkHeader}>
                  <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}>
                    <Text style={styles.stepText}>{check.step}</Text>
                  </View>
                  <View style={[styles.difficultyBadge, { backgroundColor: difficultyColors[check.difficulty] + "20" }]}>
                    <Text style={[styles.difficultyText, { color: difficultyColors[check.difficulty] }]}>
                      {check.difficulty}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.checkAction, { color: theme.text }]}>{check.action}</Text>
                {check.tools.length > 0 ? (
                  <View style={styles.toolsRow}>
                    <Feather name="tool" size={12} color={theme.textMuted} />
                    <Text style={[styles.toolsText, { color: theme.textMuted }]}>
                      {check.tools.join(", ")}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          {response.torqueSpecs && response.torqueSpecs.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Torque Specifications</Text>
              <View style={[styles.specsTable, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                {response.torqueSpecs.map((spec, index) => (
                  <View key={index} style={[styles.specRow, index < response.torqueSpecs!.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                    <Text style={[styles.specComponent, { color: theme.text }]}>{spec.component}</Text>
                    <Text style={[styles.specValue, { color: theme.primary }]}>{spec.spec}</Text>
                    {spec.notes ? (
                      <Text style={[styles.specNotes, { color: theme.textMuted }]}>{spec.notes}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Suggested Parts</Text>
            {response.suggestedParts.map((part, index) => (
              <View key={index} style={[styles.partCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <View style={styles.partHeader}>
                  <Text style={[styles.partName, { color: theme.text }]}>{part.name}</Text>
                  <View style={[styles.priorityDot, { backgroundColor: priorityColors[part.priority] }]} />
                </View>
                <View style={styles.partDetails}>
                  <Text style={[styles.partCategory, { color: theme.textSecondary }]}>{part.category}</Text>
                  {part.estimatedCost ? (
                    <Text style={[styles.partCost, { color: theme.primary }]}>{part.estimatedCost}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Where to Buy</Text>
            <View style={styles.linksGrid}>
              {response.purchaseLinks.map((link, index) => (
                <Pressable
                  key={index}
                  onPress={() => openLink(link.url)}
                  style={({ pressed }) => [
                    styles.linkButton,
                    { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Text style={[styles.linkProvider, { color: theme.text }]}>{link.provider}</Text>
                  <Text style={[styles.linkType, { color: theme.textMuted }]}>{link.type}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.disclaimerBox, { backgroundColor: theme.backgroundTertiary }]}>
            <Feather name="info" size={14} color={theme.textMuted} />
            <Text style={[styles.disclaimerText, { color: theme.textMuted }]}>
              {response.disclaimer}
            </Text>
          </View>

          <Pressable
            onPress={handleAskTheBay}
            style={({ pressed }) => [
              styles.askBayButton,
              { backgroundColor: garageBrandColors[getBayForMake(response.vehicle.make) as keyof typeof garageBrandColors] || theme.primary, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Feather name="message-circle" size={20} color="#FFFFFF" />
            <Text style={styles.askBayText}>Ask the Bay</Text>
          </Pressable>
          <Text style={[styles.askBayHint, { color: theme.textMuted }]}>
            Get advice from real enthusiasts in the {response.vehicle.make} Bay
          </Text>
        </View>
      ) : (
        <View>
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: theme.primary + "15" }]}>
              <Feather name="tool" size={32} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              {emptyStates.parts.title}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {emptyStates.parts.message}
            </Text>
          </View>

          <View style={styles.segmentContainer}>
            <SegmentedControl
              segments={["VIN Lookup", "Year/Make/Model"]}
              selectedIndex={selectedIndex}
              onIndexChange={setSelectedIndex}
            />
          </View>

          {selectedIndex === 0 ? (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Vehicle Identification Number
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                placeholder={placeholders.vin}
                placeholderTextColor={theme.textMuted}
                value={vin}
                onChangeText={(text) => setVin(text.toUpperCase())}
                autoCapitalize="characters"
                maxLength={17}
                testID="input-vin"
              />
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                17 characters, no I, O, or Q
              </Text>
            </View>
          ) : (
            <View style={styles.ymmContainer}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Year</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  placeholder={placeholders.year}
                  placeholderTextColor={theme.textMuted}
                  value={year}
                  onChangeText={setYear}
                  keyboardType="number-pad"
                  maxLength={4}
                  testID="input-year"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Make</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  placeholder={placeholders.make}
                  placeholderTextColor={theme.textMuted}
                  value={make}
                  onChangeText={setMake}
                  testID="input-make"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Model</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  placeholder={placeholders.model}
                  placeholderTextColor={theme.textMuted}
                  value={model}
                  onChangeText={setModel}
                  testID="input-model"
                />
              </View>
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              What are you trying to fix?
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.issueInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="e.g., brakes squeaking, oil leak, check engine light..."
              placeholderTextColor={theme.textMuted}
              value={issue}
              onChangeText={setIssue}
              multiline
              testID="input-issue"
            />
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: Colors.error + "15" }]}>
              <Feather name="alert-circle" size={16} color={Colors.error} />
              <Text style={[styles.errorText, { color: Colors.error }]}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleAssist}
            disabled={!canSearch || isLoading}
            style={({ pressed }) => [
              styles.assistButton,
              {
                backgroundColor: canSearch ? theme.primary : theme.backgroundTertiary,
                opacity: pressed && canSearch ? 0.9 : 1,
              },
            ]}
            testID="button-assist"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather
                  name="zap"
                  size={20}
                  color={canSearch ? "#FFFFFF" : theme.textMuted}
                />
                <Text
                  style={[
                    styles.assistButtonText,
                    { color: canSearch ? "#FFFFFF" : theme.textMuted },
                  ]}
                >
                  {microcopy.assistMe}
                </Text>
              </>
            )}
          </Pressable>

          <Text style={[styles.disclaimer, { color: theme.textMuted }]}>
            TorqueAssist provides diagnostic guidance, likely causes, and parts suggestions based on common issues.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    textAlign: "center",
  },
  segmentContainer: {
    marginBottom: Spacing.xl,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.small,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
  },
  issueInput: {
    height: 100,
    paddingTop: Spacing.md,
    textAlignVertical: "top",
  },
  hint: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  ymmContainer: {
    gap: 0,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.lg,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  errorText: {
    ...Typography.small,
    flex: 1,
  },
  assistButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  assistButtonText: {
    ...Typography.h4,
  },
  disclaimer: {
    ...Typography.caption,
    textAlign: "center",
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  confidenceBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  confidenceText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  resetText: {
    ...Typography.small,
  },
  vehicleCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  vehicleTitle: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  vehicleDetail: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  issueBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  issueText: {
    ...Typography.body,
    fontWeight: "600",
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  causeCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  causeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  probabilityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  probabilityText: {
    fontSize: 10,
    fontWeight: "700",
  },
  causeName: {
    ...Typography.body,
    fontWeight: "600",
    flex: 1,
  },
  causeExplanation: {
    ...Typography.small,
  },
  checkCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  checkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  difficultyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  checkAction: {
    ...Typography.body,
    marginBottom: Spacing.xs,
  },
  toolsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  toolsText: {
    ...Typography.caption,
  },
  specsTable: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
  specRow: {
    padding: Spacing.md,
  },
  specComponent: {
    ...Typography.body,
    fontWeight: "500",
    marginBottom: 2,
  },
  specValue: {
    ...Typography.h4,
    marginBottom: 2,
  },
  specNotes: {
    ...Typography.caption,
  },
  partCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
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
    fontWeight: "500",
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
  partCategory: {
    ...Typography.small,
  },
  partCost: {
    ...Typography.small,
    fontWeight: "600",
  },
  linksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  linkButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    minWidth: "45%",
    flexGrow: 1,
  },
  linkProvider: {
    ...Typography.body,
    fontWeight: "500",
  },
  linkType: {
    ...Typography.caption,
    textTransform: "capitalize",
  },
  disclaimerBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xl,
  },
  disclaimerText: {
    ...Typography.caption,
    flex: 1,
  },
  askBayButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  askBayText: {
    ...Typography.h4,
    color: "#FFFFFF",
  },
  askBayHint: {
    ...Typography.caption,
    textAlign: "center",
  },
});
