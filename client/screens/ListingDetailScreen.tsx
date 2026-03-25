import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type ListingDetailParams = {
  listingId: string;
};

type RoutePropType = RouteProp<{ ListingDetail: ListingDetailParams }, "ListingDetail">;

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
  userName: string;
  userSwapCount: number;
}

export default function ListingDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  const { currentUser } = useAuth();
  const { listingId } = route.params;

  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: listing, isLoading } = useQuery<Listing>({
    queryKey: [`/api/swap-shop/${listingId}`],
  });

  const { data: savedListingIds = [] } = useQuery<string[]>({
    queryKey: ["/api/saved/listing-ids"],
    enabled: !!currentUser,
  });

  const isListingSaved = savedListingIds.includes(listingId);

  const toggleSaveListingMutation = useMutation({
    mutationFn: async () => {
      if (isListingSaved) {
        return apiRequest("DELETE", `/api/saved/listings/${listingId}`);
      }
      return apiRequest("POST", `/api/saved/listings/${listingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved/listing-ids"] });
      queryClient.invalidateQueries({ queryKey: ["/api/saved"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show(isListingSaved ? "Removed from saved" : "Listing saved", "success");
    },
    onError: () => {
      toast.show("Failed to update saved listings", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/swap-shop/${listingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/swap-shop"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Listing deleted", "success");
      navigation.goBack();
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to delete listing", "error");
    },
  });

  const handleDelete = () => {
    Alert.alert(
      "Delete Listing",
      "Are you sure you want to delete this listing? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "New": return theme.success;
      case "Like New": return theme.primary;
      case "Good": return "#F59E0B";
      case "Fair": return theme.textSecondary;
      default: return theme.textMuted;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleContact = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Contact Seller",
      "In-app messaging coming soon! For now, you can find this seller in the community chat.",
      [{ text: "OK" }]
    );
  };

  if (isLoading || !listing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <Skeleton.List count={3} style={{ paddingTop: headerHeight + Spacing.lg }} />
      </View>
    );
  }

  const isOwner = currentUser?.id === listing.userId;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={[styles.imageContainer, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="image" size={48} color={theme.textSecondary} />
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
          No image available
        </ThemedText>
      </View>

      <View style={styles.header}>
        <ThemedText type="h2">{listing.title}</ThemedText>
        <ThemedText type="h1" style={{ color: theme.primary, marginTop: Spacing.sm }}>
          {listing.price.startsWith("$") ? listing.price : `$${listing.price}`}
        </ThemedText>
      </View>

      <View style={styles.badges}>
        <View style={[styles.badge, { backgroundColor: getConditionColor(listing.condition) + "20" }]}>
          <ThemedText type="caption" style={{ color: getConditionColor(listing.condition), fontWeight: "600" }}>
            {listing.condition}
          </ThemedText>
        </View>
        {listing.localPickup ? (
          <View style={[styles.badge, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="map-pin" size={12} color={theme.textSecondary} />
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              Pickup
            </ThemedText>
          </View>
        ) : null}
        {listing.willShip ? (
          <View style={[styles.badge, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="truck" size={12} color={theme.textSecondary} />
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              Ships
            </ThemedText>
          </View>
        ) : null}
      </View>

      {currentUser ? (
        <Pressable
          onPress={() => toggleSaveListingMutation.mutate()}
          disabled={toggleSaveListingMutation.isPending}
          style={[styles.saveButton, { borderColor: isListingSaved ? theme.primary : theme.border }]}
          testID="button-bookmark-listing"
        >
          <Feather name="bookmark" size={16} color={isListingSaved ? theme.primary : theme.textSecondary} />
          <ThemedText type="body" style={{ color: isListingSaved ? theme.primary : theme.textSecondary, marginLeft: Spacing.sm }}>
            {isListingSaved ? "Saved" : "Save Listing"}
          </ThemedText>
        </Pressable>
      ) : null}

      {listing.description ? (
        <Card style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Description</ThemedText>
          <ThemedText type="body" style={{ lineHeight: 22 }}>
            {listing.description}
          </ThemedText>
        </Card>
      ) : null}

      {listing.location ? (
        <Card style={styles.section}>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              {listing.location}
            </ThemedText>
          </View>
        </Card>
      ) : null}

      <Card style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>Seller</ThemedText>
        <View style={styles.sellerInfo}>
          <View style={[styles.avatar, { backgroundColor: theme.primary + "20" }]}>
            <ThemedText type="h4" style={{ color: theme.primary }}>
              {(listing.userName || "U").charAt(0).toUpperCase()}
            </ThemedText>
          </View>
          <View style={styles.sellerDetails}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{listing.userName || "Unknown"}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {listing.userSwapCount || 0} successful swaps
            </ThemedText>
          </View>
        </View>
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
          Posted {formatDate(listing.createdAt)}
        </ThemedText>
      </Card>

      {!isOwner ? (
        <Button onPress={handleContact} style={styles.contactButton}>
          Contact Seller
        </Button>
      ) : (
        <View style={styles.ownerActions}>
          <Button
            onPress={() => navigation.navigate("EditListing", { listingId })}
            style={styles.editButton}
          >
            Edit Listing
          </Button>
          <Pressable
            onPress={handleDelete}
            disabled={deleteMutation.isPending}
            style={[styles.deleteButton, { borderColor: theme.error }]}
            testID="delete-listing-button"
          >
            <Feather name="trash-2" size={16} color={theme.error} />
            <ThemedText type="body" style={{ color: theme.error, marginLeft: Spacing.sm }}>
              {deleteMutation.isPending ? "Deleting..." : "Delete Listing"}
            </ThemedText>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageContainer: {
    height: 200,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  section: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sellerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  sellerDetails: {
    marginLeft: Spacing.md,
  },
  contactButton: {
    marginTop: Spacing.lg,
  },
  ownerActions: {
    marginTop: Spacing.lg,
  },
  editButton: {
    marginBottom: Spacing.md,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
});
