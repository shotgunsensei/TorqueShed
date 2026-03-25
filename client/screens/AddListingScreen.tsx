import React, { useState } from "react";
import { View, StyleSheet, Switch } from "react-native";
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
  const [imageUrl, setImageUrl] = useState("");
  const [conditionIndex, setConditionIndex] = useState(2);
  const [localPickup, setLocalPickup] = useState(true);
  const [willShip, setWillShip] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!price.trim()) newErrors.price = "Price is required";
    else if (isNaN(Number(price.replace(/[,$]/g, "")))) newErrors.price = "Enter a valid number";
    if (imageUrl.trim() && !imageUrl.trim().startsWith("http")) newErrors.imageUrl = "Enter a valid URL starting with http";
    if (!localPickup && !willShip) newErrors.shipping = "Select at least one shipping option";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createListingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/swap-shop", {
        title: title.trim(),
        description: description.trim() || null,
        price: price.trim(),
        condition: CONDITIONS[conditionIndex],
        location: location.trim() || null,
        imageUrl: imageUrl.trim() || null,
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
    if (!validate()) return;
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
        <View>
          <Input
            label="Title"
            placeholder="e.g., Coyote 5.0L Engine"
            value={title}
            onChangeText={(t) => { setTitle(t); setErrors((e) => ({ ...e, title: "" })); }}
            leftIcon="tag"
            testID="input-listing-title"
          />
          {errors.title ? <ThemedText type="caption" style={{ color: theme.error, marginTop: 2 }}>{errors.title}</ThemedText> : null}
        </View>

        <Input
          label="Description"
          placeholder="Describe the item, condition details, etc."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.descriptionInput}
          testID="input-listing-description"
        />

        <View>
          <Input
            label="Price"
            placeholder="e.g., 4500"
            value={price}
            onChangeText={(p) => { setPrice(p); setErrors((e) => ({ ...e, price: "" })); }}
            leftIcon="dollar-sign"
            keyboardType="numeric"
            testID="input-listing-price"
          />
          {errors.price ? <ThemedText type="caption" style={{ color: theme.error, marginTop: 2 }}>{errors.price}</ThemedText> : null}
        </View>

        <Input
          label="Location"
          placeholder="e.g., Austin, TX"
          value={location}
          onChangeText={setLocation}
          leftIcon="map-pin"
          testID="input-listing-location"
        />

        <View>
          <Input
            label="Image URL (optional)"
            placeholder="https://example.com/photo.jpg"
            value={imageUrl}
            onChangeText={(u) => { setImageUrl(u); setErrors((e) => ({ ...e, imageUrl: "" })); }}
            leftIcon="image"
            autoCapitalize="none"
            keyboardType="url"
            testID="input-listing-image"
          />
          {errors.imageUrl ? <ThemedText type="caption" style={{ color: theme.error, marginTop: 2 }}>{errors.imageUrl}</ThemedText> : null}
        </View>

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
            onValueChange={(v) => { setLocalPickup(v); setErrors((e) => ({ ...e, shipping: "" })); }}
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
            onValueChange={(v) => { setWillShip(v); setErrors((e) => ({ ...e, shipping: "" })); }}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
        {errors.shipping ? <ThemedText type="caption" style={{ color: theme.error }}>{errors.shipping}</ThemedText> : null}
      </View>

      <Button onPress={handleSubmit} disabled={!isValid || createListingMutation.isPending} testID="button-submit-listing">
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
