import React, { useState, useRef } from "react";
import { View, StyleSheet, Alert, ActivityIndicator, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

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

export default function AddVehicleScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

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

  const handleVinChange = (value: string) => {
    const upper = value.toUpperCase();
    setVin(upper);
    setVinDecoded(false);
    setVinError(null);

    if (decodeTimeoutRef.current) {
      clearTimeout(decodeTimeoutRef.current);
    }

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
          if (result.error) {
            setVinError(result.error);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          setVinError("VIN not found. You can still save with manual entry.");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }, 500);
    }
  };

  const createVehicleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/vehicles", {
        vin: vin || null,
        year: year ? parseInt(year, 10) : null,
        make: make || null,
        model: model || null,
        nickname,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to add vehicle");
    },
  });

  const handleSave = () => {
    createVehicleMutation.mutate();
  };

  const isValid =
    nickname.trim() &&
    ((inputMode === 0 && vin.length >= 11) ||
      (inputMode === 1 && year && make && model));

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
      <ThemedText type="h2" style={styles.title}>
        Add Vehicle
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
        Add your vehicle to track maintenance and modifications
      </ThemedText>

      <View style={styles.section}>
        <SegmentedControl
          segments={["VIN", "Manual Entry"]}
          selectedIndex={inputMode}
          onIndexChange={(i) => {
            setInputMode(i);
            setVinDecoded(false);
            setVinError(null);
          }}
        />
      </View>

      <View style={styles.section}>
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
                  <Text style={[styles.decodedValue, { color: theme.text }]}>{year || "—"}</Text>
                </View>
                <View style={styles.decodedRow}>
                  <Text style={[styles.decodedLabel, { color: theme.textMuted }]}>Make</Text>
                  <Text style={[styles.decodedValue, { color: theme.text }]}>{make || "—"}</Text>
                </View>
                <View style={styles.decodedRow}>
                  <Text style={[styles.decodedLabel, { color: theme.textMuted }]}>Model</Text>
                  <Text style={[styles.decodedValue, { color: theme.text }]}>{model || "—"}</Text>
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
            />
            <Input
              label="Make"
              placeholder="e.g., Ford"
              value={make}
              onChangeText={setMake}
              leftIcon="truck"
            />
            <Input
              label="Model"
              placeholder="e.g., F-150"
              value={model}
              onChangeText={setModel}
              leftIcon="tag"
            />
          </>
        )}

        <Input
          label="Nickname (required)"
          placeholder="Give your ride a name"
          value={nickname}
          onChangeText={setNickname}
          leftIcon="heart"
        />
      </View>

      <Button onPress={handleSave} disabled={!isValid || createVehicleMutation.isPending}>
        {createVehicleMutation.isPending ? "Adding..." : "Add Vehicle"}
      </Button>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
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
});
