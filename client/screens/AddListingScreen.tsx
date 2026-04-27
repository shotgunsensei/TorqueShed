import React, { useState } from "react";
import { View, StyleSheet, Switch, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ThemedText } from "@/components/ThemedText";
import { LockedFeature } from "@/components/LockedFeature";
import { PhotoPickerGrid } from "@/components/PhotoPickerGrid";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { useEntitlements } from "@/lib/entitlements";
import { Feather } from "@expo/vector-icons";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const CONTACT_METHODS: { value: string; label: string }[] = [
  { value: "in_app", label: "In-App" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
];

const CONDITIONS = ["New", "Like New", "Good", "Fair", "For Parts"];
const CATEGORIES: { value: string; label: string }[] = [
  { value: "parts", label: "Parts" },
  { value: "tools", label: "Tools" },
  { value: "scan_tools", label: "Scan Tools" },
  { value: "services", label: "Services" },
  { value: "project_vehicles", label: "Project Vehicles" },
];

interface CaseOption {
  id: string;
  title: string;
}

export default function AddListingScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasFeature } = useEntitlements();
  const canAdvancedListing = hasFeature("advanced_listing_options");

  const route = useRoute<any>();
  const presetCaseId: string | undefined = route?.params?.caseId;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [coverImages, setCoverImages] = useState<string[]>([]);
  const [extraImages, setExtraImages] = useState<string[]>([]);
  const [contactMethodIndex, setContactMethodIndex] = useState(0);
  const [isDraft, setIsDraft] = useState(false);
  const [conditionIndex, setConditionIndex] = useState(2);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [attachedCaseId, setAttachedCaseId] = useState<string | null>(presetCaseId ?? null);
  const [localPickup, setLocalPickup] = useState(true);
  const [willShip, setWillShip] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: caseOptions = [] } = useQuery<CaseOption[]>({
    queryKey: ["/api/threads/me"],
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!price.trim()) newErrors.price = "Price is required";
    else if (isNaN(Number(price.replace(/[,$]/g, "")))) newErrors.price = "Enter a valid number";
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
        imageUrl: coverImages[0] || null,
        localPickup,
        willShip,
        category: CATEGORIES[categoryIndex].value,
        attachedCaseId: attachedCaseId,
        ...(canAdvancedListing
          ? {
              extraImageUrls: extraImages,
              contactMethod: CONTACT_METHODS[contactMethodIndex].value,
              isDraft,
            }
          : {}),
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

        <PhotoPickerGrid
          label="Cover photo"
          helperText="Take a photo or choose one from your library."
          values={coverImages}
          onChange={setCoverImages}
          max={1}
          testID="picker-cover-image"
        />

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

        {caseOptions.length > 0 ? (
          <View style={styles.conditionSection}>
            <ThemedText type="body" style={styles.conditionLabel}>
              Attach to a case (optional)
            </ThemedText>
            <View style={styles.chipRow}>
              <Pressable
                onPress={() => setAttachedCaseId(null)}
                style={[
                  styles.chip,
                  {
                    borderColor: attachedCaseId === null ? theme.primary : theme.border,
                    backgroundColor: attachedCaseId === null ? theme.primary : "transparent",
                  },
                ]}
                testID="chip-case-none"
              >
                <ThemedText type="caption" style={{ color: attachedCaseId === null ? "#FFFFFF" : theme.text }}>
                  None
                </ThemedText>
              </Pressable>
              {caseOptions.slice(0, 8).map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setAttachedCaseId(c.id)}
                  style={[
                    styles.chip,
                    {
                      borderColor: attachedCaseId === c.id ? theme.primary : theme.border,
                      backgroundColor: attachedCaseId === c.id ? theme.primary : "transparent",
                    },
                  ]}
                  testID={`chip-case-${c.id}`}
                >
                  <ThemedText
                    type="caption"
                    style={{ color: attachedCaseId === c.id ? "#FFFFFF" : theme.text }}
                    numberOfLines={1}
                  >
                    {c.title.length > 24 ? c.title.slice(0, 24) + "…" : c.title}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

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

        <View style={[styles.advancedSection, { borderTopColor: theme.border }]}>
          <View style={styles.advancedHeader}>
            <Feather name="settings" size={14} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginLeft: 6 }}>
              Advanced listing options
            </ThemedText>
          </View>
          {canAdvancedListing ? (
            <View style={{ gap: Spacing.lg, marginTop: Spacing.sm }}>
              <PhotoPickerGrid
                label="Extra photos"
                helperText="Up to 5 additional photos. Buyers see these in the gallery."
                values={extraImages}
                onChange={setExtraImages}
                max={5}
                testID="picker-extra-images"
              />
              <View style={{ gap: Spacing.sm }}>
                <ThemedText type="body">Preferred contact method</ThemedText>
                <View style={styles.chipRow}>
                  {CONTACT_METHODS.map((c, i) => (
                    <Pressable
                      key={c.value}
                      onPress={() => setContactMethodIndex(i)}
                      style={[
                        styles.chip,
                        {
                          borderColor: i === contactMethodIndex ? theme.primary : theme.border,
                          backgroundColor: i === contactMethodIndex ? theme.primary : "transparent",
                        },
                      ]}
                      testID={`chip-contact-${c.value}`}
                    >
                      <ThemedText type="caption" style={{ color: i === contactMethodIndex ? "#FFFFFF" : theme.text }}>
                        {c.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.switchRow}>
                <View>
                  <ThemedText type="body">Save as draft</ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Hidden from buyers until you publish
                  </ThemedText>
                </View>
                <Switch
                  value={isDraft}
                  onValueChange={setIsDraft}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          ) : (
            <LockedFeature
              feature="advanced_listing_options"
              title="Pro listing tools"
              description="Add multiple photos, save listings as drafts, and choose how buyers contact you."
              onUpgrade={() => navigation.navigate("Main", { screen: "MoreTab", params: { screen: "Subscription" } })}
              compact
            />
          )}
        </View>
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
  advancedSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  advancedHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
});
