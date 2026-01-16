import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

export default function AddVehicleScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();

  const [inputMode, setInputMode] = useState(0);
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [nickname, setNickname] = useState("");

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  };

  const isValid =
    nickname.trim() &&
    ((inputMode === 0 && vin.length >= 17) ||
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
          onIndexChange={setInputMode}
        />
      </View>

      <View style={styles.section}>
        {inputMode === 0 ? (
          <Input
            label="VIN (Vehicle Identification Number)"
            placeholder="Enter 17-character VIN"
            value={vin}
            onChangeText={setVin}
            leftIcon="hash"
            autoCapitalize="characters"
            maxLength={17}
          />
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

      <Button onPress={handleSave} disabled={!isValid}>
        Add Vehicle
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
});
