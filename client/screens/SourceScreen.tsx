import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Alert,
  RefreshControl,
  Linking,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useResponsive } from "@/hooks/useResponsive";
import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import { emptyStates, microcopy } from "@/constants/brand";
import { getApiUrl } from "@/lib/query-client";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type SegmentKey = "shop" | "swap" | "find";

const SEGMENTS: { key: SegmentKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "shop", label: "Shop", icon: "package" },
  { key: "swap", label: "Swap", icon: "repeat" },
  { key: "find", label: "Find Parts", icon: "search" },
];

interface SwapListing {
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
  sellerJoinDate: string | null;
  sellerListingCount: number;
}

interface Product {
  id: string;
  title: string;
  description: string | null;
  whyItMatters: string | null;
  price: string | null;
  priceRange: string | null;
  category: string;
  affiliateLink: string | null;
  vendor: string | null;
  imageUrl: string | null;
  isSponsored: boolean;
  submissionStatus: "pending" | "approved" | "featured";
  featuredExpiration: string | null;
  createdAt: string;
}

interface Vehicle {
  id: string;
  year: string | null;
  make: string | null;
  model: string | null;
  nickname: string | null;
}

const CONDITION_COLORS: Record<string, string> = {
  New: "#22C55E",
  "Like New": "#22C55E",
  Good: "#FF6B35",
  Fair: "#F59E0B",
  "For Parts": "#6B7280",
};

const PRODUCT_CATEGORIES = ["All", "Hand Tools", "Power Tools", "Diagnostic", "Safety", "Accessories", "Fluids", "Electrical"];

