import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, Modal, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
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
  sellerJoinDate: string | null;
  sellerListingCount: number;
}

const REPORT_REASONS = [
  { id: "scam", label: "Suspected scam" },
  { id: "spam", label: "Spam or duplicate" },
  { id: "harassment", label: "Harassment or abuse" },
  { id: "illegal", label: "Prohibited item" },
  { id: "other", label: "Other" },
];

const CONDITION_VARIANTS: Record<string, "success" | "primary" | "warning" | "muted" | "default"> = {
  New: "success",
  "Like New": "success",
  Good: "primary",
  Fair: "warning",
  "For Parts": "muted",
};

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
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

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

  const reportMutation = useMutation({
    mutationFn: async (reason: string) => {
      return apiRequest("POST", "/api/reports", {
        contentType: "swap_listing",
        contentId: listingId,
        reportedUserId: listing?.userId || null,
        reason,
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReportModalVisible(false);
      toast.show("Report submitted", "success");
    },
    onError: () => {
      toast.show("Failed to submit report", "error");
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
      "In-app messaging coming soon! For now, you can find this seller in the community.",
      [{ text: "OK" }]
    );
  };

  const handleShare = async () => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN || "torqueshed.pro";
    const url = `https://${domain}/listing/${listingId}`;
    try {
      await Clipboard.setStringAsync(url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Link copied to clipboard", "success");
    } catch {
      toast.show("Failed to copy link", "error");
    }
  };

  const handleSellerPress = () => {
    if (listing) {
      navigation.navigate("Profile", { userId: listing.userId } as { userId?: string });
    }
  };

  const handleSubmitReport = () => {
    if (!selectedReason) return;
    reportMutation.mutate(selectedReason);
  };

  if (isLoading || !listing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <Skeleton.List count={3} style={{ paddingTop: headerHeight + Spacing.lg }} />
      </View>
    );
  }

  const isOwner = currentUser?.id === listing.userId;
  const conditionVariant = CONDITION_VARIANTS[listing.condition] || "default";

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={{ flex: 1 }}
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
          <StatusBadge label={listing.condition} variant={conditionVariant} size="md" />
          {listing.localPickup ? (
            <StatusBadge label="Pickup" icon="map-pin" variant="muted" size="sm" />
          ) : null}
          {listing.willShip ? (
            <StatusBadge label="Ships" icon="truck" variant="muted" size="sm" />
          ) : null}
        </View>

        <View style={styles.actionRow}>
          {currentUser ? (
            <Pressable
              onPress={() => toggleSaveListingMutation.mutate()}
              disabled={toggleSaveListingMutation.isPending}
              style={[styles.actionBtn, { borderColor: isListingSaved ? theme.primary : theme.border }]}
              testID="button-bookmark-listing"
            >
              <Feather name="bookmark" size={16} color={isListingSaved ? theme.primary : theme.textSecondary} />
              <ThemedText type="caption" style={{ color: isListingSaved ? theme.primary : theme.textSecondary }}>
                {isListingSaved ? "Saved" : "Save"}
              </ThemedText>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleShare}
            style={[styles.actionBtn, { borderColor: theme.border }]}
            testID="button-share-listing"
          >
            <Feather name="share-2" size={16} color={theme.textSecondary} />
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>Share</ThemedText>
          </Pressable>
          {currentUser && !isOwner ? (
            <Pressable
              onPress={() => { setSelectedReason(null); setReportModalVisible(true); }}
              style={[styles.actionBtn, { borderColor: theme.border }]}
              testID="button-report-listing"
            >
              <Feather name="flag" size={16} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Report</ThemedText>
            </Pressable>
          ) : null}
        </View>

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
          <Pressable style={styles.sellerInfo} onPress={handleSellerPress} testID="button-view-seller">
            <View style={[styles.avatar, { backgroundColor: theme.primary + "20" }]}>
              <ThemedText type="h4" style={{ color: theme.primary }}>
                {(listing.userName || "U").charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <View style={styles.sellerDetails}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>{listing.userName || "Unknown"}</ThemedText>
                <Feather name="chevron-right" size={14} color={theme.textMuted} />
              </View>
              <View style={{ flexDirection: "row", gap: Spacing.md, marginTop: 2 }}>
                {listing.sellerJoinDate ? (
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Member since {formatDate(listing.sellerJoinDate)}
                  </ThemedText>
                ) : null}
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {listing.sellerListingCount || 0} {(listing.sellerListingCount || 0) === 1 ? "listing" : "listings"}
                </ThemedText>
              </View>
            </View>
          </Pressable>
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

      <Modal visible={reportModalVisible} animationType="slide" transparent onRequestClose={() => setReportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Report Listing</ThemedText>
              <Pressable onPress={() => setReportModalVisible(false)} hitSlop={8}>
                <Feather name="x" size={24} color={theme.textMuted} />
              </Pressable>
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }} numberOfLines={1}>
              {listing.title}
            </ThemedText>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Why are you reporting this?</ThemedText>
            <View style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason.id}
                  style={[styles.reasonOption, { backgroundColor: selectedReason === reason.id ? theme.primary + "15" : theme.backgroundSecondary, borderColor: selectedReason === reason.id ? theme.primary : theme.cardBorder }]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedReason(reason.id); }}
                  testID={`reason-${reason.id}`}
                >
                  <View style={[styles.radioCircle, { borderColor: selectedReason === reason.id ? theme.primary : theme.textMuted, backgroundColor: selectedReason === reason.id ? theme.primary : "transparent" }]}>
                    {selectedReason === reason.id ? <View style={styles.radioInner} /> : null}
                  </View>
                  <ThemedText type="body">{reason.label}</ThemedText>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[styles.submitReportBtn, { backgroundColor: selectedReason ? theme.error : theme.backgroundTertiary }]}
              onPress={handleSubmitReport}
              disabled={!selectedReason || reportMutation.isPending}
              testID="button-submit-report"
            >
              <ThemedText type="h4" style={{ color: selectedReason ? "#FFFFFF" : theme.textMuted }}>
                {reportMutation.isPending ? "Submitting..." : "Submit Report"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
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
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
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
    flex: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  submitReportBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});
