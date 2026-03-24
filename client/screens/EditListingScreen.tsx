import React, { useState, useEffect } from "react";
import { View, StyleSheet, Switch, Alert } from "react-native";
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
  const [conditionIndex, setConditionIndex] = useState(2);
  const [localPickup, setLocalPickup] = useState(true);
  const [willShip, setWillShip] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const { data: listing, isLoading } = useQuery<Listing>({
    queryKey: [`/api/swap-shop/${listingId}`],
  });

  useEffect(() => {
    if (listing && !isInitialized) {
      setTitle(listing.title || "");
      setDescription(listing.description || "");
      setPrice(listing.price?.replace(/^\$/, "") || "");
      setLocation(listing.location || "");
      const condIdx = CONDITIONS.indexOf(listing.condition);
      setConditionIndex(condIdx >= 0 ? condIdx : 2);
      setLocalPickup(listing.localPickup);
      setWillShip(listing.willShip);
      setIsInitialized(true);
    }
  }, [listing, isInitialized]);

  const updateListingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/swap-shop/${listingId}`, {
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
    if (!title.trim()) {
      Alert.alert("Validation Error", "Title is required");
      return;
    }
    if (!price.trim()) {
      Alert.alert("Validation Error", "Price is required");
      return;
    }
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

      <Button onPress={handleSubmit} disabled={!isValid || updateListingMutation.isPending}>
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
});
