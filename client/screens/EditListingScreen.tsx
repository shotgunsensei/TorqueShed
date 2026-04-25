import React, { useState, useEffect } from "react";
import { View, StyleSheet, Switch, Alert, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Skeleton } from "@/components/Skeleton";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { Spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type RoutePropType = RouteProp<RootStackParamList, "EditListing">;

const CONDITIONS = ["New", "Like New", "Good", "Fair", "For Parts"];
const CATEGORIES: { value: string; label: string }[] = [
  { value: "parts", label: "Parts" },
  { value: "tools", label: "Tools" },
  { value: "scan_tools", label: "Scan Tools" },
  { value: "services", label: "Services" },
  { value: "project_vehicles", label: "Project Vehicles" },
];

interface Listing {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  price: string;
  location: string | null;
  condition: string;
  localPickup: boolean;
  willShip: boolean;
  imageUrl: string | null;
  createdAt: string;
}

export default function EditListingScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RoutePropType>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { listingId } = route.params;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [conditionIndex, setConditionIndex] = useState(2);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [localPickup, setLocalPickup] = useState(true);
  const [willShip, setWillShip] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: listing, isLoading } = useQuery<Listing>({
    queryKey: [`/api/swap-shop/${listingId}`],
  });

  useEffect(() => {
    if (listing && !isInitialized) {
      setTitle(listing.title || "");
      setDescription(listing.description || "");
      setPrice(listing.price?.replace(/^\$/, "") || "");
      setLocation(listing.location || "");
      setImageUrl(listing.imageUrl || "");
      const condIdx = CONDITIONS.indexOf(listing.condition);
      setConditionIndex(condIdx >= 0 ? condIdx : 2);
      const catIdx = CATEGORIES.findIndex((c) => c.value === (listing as any).category);
      setCategoryIndex(catIdx >= 0 ? catIdx : 0);
      setLocalPickup(listing.localPickup);
      setWillShip(listing.willShip);
      setIsInitialized(true);
    }
  }, [listing, isInitialized]);

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

  const updateListingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/swap-shop/${listingId}`, {
        title: title.trim(),
        description: description.trim() || null,
        price: price.trim(),
        condition: CONDITIONS[conditionIndex],
        location: location.trim() || null,
        imageUrl: imageUrl.trim() || null,
        localPickup,
        willShip,
        category: CATEGORIES[categoryIndex].value,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/swap-shop"] });
      queryClient.invalidateQueries({ queryKey: [`/api/swap-shop/${listingId}`] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Listing updated", "success");
      navigation.goBack();
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to update listing", "error");
    },
  });

  const handleSubmit = () => {
    if (!validate()) return;
    updateListingMutation.mutate();
  };

  const isValid = title.trim() && price.trim();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <Skeleton.List count={4} style={{ paddingTop: headerHeight + Spacing.lg }} />
      </View>
    );
  }

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
        Edit Listing
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
        Update your listing details
      </ThemedText>

      <View style={styles.section}>
        <View>
          <Input
            label="Title"
            placeholder="e.g., Coyote 5.0L Engine"
            value={title}
            onChangeText={(t) => { setTitle(t); setErrors((e) => ({ ...e, title: "" })); }}
            leftIcon="tag"
            testID="input-edit-title"
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
          testID="input-edit-description"
        />

        <View>
          <Input
            label="Price"
            placeholder="e.g., 4500"
            value={price}
            onChangeText={(p) => { setPrice(p); setErrors((e) => ({ ...e, price: "" })); }}
            leftIcon="dollar-sign"
            keyboardType="numeric"
            testID="input-edit-price"
          />
          {errors.price ? <ThemedText type="caption" style={{ color: theme.error, marginTop: 2 }}>{errors.price}</ThemedText> : null}
        </View>

        <Input
          label="Location"
          placeholder="e.g., Austin, TX"
          value={location}
          onChangeText={setLocation}
          leftIcon="map-pin"
          testID="input-edit-location"
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
            testID="input-edit-image"
          />
          {errors.imageUrl ? <ThemedText type="caption" style={{ color: theme.error, marginTop: 2 }}>{errors.imageUrl}</ThemedText> : null}
        </View>

        <View style={styles.conditionSection}>
          <ThemedText type="body" style={styles.conditionLabel}>
            Category
          </ThemedText>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c, i) => (
              <Pressable
                key={c.value}
                onPress={() => setCategoryIndex(i)}
                style={[
                  styles.chip,
                  {
                    borderColor: i === categoryIndex ? theme.primary : theme.border,
                    backgroundColor: i === categoryIndex ? theme.primary : "transparent",
                  },
                ]}
                testID={`chip-category-${c.value}`}
              >
                <ThemedText
                  type="caption"
                  style={{ color: i === categoryIndex ? "#FFFFFF" : theme.text }}
                >
                  {c.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
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

      <Button onPress={handleSubmit} disabled={!isValid || updateListingMutation.isPending} testID="button-save-listing">
        {updateListingMutation.isPending ? "Saving..." : "Save Changes"}
      </Button>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
  },
});
