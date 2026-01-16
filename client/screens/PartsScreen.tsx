import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import { SegmentedControl } from "@/components/SegmentedControl";
import { emptyStates, microcopy, placeholders } from "@gearhead/shared";

export default function PartsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [partNeeded, setPartNeeded] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleAssist = () => {
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 2000);
  };

  const canSearch = selectedIndex === 0 
    ? vin.length === 17 && partNeeded.trim()
    : year && make && model && partNeeded.trim();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: tabBarHeight + Spacing.xl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
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
            />
          </View>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          What part do you need?
        </Text>
        <TextInput
          style={[
            styles.input,
            styles.partInput,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          placeholder={placeholders.partName}
          placeholderTextColor={theme.textMuted}
          value={partNeeded}
          onChangeText={setPartNeeded}
          multiline
        />
      </View>

      <Pressable
        onPress={handleAssist}
        disabled={!canSearch || isSearching}
        style={({ pressed }) => [
          styles.assistButton,
          {
            backgroundColor: canSearch ? theme.primary : theme.backgroundTertiary,
            opacity: pressed && canSearch ? 0.9 : 1,
          },
        ]}
      >
        {isSearching ? (
          <Text style={[styles.assistButtonText, { color: "#FFFFFF" }]}>
            Searching...
          </Text>
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
        We'll search multiple vendors to find the best price and availability for your part.
      </Text>
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
  partInput: {
    height: 80,
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
});
