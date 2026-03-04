import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { EmptyState } from "@/components/EmptyState";
import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import { emptyStates, microcopy } from "@/constants/brand";

export type ItemCondition = "New" | "Like New" | "Good" | "Fair" | "For Parts";

export interface SwapListing {
  id: string;
  title: string;
  price: string;
  location: string | null;
  condition: string;
  userName: string;
  userSwapCount: number;
  localPickup: boolean;
  willShip: boolean;
  createdAt: string;
  imageUrl: string | null;
}

export interface SwapItem {
  id: string;
  title: string;
  price: string;
  location: string | null;
  condition: ItemCondition;
  seller: {
    name: string;
    successfulSwaps: number;
    memberSince: string;
  };
  localPickup: boolean;
  willShip: boolean;
  postedTime: string;
  hasImage: boolean;
  contactMethod: "in-app";
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return "Just now";
}

function transformToSwapItem(listing: SwapListing): SwapItem {
  return {
    id: listing.id,
    title: listing.title,
    price: listing.price.startsWith("$") ? listing.price : `$${listing.price}`,
    location: listing.location,
    condition: listing.condition as ItemCondition,
    seller: {
      name: listing.userName,
      successfulSwaps: listing.userSwapCount || 0,
      memberSince: new Date(listing.createdAt).getFullYear().toString(),
    },
    localPickup: listing.localPickup,
    willShip: listing.willShip,
    postedTime: formatTimeAgo(listing.createdAt),
    hasImage: Boolean(listing.imageUrl),
    contactMethod: "in-app",
  };
}

const CONDITION_OPTIONS: ItemCondition[] = ["New", "Like New", "Good", "Fair", "For Parts"];

function SwapItemCard({ item, onReport, onPress }: { item: SwapItem; onReport: (item: SwapItem) => void; onPress: (item: SwapItem) => void }) {
  const { theme } = useTheme();

  const getConditionColor = () => {
    switch (item.condition) {
      case "New": return theme.success;
      case "Like New": return theme.success;
      case "Good": return theme.primary;
      case "Fair": return theme.accent;
      case "For Parts": return theme.textMuted;
    }
  };

  const handleReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReport(item);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.cardBorder,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
      onPress={() => onPress(item)}
      testID={`swap-item-${item.id}`}
    >
      <View style={styles.cardContent}>
        <View style={[styles.imagePlaceholder, { backgroundColor: theme.backgroundTertiary }]}>
          {item.hasImage ? (
            <Feather name="image" size={24} color={theme.textMuted} />
          ) : (
            <Feather name="camera-off" size={24} color={theme.textMuted} />
          )}
        </View>
        <View style={styles.cardDetails}>
          <View style={styles.titleRow}>
            <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Pressable onPress={handleReport} hitSlop={8} testID={`report-${item.id}`}>
              <Feather name="flag" size={14} color={theme.textMuted} />
            </Pressable>
          </View>
          <Text style={[styles.cardPrice, { color: theme.primary }]}>
            {item.price}
          </Text>
          <View style={styles.cardMeta}>
            <View style={[styles.conditionBadge, { backgroundColor: getConditionColor() + "20" }]}>
              <Text style={[styles.conditionText, { color: getConditionColor() }]}>
                {item.condition}
              </Text>
            </View>
            {item.localPickup ? (
              <View style={styles.pickupBadge}>
                <Feather name="map-pin" size={10} color={theme.textSecondary} />
                <Text style={[styles.pickupText, { color: theme.textSecondary }]}>
                  {item.location || "Local Pickup"}
                </Text>
              </View>
            ) : null}
            {item.willShip ? (
              <View style={styles.pickupBadge}>
                <Feather name="truck" size={10} color={theme.textSecondary} />
                <Text style={[styles.pickupText, { color: theme.textSecondary }]}>Ships</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.sellerRow}>
            <Feather name="user" size={12} color={theme.textMuted} />
            <Text style={[styles.sellerText, { color: theme.textSecondary }]}>
              {item.seller.name}
            </Text>
            {item.seller.successfulSwaps > 0 ? (
              <View style={[styles.swapsBadge, { backgroundColor: theme.success + "20" }]}>
                <Feather name="check-circle" size={10} color={theme.success} />
                <Text style={[styles.swapsText, { color: theme.success }]}>
                  {item.seller.successfulSwaps} swaps
                </Text>
              </View>
            ) : (
              <View style={[styles.swapsBadge, { backgroundColor: theme.backgroundTertiary }]}>
                <Text style={[styles.swapsText, { color: theme.textMuted }]}>
                  New seller
                </Text>
              </View>
            )}
            <Text style={[styles.timeText, { color: theme.textMuted }]}>
              {item.postedTime}
            </Text>
          </View>
        </View>
      </View>
      <View style={[styles.contactBar, { backgroundColor: theme.backgroundTertiary, borderTopColor: theme.cardBorder }]}>
        <Feather name="message-circle" size={14} color={theme.primary} />
        <Text style={[styles.contactText, { color: theme.primary }]}>
          Contact Seller
        </Text>
        <Feather name="lock" size={12} color={theme.textMuted} style={styles.lockIcon} />
        <Text style={[styles.secureText, { color: theme.textMuted }]}>
          In-app only
        </Text>
      </View>
    </Pressable>
  );
}

