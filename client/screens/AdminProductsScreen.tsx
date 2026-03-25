import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";

import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { FAB } from "@/components/FAB";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      const stored = localStorage.getItem("supabase.auth.token");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.currentSession?.access_token || null;
      }
      return null;
    }
    const token = await SecureStore.getItemAsync("supabase_access_token");
    return token;
  } catch {
    return null;
  }
}

function getAuthHeaders(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string | null;
  contentType: string;
  contentId: string | null;
  reason: string;
  details: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  reporterName: string;
  reportedUserName: string | null;
}

type AdminTab = "products" | "reports";

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
  views: number;
  clicks: number;
}

const PRODUCT_CATEGORIES = [
  "Performance",
  "Suspension",
  "Exhaust",
  "Lighting",
  "Interior",
  "Exterior",
  "Tools",
  "Safety",
  "Electronics",
  "Maintenance",
];

const SUBMISSION_STATUSES = ["pending", "approved", "featured"] as const;

export default function AdminProductsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("products");
  const [isModalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    whyItMatters: "",
    price: "",
    priceRange: "",
    category: "Performance",
    affiliateLink: "",
    vendor: "",
    isSponsored: false,
    submissionStatus: "pending" as "pending" | "approved" | "featured",
    featuredExpiration: "",
  });

  useEffect(() => {
    getAuthToken().then(setAuthToken);
  }, []);

  const { data: products, isLoading, isError, error: queryError, refetch, isRefetching } = useQuery<Product[]>({
    queryKey: ["/api/admin/products", authToken],
    queryFn: async () => {
      const url = new URL("/api/admin/products", getApiUrl());
      const response = await fetch(url.toString(), {
        headers: getAuthHeaders(authToken),
      });
      if (response.status === 401) throw new Error("Unauthorized - Please sign in");
      if (response.status === 403) throw new Error("Forbidden - Admin access required");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    enabled: !!authToken,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = new URL("/api/admin/products", getApiUrl());
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(authToken),
        },
        body: JSON.stringify({
          ...data,
          featuredExpiration: data.featuredExpiration || null,
        }),
      });
      if (response.status === 401) throw new Error("Unauthorized - Please sign in");
      if (response.status === 403) throw new Error("Forbidden - Admin access required");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create product");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Product created", "success");
      setModalVisible(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to create product", "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const url = new URL(`/api/admin/products/${id}`, getApiUrl());
      const response = await fetch(url.toString(), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(authToken),
        },
        body: JSON.stringify({
          ...data,
          featuredExpiration: data.featuredExpiration || null,
        }),
      });
      if (response.status === 401) throw new Error("Unauthorized - Please sign in");
      if (response.status === 403) throw new Error("Forbidden - Admin access required");
      if (!response.ok) throw new Error("Failed to update product");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Product updated", "success");
      setModalVisible(false);
      setEditingProduct(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to update product", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const url = new URL(`/api/admin/products/${id}`, getApiUrl());
      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: getAuthHeaders(authToken),
      });
      if (response.status === 401) throw new Error("Unauthorized - Please sign in");
      if (response.status === 403) throw new Error("Forbidden - Admin access required");
      if (!response.ok) throw new Error("Failed to delete product");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Product deleted", "success");
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to delete product", "error");
    },
  });

  const { data: reports = [], isLoading: reportsLoading, isError: reportsError, refetch: refetchReports } = useQuery<Report[]>({
    queryKey: ["/api/admin/reports", authToken, "pending"],
    queryFn: async () => {
      const url = new URL("/api/admin/reports?status=pending", getApiUrl());
      const response = await fetch(url.toString(), {
        headers: getAuthHeaders(authToken),
      });
      if (!response.ok) throw new Error("Failed to fetch reports");
      return response.json();
    },
    enabled: !!authToken,
  });

  const resolveReportMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "dismiss" | "remove_content" }) => {
      const url = new URL(`/api/admin/reports/${id}`, getApiUrl());
      const response = await fetch(url.toString(), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(authToken),
        },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error("Failed to update report");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Report updated", "success");
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to update report", "error");
    },
  });

  const handleReportAction = (report: Report, action: "dismiss" | "remove_content") => {
    const actionLabel = action === "dismiss" ? "dismiss this report" : "remove the reported content";
    Alert.alert(
      "Confirm Action",
      `Are you sure you want to ${actionLabel}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action === "dismiss" ? "Dismiss" : "Remove",
          style: action === "remove_content" ? "destructive" : "default",
          onPress: () => resolveReportMutation.mutate({ id: report.id, action }),
        },
      ]
    );
  };

  const formatReportDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays > 0) return `${diffDays}d ago`;
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours > 0) return `${diffHours}h ago`;
    return "Just now";
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      whyItMatters: "",
      price: "",
      priceRange: "",
      category: "Performance",
      affiliateLink: "",
      vendor: "",
      isSponsored: false,
      submissionStatus: "pending",
      featuredExpiration: "",
    });
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      title: product.title,
      description: product.description || "",
      whyItMatters: product.whyItMatters || "",
      price: product.price || "",
      priceRange: product.priceRange || "",
      category: product.category,
      affiliateLink: product.affiliateLink || "",
      vendor: product.vendor || "",
      isSponsored: product.isSponsored,
      submissionStatus: product.submissionStatus || "pending",
      featuredExpiration: product.featuredExpiration || "",
    });
    setModalVisible(true);
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    resetForm();
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      Alert.alert("Error", "Title is required");
      return;
    }
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (product: Product) => {
    Alert.alert(
      "Delete Product",
      `Are you sure you want to delete "${product.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(product.id),
        },
      ]
    );
  };

  const cycleStatus = (product: Product) => {
    const statusOrder: ("pending" | "approved" | "featured")[] = ["pending", "approved", "featured"];
    const currentIndex = statusOrder.indexOf(product.submissionStatus || "pending");
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    updateMutation.mutate({
      id: product.id,
      data: { submissionStatus: nextStatus },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "featured":
        return theme.accent;
      case "approved":
        return theme.success;
      default:
        return theme.textMuted;
    }
  };

  const getStatusIcon = (status: string): "star" | "check-circle" | "clock" => {
    switch (status) {
      case "featured":
        return "star";
      case "approved":
        return "check-circle";
      default:
        return "clock";
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View
      style={[
        styles.productCard,
        { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
      ]}
    >
      <View style={styles.productHeader}>
        <View style={styles.productInfo}>
          <Text style={[styles.productTitle, { color: theme.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: theme.backgroundTertiary }]}>
              <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
                {item.category}
              </Text>
            </View>
            {item.isSponsored ? (
              <View style={[styles.badge, { backgroundColor: theme.accent + "30" }]}>
                <Text style={[styles.badgeText, { color: theme.accent }]}>Sponsored</Text>
              </View>
            ) : null}
            <View
              style={[
                styles.badge,
                { backgroundColor: getStatusColor(item.submissionStatus || "pending") + "30" },
              ]}
            >
              <Feather
                name={getStatusIcon(item.submissionStatus || "pending")}
                size={10}
                color={getStatusColor(item.submissionStatus || "pending")}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.badgeText,
                  { color: getStatusColor(item.submissionStatus || "pending") },
                ]}
              >
                {(item.submissionStatus || "pending").charAt(0).toUpperCase() + (item.submissionStatus || "pending").slice(1)}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={() => cycleStatus(item)}
            style={[styles.actionButton, { backgroundColor: theme.backgroundTertiary }]}
          >
            <Feather
              name={getStatusIcon(item.submissionStatus || "pending")}
              size={16}
              color={getStatusColor(item.submissionStatus || "pending")}
            />
          </Pressable>
          <Pressable
            onPress={() => openEditModal(item)}
            style={[styles.actionButton, { backgroundColor: theme.backgroundTertiary }]}
          >
            <Feather name="edit-2" size={16} color={theme.primary} />
          </Pressable>
          <Pressable
            onPress={() => handleDelete(item)}
            style={[styles.actionButton, { backgroundColor: theme.error + "20" }]}
          >
            <Feather name="trash-2" size={16} color={theme.error} />
          </Pressable>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Feather name="eye" size={12} color={theme.textMuted} />
          <Text style={[styles.metricText, { color: theme.textMuted }]}>
            {item.views || 0} views
          </Text>
        </View>
        <View style={styles.metric}>
          <Feather name="mouse-pointer" size={12} color={theme.textMuted} />
          <Text style={[styles.metricText, { color: theme.textMuted }]}>
            {item.clicks || 0} clicks
          </Text>
        </View>
        {item.views > 0 ? (
          <View style={styles.metric}>
            <Feather name="percent" size={12} color={theme.textMuted} />
            <Text style={[styles.metricText, { color: theme.textMuted }]}>
              {((item.clicks / item.views) * 100).toFixed(1)}% CTR
            </Text>
          </View>
        ) : null}
      </View>

      {item.submissionStatus === "featured" && item.featuredExpiration ? (
        <View style={[styles.expirationRow, { borderTopColor: theme.border }]}>
          <Feather
            name="calendar"
            size={12}
            color={isExpired(item.featuredExpiration) ? theme.error : theme.accent}
          />
          <Text
            style={[
              styles.expirationText,
              { color: isExpired(item.featuredExpiration) ? theme.error : theme.accent },
            ]}
          >
            {isExpired(item.featuredExpiration) ? "Expired: " : "Featured until: "}
            {formatDate(item.featuredExpiration)}
          </Text>
        </View>
      ) : null}

      {item.whyItMatters ? (
        <Text style={[styles.whyItMatters, { color: theme.textMuted }]} numberOfLines={2}>
          {item.whyItMatters}
        </Text>
      ) : null}
      {item.price || item.vendor ? (
        <View style={styles.productMeta}>
          {item.price ? (
            <Text style={[styles.price, { color: theme.primary }]}>{item.price}</Text>
          ) : null}
          {item.vendor ? (
            <Text style={[styles.vendor, { color: theme.textMuted }]}>{item.vendor}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const renderReport = ({ item }: { item: Report }) => (
    <View style={[styles.productCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
      <View style={styles.productHeader}>
        <View style={styles.productInfo}>
          <Text style={[styles.productTitle, { color: theme.text }]} numberOfLines={1}>
            {item.reason}
          </Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: theme.error + "20" }]}>
              <Text style={[styles.badgeText, { color: theme.error }]}>{item.contentType.replace("_", " ")}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.backgroundTertiary }]}>
              <Text style={[styles.badgeText, { color: theme.textSecondary }]}>{formatReportDate(item.createdAt)}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm }}>
        <View style={styles.reportRow}>
          <Feather name="user" size={12} color={theme.textMuted} />
          <Text style={[styles.reportText, { color: theme.textSecondary }]}>
            Reported by: {item.reporterName}
          </Text>
        </View>
        {item.reportedUserName ? (
          <View style={styles.reportRow}>
            <Feather name="alert-circle" size={12} color={theme.textMuted} />
            <Text style={[styles.reportText, { color: theme.textSecondary }]}>
              Against: {item.reportedUserName}
            </Text>
          </View>
        ) : null}
        {item.details ? (
          <Text style={[styles.reportDetails, { color: theme.text }]} numberOfLines={3}>
            {item.details}
          </Text>
        ) : null}
      </View>
      <View style={[styles.reportActions, { borderTopColor: theme.border }]}>
        <Pressable
          onPress={() => handleReportAction(item, "dismiss")}
          style={[styles.reportActionBtn, { backgroundColor: theme.backgroundTertiary }]}
          disabled={resolveReportMutation.isPending}
        >
          <Feather name="x" size={14} color={theme.textSecondary} />
          <Text style={[styles.reportActionText, { color: theme.textSecondary }]}>Dismiss</Text>
        </Pressable>
        <Pressable
          onPress={() => handleReportAction(item, "remove_content")}
          style={[styles.reportActionBtn, { backgroundColor: theme.error + "20" }]}
          disabled={resolveReportMutation.isPending}
        >
          <Feather name="trash-2" size={14} color={theme.error} />
          <Text style={[styles.reportActionText, { color: theme.error }]}>Remove Content</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.tabRow, { paddingTop: headerHeight + Spacing.md }]}>
        <Pressable
          onPress={() => setActiveTab("products")}
          style={[styles.tabButton, activeTab === "products" ? { borderBottomColor: theme.primary, borderBottomWidth: 2 } : null]}
        >
          <Feather name="package" size={16} color={activeTab === "products" ? theme.primary : theme.textMuted} />
          <Text style={[styles.tabButtonText, { color: activeTab === "products" ? theme.primary : theme.textMuted }]}>Products</Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("reports")}
          style={[styles.tabButton, activeTab === "reports" ? { borderBottomColor: theme.primary, borderBottomWidth: 2 } : null]}
        >
          <Feather name="flag" size={16} color={activeTab === "reports" ? theme.primary : theme.textMuted} />
          <Text style={[styles.tabButtonText, { color: activeTab === "reports" ? theme.primary : theme.textMuted }]}>
            Reports{reports.length > 0 ? ` (${reports.length})` : ""}
          </Text>
        </Pressable>
      </View>

      {activeTab === "products" ? (
        <>
          {isLoading ? (
            <Skeleton.List count={4} style={{ paddingTop: Spacing.lg }} />
          ) : isError ? (
            <EmptyState
              icon="alert-circle"
              title="Failed to Load Products"
              description={queryError?.message || "Could not load products. Pull down to retry."}
              actionLabel="Retry"
              onAction={refetch}
              style={{ paddingTop: Spacing.lg }}
            />
          ) : (
            <FlatList
              data={products ?? []}
              keyExtractor={(item) => item.id}
              renderItem={renderProduct}
              contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={refetch}
                  tintColor={theme.primary}
                  colors={[theme.primary]}
                />
              }
              ListEmptyComponent={
                <EmptyState
                  icon="package"
                  title="No Products Yet"
                  description="Add your first product to the Tool and Gear section."
                  actionLabel="Add Product"
                  onAction={openCreateModal}
                />
              }
            />
          )}
          <FAB icon="plus" onPress={openCreateModal} bottom={insets.bottom + 16} />
        </>
      ) : (
        <>
          {reportsLoading ? (
            <Skeleton.List count={4} style={{ paddingTop: Spacing.lg }} />
          ) : reportsError ? (
            <EmptyState
              icon="alert-circle"
              title="Failed to Load Reports"
              description="Could not load reports. Pull down to retry."
              actionLabel="Retry"
              onAction={refetchReports}
              style={{ paddingTop: Spacing.lg }}
            />
          ) : (
            <FlatList
              data={reports}
              keyExtractor={(item) => item.id}
              renderItem={renderReport}
              contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
              refreshControl={
                <RefreshControl
                  refreshing={false}
                  onRefresh={refetchReports}
                  tintColor={theme.primary}
                  colors={[theme.primary]}
                />
              }
              ListEmptyComponent={
                <EmptyState
                  icon="check-circle"
                  title="No Pending Reports"
                  description="All reports have been reviewed."
                />
              }
            />
          )}
        </>
      )}

      <Modal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setModalVisible(false)}>
              <Text style={[styles.modalCancel, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {editingProduct ? "Edit Product" : "Add Product"}
            </Text>
            <Pressable onPress={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              <Text style={[styles.modalSave, { color: theme.primary }]}>
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
          >
            <Text style={[styles.label, { color: theme.text }]}>Title *</Text>
            <TextInput
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Product title"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.label, { color: theme.text }]}>Description</Text>
            <TextInput
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Product description"
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={3}
            />

            <Text style={[styles.label, { color: theme.text }]}>Why It Matters</Text>
            <TextInput
              value={formData.whyItMatters}
              onChangeText={(text) => setFormData({ ...formData, whyItMatters: text })}
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Short explanation of value"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.label, { color: theme.text }]}>Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {PRODUCT_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setFormData({ ...formData, category: cat })}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: formData.category === cat ? theme.primary : theme.backgroundSecondary,
                      borderColor: formData.category === cat ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: formData.category === cat ? "#FFFFFF" : theme.text },
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.label, { color: theme.text }]}>Submission Status</Text>
            <View style={styles.statusRow}>
              {SUBMISSION_STATUSES.map((status) => (
                <Pressable
                  key={status}
                  onPress={() => setFormData({ ...formData, submissionStatus: status })}
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: formData.submissionStatus === status ? getStatusColor(status) : theme.backgroundSecondary,
                      borderColor: formData.submissionStatus === status ? getStatusColor(status) : theme.border,
                    },
                  ]}
                >
                  <Feather
                    name={getStatusIcon(status)}
                    size={14}
                    color={formData.submissionStatus === status ? "#FFFFFF" : getStatusColor(status)}
                  />
                  <Text
                    style={[
                      styles.statusChipText,
                      { color: formData.submissionStatus === status ? "#FFFFFF" : theme.text },
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {formData.submissionStatus === "featured" ? (
              <>
                <Text style={[styles.label, { color: theme.text }]}>Featured Expiration (YYYY-MM-DD)</Text>
                <TextInput
                  value={formData.featuredExpiration}
                  onChangeText={(text) => setFormData({ ...formData, featuredExpiration: text })}
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                  placeholder="2025-12-31"
                  placeholderTextColor={theme.textMuted}
                />
              </>
            ) : null}

            <Text style={[styles.label, { color: theme.text }]}>Price</Text>
            <TextInput
              value={formData.price}
              onChangeText={(text) => setFormData({ ...formData, price: text })}
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="$99.99"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.label, { color: theme.text }]}>Vendor</Text>
            <TextInput
              value={formData.vendor}
              onChangeText={(text) => setFormData({ ...formData, vendor: text })}
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Brand or vendor name"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.label, { color: theme.text }]}>Affiliate Link</Text>
            <TextInput
              value={formData.affiliateLink}
              onChangeText={(text) => setFormData({ ...formData, affiliateLink: text })}
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="https://..."
              placeholderTextColor={theme.textMuted}
              keyboardType="url"
              autoCapitalize="none"
            />

            <Pressable
              onPress={() => setFormData({ ...formData, isSponsored: !formData.isSponsored })}
              style={[styles.toggleRow, { borderColor: theme.border }]}
            >
              <View>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>Sponsored Content</Text>
                <Text style={[styles.toggleHint, { color: theme.textMuted }]}>
                  Shows "Sponsored" badge on the product
                </Text>
              </View>
              <View
                style={[
                  styles.toggle,
                  { backgroundColor: formData.isSponsored ? theme.primary : theme.backgroundTertiary },
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    { transform: [{ translateX: formData.isSponsored ? 18 : 2 }] },
                  ]}
                />
              </View>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginRight: Spacing.md,
  },
  tabButtonText: {
    ...Typography.body,
    fontFamily: "Inter_500Medium",
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: 4,
  },
  reportText: {
    ...Typography.caption,
  },
  reportDetails: {
    ...Typography.body,
    fontSize: 13,
    marginTop: Spacing.xs,
  },
  reportActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  reportActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  reportActionText: {
    ...Typography.caption,
    fontFamily: "Inter_500Medium",
  },
  list: {
    padding: Spacing.lg,
  },
  productCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  productHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  productInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  productTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  metricsRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xxs,
  },
  metricText: {
    ...Typography.caption,
  },
  expirationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  expirationText: {
    ...Typography.caption,
    fontWeight: "500",
  },
  whyItMatters: {
    ...Typography.small,
    marginTop: Spacing.sm,
    fontStyle: "italic",
  },
  productMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  price: {
    ...Typography.body,
    fontWeight: "600",
  },
  vendor: {
    ...Typography.small,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalCancel: {
    ...Typography.body,
  },
  modalTitle: {
    ...Typography.h4,
  },
  modalSave: {
    ...Typography.body,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  label: {
    ...Typography.small,
    fontWeight: "600",
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    ...Typography.body,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  categoryScroll: {
    marginVertical: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  categoryChipText: {
    ...Typography.small,
    fontWeight: "500",
  },
  statusRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  statusChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  statusChipText: {
    ...Typography.small,
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    marginTop: Spacing.lg,
    borderTopWidth: 1,
  },
  toggleLabel: {
    ...Typography.body,
    fontWeight: "500",
  },
  toggleHint: {
    ...Typography.caption,
    marginTop: 2,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
});