const VENDOR_LINKS = [
  { id: "rockauto", name: "RockAuto", icon: "truck" as const, buildUrl: (q: string) => `https://www.rockauto.com/en/catalog/?a=${encodeURIComponent(q)}` },
  { id: "autozone", name: "AutoZone", icon: "shopping-cart" as const, buildUrl: (q: string) => `https://www.autozone.com/searchresult?searchText=${encodeURIComponent(q)}` },
  { id: "oreilly", name: "O'Reilly", icon: "tool" as const, buildUrl: (q: string) => `https://www.oreillyauto.com/search?q=${encodeURIComponent(q)}` },
  { id: "amazon", name: "Amazon", icon: "box" as const, buildUrl: (q: string) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}` },
];

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

function formatJoinDate(dateString: string | null): string {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  const month = date.toLocaleString("en", { month: "short" });
  return `${month} ${date.getFullYear()}`;
}

function SwapCard({ item, onPress, onReport }: { item: SwapListing; onPress: () => void; onReport: () => void }) {
  const { theme } = useTheme();
  const condColor = CONDITION_COLORS[item.condition] || theme.textMuted;

  return (
    <Card elevation={2} onPress={onPress} style={s.swapCard} testID={`swap-item-${item.id}`}>
      <View style={[s.swapImageArea, { backgroundColor: theme.backgroundTertiary }]}>
        {item.imageUrl ? (
          <Feather name="image" size={28} color={theme.textMuted} />
        ) : (
          <Feather name="camera-off" size={28} color={theme.textMuted} />
        )}
        <View style={[s.conditionBadge, { backgroundColor: condColor + "20" }]}>
          <Text style={[s.conditionText, { color: condColor }]}>{item.condition}</Text>
        </View>
      </View>
      <View style={s.swapBody}>
        <Text style={[s.swapTitle, { color: theme.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[s.swapPrice, { color: theme.primary }]}>
          {item.price.startsWith("$") ? item.price : `$${item.price}`}
        </Text>

        <View style={s.swapShipping}>
          {item.localPickup ? (
            <View style={s.shippingBadge}>
              <Feather name="map-pin" size={10} color={theme.textSecondary} />
              <Text style={[s.shippingText, { color: theme.textSecondary }]}>
                {item.location || "Local Pickup"}
              </Text>
            </View>
          ) : null}
          {item.willShip ? (
            <View style={s.shippingBadge}>
              <Feather name="truck" size={10} color={theme.textSecondary} />
              <Text style={[s.shippingText, { color: theme.textSecondary }]}>Ships</Text>
            </View>
          ) : null}
        </View>

        <View style={[s.sellerRow, { borderTopColor: theme.cardBorder }]}>
          <View style={[s.sellerAvatar, { backgroundColor: theme.backgroundTertiary }]}>
            <Feather name="user" size={12} color={theme.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.sellerName, { color: theme.text }]}>{item.userName}</Text>
            <Text style={[s.sellerMeta, { color: theme.textMuted }]}>
              Joined {formatJoinDate(item.sellerJoinDate)}
              {item.sellerListingCount > 0 ? ` \u00B7 ${item.sellerListingCount} ${item.sellerListingCount === 1 ? "listing" : "listings"}` : ""}
            </Text>
          </View>
          <Pressable
            onPress={(e) => { e.stopPropagation(); onReport(); }}
            hitSlop={8}
            style={s.reportBtn}
            testID={`report-listing-${item.id}`}
          >
            <Feather name="flag" size={14} color={theme.textMuted} />
          </Pressable>
          <Text style={[s.swapTime, { color: theme.textMuted }]}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
      </View>
    </Card>
  );
}

function ProductCard({ item }: { item: Product }) {
  const { theme } = useTheme();
  const isFeatured = item.submissionStatus === "featured";

  const trackClick = async () => {
    try {
      const url = new URL(`/api/products/${item.id}/click`, getApiUrl());
      await fetch(url.toString(), { method: "POST" });
    } catch {}
  };

  const handleViewDeal = async () => {
    if (item.affiliateLink) {
      await trackClick();
      Linking.openURL(item.affiliateLink);
    }
  };

  return (
    <View
      style={[
        s.productCard,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: isFeatured ? theme.accent : theme.cardBorder,
          borderWidth: isFeatured ? 2 : 1,
        },
      ]}
      testID={`product-card-${item.id}`}
    >
      <View style={[s.productImageArea, { backgroundColor: theme.backgroundTertiary }]}>
        <Feather name="package" size={28} color={theme.textMuted} />
        {isFeatured ? (
          <View style={[s.featuredBadge, { backgroundColor: theme.accent }]}>
            <Feather name="star" size={10} color="#FFFFFF" />
            <Text style={s.badgeText}>Featured</Text>
          </View>
        ) : item.isSponsored ? (
          <View style={[s.sponsoredBadge, { backgroundColor: theme.accent }]}>
            <Text style={[s.badgeText, { color: "#000000" }]}>Sponsored</Text>
          </View>
        ) : null}
      </View>
      <View style={s.productBody}>
        <View style={[s.categoryTag, { backgroundColor: theme.backgroundTertiary }]}>
          <Text style={[s.categoryTagText, { color: theme.textSecondary }]}>{item.category}</Text>
        </View>
        <Text style={[s.productTitle, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
        {item.vendor ? (
          <Text style={[s.productVendor, { color: theme.textMuted }]}>{item.vendor}</Text>
        ) : null}
        {item.whyItMatters ? (
          <View style={[s.whyBox, { backgroundColor: theme.backgroundTertiary }]}>
            <Feather name="info" size={11} color={theme.primary} style={{ marginRight: 4, marginTop: 1 }} />
            <Text style={[s.whyText, { color: theme.textSecondary }]} numberOfLines={2}>{item.whyItMatters}</Text>
          </View>
        ) : null}
        <Text style={[s.productPrice, { color: theme.primary }]}>
          {item.priceRange || item.price || "Check price"}
        </Text>
        {item.affiliateLink ? (
          <Pressable
            onPress={handleViewDeal}
            style={({ pressed }) => [s.viewDealBtn, { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 }]}
            testID={`view-deal-${item.id}`}
          >
            <Text style={s.viewDealText}>{microcopy.viewDeal}</Text>
            <Feather name="external-link" size={13} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View style={[s.noLinkBox, { borderColor: theme.border }]}>
            <Text style={[s.noLinkText, { color: theme.textMuted }]}>Search vendor for pricing</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ShopSection() {
  const { theme } = useTheme();
  const { isDesktop, width } = useResponsive();
  const tabBarHeight = useSafeTabBarHeight();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const numColumns = isDesktop ? (width >= 1280 ? 4 : 3) : 2;

  const { data: products = [], isLoading, refetch, isRefetching } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filtered = selectedCategory === "All"
    ? products
    : products.filter((p) => p.category === selectedCategory);

  if (isLoading) return <Skeleton.Grid count={6} columns={numColumns} />;

  return (
    <FlatList
      key={`shop-${numColumns}`}
      data={filtered}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ProductCard item={item} />}
      numColumns={numColumns}
      columnWrapperStyle={filtered.length > 0 ? s.productRow : undefined}
      contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
      ListHeaderComponent={
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.categoryScroller} contentContainerStyle={s.categoryScrollerContent}>
          {PRODUCT_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[s.categoryPill, { backgroundColor: active ? theme.primary : theme.backgroundSecondary, borderColor: active ? theme.primary : theme.cardBorder }]}
              >
                <Text style={[s.categoryPillText, { color: active ? "#FFFFFF" : theme.textSecondary }]}>{cat}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      }
      ListEmptyComponent={
        <EmptyState icon="package" title={emptyStates.products.title} description={emptyStates.products.message} />
      }
    />
  );
}

function SwapSection() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const tabBarHeight = useSafeTabBarHeight();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SwapListing | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  const { data: listings = [], isLoading, refetch, isRefetching } = useQuery<SwapListing[]>({
    queryKey: ["/api/swap-shop"],
  });

  const filtered = searchQuery.trim()
    ? listings.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.location || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : listings;

  const REPORT_REASONS = [
    { id: "scam", label: "Suspected scam" },
    { id: "misrepresented", label: "Item misrepresented" },
    { id: "prohibited", label: "Prohibited item" },
    { id: "spam", label: "Spam or duplicate" },
    { id: "other", label: "Other" },
  ];

  const handleSubmitReport = () => {
    if (!selectedReason) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReportModalVisible(false);
    Alert.alert("Report Submitted", "Thanks for helping keep Swap Shop safe. We'll review this listing.", [{ text: "OK" }]);
  };

  if (isLoading) return <Skeleton.List count={4} />;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SwapCard
            item={item}
            onPress={() => navigation.navigate("ListingDetail", { listingId: item.id })}
            onReport={() => {
              setSelectedItem(item);
              setSelectedReason(null);
              setReportModalVisible(true);
            }}
          />
        )}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
        ListHeaderComponent={
          <View>
            <View style={[s.trustBanner, { backgroundColor: theme.success + "15", borderColor: theme.success + "30" }]}>
              <Feather name="shield" size={16} color={theme.success} />
              <Text style={[s.trustText, { color: theme.textSecondary }]}>All contact is in-app only. No personal info shared.</Text>
            </View>
            <View style={[s.searchRow, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
              <Feather name="search" size={16} color={theme.textMuted} />
              <TextInput
                style={[s.searchInput, { color: theme.text }]}
                placeholder="Search listings, sellers, location..."
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                clearButtonMode="while-editing"
                testID="input-search-listings"
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          searchQuery.trim() ? (
            <View style={s.emptySearch}>
              <Feather name="search" size={40} color={theme.textMuted} />
              <Text style={[s.emptySearchText, { color: theme.textMuted }]}>No listings match "{searchQuery}"</Text>
            </View>
          ) : (
            <EmptyState
              icon="shopping-bag"
              title={emptyStates.swapShop.title}
              description={emptyStates.swapShop.message}
              actionLabel={emptyStates.swapShop.action}
              onAction={() => navigation.navigate("AddListing")}
            />
          )
        }
      />

      <Modal visible={reportModalVisible} animationType="slide" transparent onRequestClose={() => setReportModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: theme.text }]}>Report Listing</Text>
              <Pressable onPress={() => setReportModalVisible(false)} hitSlop={8}>
                <Feather name="x" size={24} color={theme.textMuted} />
              </Pressable>
            </View>
            {selectedItem ? (
              <Text style={[s.modalSub, { color: theme.textSecondary }]} numberOfLines={1}>{selectedItem.title}</Text>
            ) : null}
            <Text style={[s.modalLabel, { color: theme.text }]}>Why are you reporting this?</Text>
            <View style={s.reasonList}>
              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason.id}
                  style={[s.reasonOption, { backgroundColor: selectedReason === reason.id ? theme.primary + "15" : theme.backgroundSecondary, borderColor: selectedReason === reason.id ? theme.primary : theme.cardBorder }]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedReason(reason.id); }}
                >
                  <View style={[s.radioCircle, { borderColor: selectedReason === reason.id ? theme.primary : theme.textMuted, backgroundColor: selectedReason === reason.id ? theme.primary : "transparent" }]}>
                    {selectedReason === reason.id ? <View style={s.radioInner} /> : null}
                  </View>
                  <Text style={[s.reasonText, { color: theme.text }]}>{reason.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[s.submitBtn, { backgroundColor: selectedReason ? theme.error : theme.backgroundTertiary }]} onPress={handleSubmitReport} disabled={!selectedReason}>
              <Text style={[s.submitBtnText, { color: selectedReason ? "#FFFFFF" : theme.textMuted }]}>Submit Report</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FindPartsSection() {
  const { theme } = useTheme();
  const tabBarHeight = useSafeTabBarHeight();
  const [partQuery, setPartQuery] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const { data: vehicles = [] } = useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  const vehicleLabel = (v: Vehicle) => {
    if (v.nickname) return v.nickname;
    return [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";
  };

  const buildSearchQuery = () => {
    const parts = [];
    if (selectedVehicle) {
      if (selectedVehicle.year) parts.push(selectedVehicle.year);
      if (selectedVehicle.make) parts.push(selectedVehicle.make);
      if (selectedVehicle.model) parts.push(selectedVehicle.model);
    }
    if (partQuery.trim()) parts.push(partQuery.trim());
    return parts.join(" ");
  };

  const searchText = buildSearchQuery();

  return (
    <ScrollView
      contentContainerStyle={{ padding: Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[s.findHeader, { backgroundColor: theme.primary + "10", borderColor: theme.primary + "25" }]}>
        <Feather name="search" size={20} color={theme.primary} />
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={[s.findHeaderTitle, { color: theme.text }]}>Search Parts Across Vendors</Text>
          <Text style={[s.findHeaderDesc, { color: theme.textSecondary }]}>
            Select your vehicle and part, then tap a vendor to search directly on their site.
          </Text>
        </View>
      </View>

      {vehicles.length > 0 ? (
        <View style={{ marginBottom: Spacing.md }}>
          <Text style={[s.findLabel, { color: theme.textSecondary }]}>Vehicle</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.vehicleChips}>
            {vehicles.map((v) => {
              const active = selectedVehicleId === v.id;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => setSelectedVehicleId(active ? null : v.id)}
                  style={[s.vehicleChip, { backgroundColor: active ? theme.primary + "20" : theme.backgroundSecondary, borderColor: active ? theme.primary : theme.cardBorder }]}
                >
                  <Text style={[s.vehicleChipText, { color: active ? theme.primary : theme.text }]}>{vehicleLabel(v)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ marginBottom: Spacing.lg }}>
        <Text style={[s.findLabel, { color: theme.textSecondary }]}>Part Name</Text>
        <View style={[s.searchRow, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          <Feather name="search" size={16} color={theme.textMuted} />
          <TextInput
            style={[s.searchInput, { color: theme.text }]}
            placeholder="e.g., brake pads, alternator, oil filter"
            placeholderTextColor={theme.textMuted}
            value={partQuery}
            onChangeText={setPartQuery}
            returnKeyType="search"
            testID="input-part-search"
          />
        </View>
      </View>

      {searchText.length > 0 ? (
        <View>
          <Text style={[s.findLabel, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
            Search on vendor sites
          </Text>
          {VENDOR_LINKS.map((vendor) => (
            <Pressable
              key={vendor.id}
              style={({ pressed }) => [
                s.vendorLink,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: theme.cardBorder,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
              onPress={() => Linking.openURL(vendor.buildUrl(searchText))}
              testID={`vendor-${vendor.id}`}
            >
              <View style={[s.vendorIcon, { backgroundColor: theme.primary + "15" }]}>
                <Feather name={vendor.icon} size={18} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.vendorName, { color: theme.text }]}>{vendor.name}</Text>
                <Text style={[s.vendorDesc, { color: theme.textMuted }]} numberOfLines={1}>
                  Search "{searchText}" on {vendor.name}
                </Text>
              </View>
              <Feather name="external-link" size={16} color={theme.primary} />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={s.findEmpty}>
          <Feather name="search" size={40} color={theme.textMuted} />
          <Text style={[s.findEmptyText, { color: theme.textMuted }]}>
            Enter a vehicle and/or part name to search
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

export default function SourceScreen({ route }: { route?: { params?: { segment?: SegmentKey } } }) {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const tabBarHeight = useSafeTabBarHeight();
  const { currentUser } = useAuth();
  const routeSegment = route?.params?.segment;
  const [activeSegment, setActiveSegment] = useState<SegmentKey>(routeSegment || "shop");

  useEffect(() => {
    if (routeSegment) {
      setActiveSegment(routeSegment);
    }
  }, [routeSegment]);

  return (
    <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[s.segmentBar, { backgroundColor: theme.backgroundSecondary, borderBottomColor: theme.border }]}>
        {SEGMENTS.map((seg) => {
          const active = activeSegment === seg.key;
          return (
            <Pressable
              key={seg.key}
              onPress={() => setActiveSegment(seg.key)}
              style={[s.segmentBtn, active ? { borderBottomColor: theme.primary, borderBottomWidth: 2 } : null]}
              testID={`segment-${seg.key}`}
            >
              <Feather name={seg.icon} size={16} color={active ? theme.primary : theme.textMuted} />
              <Text style={[s.segmentText, { color: active ? theme.primary : theme.textMuted }]}>{seg.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeSegment === "shop" ? <ShopSection /> : null}
      {activeSegment === "swap" ? <SwapSection /> : null}
      {activeSegment === "find" ? <FindPartsSection /> : null}

      {activeSegment === "swap" ? (
        currentUser != null ? (
          <Pressable
            style={[s.fab, { backgroundColor: theme.primary, bottom: tabBarHeight + Spacing.lg }]}
            onPress={() => navigation.navigate("AddListing")}
            testID="button-add-listing"
          >
            <Feather name="plus" size={24} color="#FFFFFF" />
          </Pressable>
        ) : null
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  segmentBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  segmentText: {
    ...Typography.body,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },

  swapCard: { marginBottom: Spacing.md, overflow: "hidden", padding: 0 },
  swapImageArea: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  conditionBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  conditionText: { ...Typography.caption, fontWeight: "600", fontSize: 11 },
  swapBody: { padding: Spacing.md },
  swapTitle: { ...Typography.h4, marginBottom: Spacing.xxs },
  swapPrice: { ...Typography.h3, marginBottom: Spacing.xs },
  swapShipping: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.sm },
  shippingBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  shippingText: { ...Typography.caption },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  sellerAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sellerName: { ...Typography.caption, fontFamily: "Inter_500Medium" },
  sellerMeta: { ...Typography.caption, fontSize: 10 },
  reportBtn: { padding: Spacing.xs },
  swapTime: { ...Typography.caption, fontSize: 10 },

  productCard: { flex: 1, borderRadius: BorderRadius.md, overflow: "hidden", marginBottom: Spacing.md },
  productImageArea: { height: 100, alignItems: "center", justifyContent: "center", position: "relative" },
  featuredBadge: {
    position: "absolute", top: Spacing.sm, left: Spacing.sm,
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm,
  },
  sponsoredBadge: {
    position: "absolute", top: Spacing.sm, left: Spacing.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm,
  },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  productBody: { padding: Spacing.md },
  categoryTag: { alignSelf: "flex-start", paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xxs, borderRadius: BorderRadius.full, marginBottom: Spacing.xs },
  categoryTagText: { ...Typography.caption },
  productTitle: { ...Typography.h4, fontSize: 14, marginBottom: Spacing.xxs },
  productVendor: { ...Typography.caption, marginBottom: Spacing.xs },
  whyBox: { flexDirection: "row", alignItems: "flex-start", padding: Spacing.sm, borderRadius: BorderRadius.sm, marginBottom: Spacing.sm },
  whyText: { ...Typography.caption, flex: 1, lineHeight: 16 },
  productPrice: { ...Typography.h4, marginBottom: Spacing.sm },
  viewDealBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, gap: Spacing.xs },
  viewDealText: { color: "#FFFFFF", ...Typography.small, fontWeight: "600" },
  noLinkBox: { paddingVertical: Spacing.sm, borderTopWidth: 1, alignItems: "center" },
  noLinkText: { ...Typography.caption },
  productRow: { gap: Spacing.md },

  categoryScroller: { marginBottom: Spacing.md },
  categoryScrollerContent: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  categoryPill: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1 },
  categoryPillText: { ...Typography.caption, fontFamily: "Inter_500Medium" },

  trustBanner: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md, gap: Spacing.sm },
  trustText: { ...Typography.caption, flex: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginBottom: Spacing.md, gap: Spacing.sm },
  searchInput: { flex: 1, ...Typography.body, fontSize: 15 },
  emptySearch: { alignItems: "center", paddingVertical: Spacing.xl * 2, gap: Spacing.md },
  emptySearchText: { ...Typography.body },

  findHeader: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.lg },
  findHeaderTitle: { ...Typography.h4, marginBottom: 2 },
  findHeaderDesc: { ...Typography.caption },
  findLabel: { ...Typography.caption, fontFamily: "Inter_500Medium", marginBottom: Spacing.xs },
  vehicleChips: { gap: Spacing.sm },
  vehicleChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1 },
  vehicleChipText: { ...Typography.caption, fontFamily: "Inter_500Medium" },
  vendorLink: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.sm, gap: Spacing.md },
  vendorIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  vendorName: { ...Typography.h4 },
  vendorDesc: { ...Typography.caption },
  findEmpty: { alignItems: "center", paddingVertical: Spacing.xl * 2, gap: Spacing.md },
  findEmptyText: { ...Typography.body, textAlign: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.6)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg, padding: Spacing.lg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  modalTitle: { ...Typography.h3 },
  modalSub: { ...Typography.body, marginBottom: Spacing.lg },
  modalLabel: { ...Typography.h4, marginBottom: Spacing.md },
  reasonList: { gap: Spacing.sm, marginBottom: Spacing.lg },
  reasonOption: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.md },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
  reasonText: { ...Typography.body },
  submitBtn: { paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: "center" },
  submitBtnText: { ...Typography.h4 },

  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