const REPORT_REASONS = [
  { id: "scam", label: "Suspected scam" },
  { id: "misrepresented", label: "Item misrepresented" },
  { id: "prohibited", label: "Prohibited item" },
  { id: "spam", label: "Spam or duplicate" },
  { id: "other", label: "Other" },
];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SwapShopScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useSafeTabBarHeight();
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SwapItem | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  const { data: listings = [], isLoading } = useQuery<SwapListing[]>({
    queryKey: ["/api/swap-shop"],
  });

  const handlePostItem = () => {
    navigation.navigate("AddListing");
  };

  const swapItems = listings.map(transformToSwapItem);

  const handleReport = (item: SwapItem) => {
    setSelectedItem(item);
    setSelectedReason(null);
    setReportModalVisible(true);
  };

  const handleListingPress = (item: SwapItem) => {
    navigation.navigate("ListingDetail", { listingId: item.id });
  };

  const handleSubmitReport = () => {
    if (!selectedReason) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReportModalVisible(false);
    Alert.alert(
      "Report Submitted",
      "Thanks for helping keep Swap Shop safe. We'll review this listing.",
      [{ text: "OK" }]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={swapItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SwapItemCard item={item} onReport={handleReport} onPress={handleListingPress} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            image={require("../../assets/images/empty-marketplace.png")}
            title={emptyStates.swapShop.title}
            description={emptyStates.swapShop.message}
            actionLabel={emptyStates.swapShop.action}
            onAction={handlePostItem}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={[styles.trustBanner, { backgroundColor: theme.success + "15", borderColor: theme.success + "30" }]}>
              <Feather name="shield" size={16} color={theme.success} />
              <Text style={[styles.trustBannerText, { color: theme.textSecondary }]}>
                All contact is in-app only. No personal info shared.
              </Text>
            </View>
            <Pressable
              style={[styles.postButton, { backgroundColor: theme.primary }]}
              onPress={handlePostItem}
              testID="button-post-item"
            >
              <Feather name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.postButtonText}>{microcopy.post} Item</Text>
            </Pressable>
          </View>
        }
      />

      <Modal
        visible={reportModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Report Listing
              </Text>
              <Pressable onPress={() => setReportModalVisible(false)} hitSlop={8}>
                <Feather name="x" size={24} color={theme.textMuted} />
              </Pressable>
            </View>
            
            {selectedItem ? (
              <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                {selectedItem.title}
              </Text>
            ) : null}

            <Text style={[styles.modalLabel, { color: theme.text }]}>
              Why are you reporting this?
            </Text>

            <View style={styles.reasonList}>
              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason.id}
                  style={[
                    styles.reasonOption,
                    {
                      backgroundColor: selectedReason === reason.id ? theme.primary + "15" : theme.backgroundSecondary,
                      borderColor: selectedReason === reason.id ? theme.primary : theme.cardBorder,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedReason(reason.id);
                  }}
                  testID={`reason-${reason.id}`}
                >
                  <View style={[
                    styles.radioCircle,
                    {
                      borderColor: selectedReason === reason.id ? theme.primary : theme.textMuted,
                      backgroundColor: selectedReason === reason.id ? theme.primary : "transparent",
                    },
                  ]}>
                    {selectedReason === reason.id ? (
                      <View style={styles.radioInner} />
                    ) : null}
                  </View>
                  <Text style={[styles.reasonText, { color: theme.text }]}>
                    {reason.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[
                styles.submitButton,
                {
                  backgroundColor: selectedReason ? theme.error : theme.backgroundTertiary,
                },
              ]}
              onPress={handleSubmitReport}
              disabled={!selectedReason}
              testID="button-submit-report"
            >
              <Text style={[styles.submitButtonText, { color: selectedReason ? "#FFFFFF" : theme.textMuted }]}>
                Submit Report
              </Text>
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
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: Spacing.lg,
  },
  trustBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  trustBannerText: {
    ...Typography.caption,
    flex: 1,
  },
  postButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  postButtonText: {
    color: "#FFFFFF",
    ...Typography.h4,
  },
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardContent: {
    flexDirection: "row",
  },
  imagePlaceholder: {
    width: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  cardDetails: {
    flex: 1,
    padding: Spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  cardTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xxs,
    flex: 1,
  },
  cardPrice: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  conditionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.full,
  },
  conditionText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  pickupBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  pickupText: {
    ...Typography.caption,
  },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  sellerText: {
    ...Typography.caption,
  },
  swapsBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 3,
  },
  swapsText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "600",
  },
  timeText: {
    ...Typography.caption,
    marginLeft: "auto",
  },
  contactBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.xs,
  },
  contactText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  lockIcon: {
    marginLeft: "auto",
  },
  secureText: {
    ...Typography.caption,
    fontSize: 10,
  },
  separator: {
    height: Spacing.md,
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
  modalTitle: {
    ...Typography.h3,
  },
  modalSubtitle: {
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  modalLabel: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  reasonList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
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
  reasonText: {
    ...Typography.body,
  },
  submitButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  submitButtonText: {
    ...Typography.h4,
  },
});
