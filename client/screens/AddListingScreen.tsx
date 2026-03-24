import React, { useState } from "react";
import { View, StyleSheet, Switch, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { Spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const CONDITIONS = ["New", "Like New", "Good", "Fair", "For Parts"];

export default function AddListingScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [conditionIndex, setConditionIndex] = useState(2);
  const [localPickup, setLocalPickup] = useState(true);
  const [willShip, setWillShip] = useState(false);

  const createListingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/swap-shop", {
        title: title.trim(),
        description: description.trim() || null,
        price: price.trim(),
        condition: CONDITIONS[conditionIndex],
        location: location.trim() || null,
        localPickup,
        willShip,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/swap-shop"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Listing posted", "success");
      navigation.goBack();
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to create listing", "error");
    },
  });

  const handleSubmit = () => {
    createListingMutation.mutate();
  };

  const isValid = title.trim() && price.trim();

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
        Post an Item
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
        List your parts, tools, or gear for the community
      </ThemedText>

      <View style={styles.section}>
        <Input
          label="Title"
          placeholder="e.g., Coyote 5.0L Engine"
          value={title}
          onChangeText={setTitle}
          leftIcon="tag"
        />

        <Input
          label="Description"
          placeholder="Describe the item, condition details, etc."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.descriptionInput}
        />

        <Input
          label="Price"
          placeholder="e.g., 4500"
          value={price}
          onChangeText={setPrice}
          leftIcon="dollar-sign"
          keyboardType="numeric"
        />

        <Input
          label="Location"
          placeholder="e.g., Austin, TX"
          value={location}
          onChangeText={setLocation}
          leftIcon="map-pin"
        />

        <View style={styles.conditionSection}>
          <ThemedText type="body" style={styles.conditionLabel}>
            Condition
          </ThemedText>
          <SegmentedControl
            segments={CONDITIONS}
            selectedIndex={conditionIndex}
            onIndexChange={setConditionIndex}
          />
        </View>

        <View style={styles.switchRow}>
          <View>
            <ThemedText type="body">Local Pickup</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Buyer can pick up in person
            </ThemedText>
          </View>
          <Switch
            value={localPickup}
            onValueChange={setLocalPickup}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.switchRow}>
          <View>
            <ThemedText type="body">Will Ship</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              You can ship this item
            </ThemedText>
          </View>
          <Switch
            value={willShip}
            onValueChange={setWillShip}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <Button onPress={handleSubmit} disabled={!isValid || createListingMutation.isPending}>
        {createListingMutation.isPending ? "Posting..." : "Post Item"}
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
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  descriptionInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  conditionSection: {
    gap: Spacing.sm,
  },
  conditionLabel: {
    marginBottom: Spacing.xs,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
});
