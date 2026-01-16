import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import { getApiUrl, apiRequest } from "@/lib/query-client";

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
  isApproved: boolean;
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

const ADMIN_USER_ID = "admin-user-001";

export default function AdminProductsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();

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
  });

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
    queryFn: async () => {
      const url = new URL("/api/admin/products", getApiUrl());
      const response = await fetch(url.toString(), {
        headers: { "x-admin-user-id": ADMIN_USER_ID },
      });
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = new URL("/api/admin/products", getApiUrl());
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-user-id": ADMIN_USER_ID,
        },
        body: JSON.stringify(data),
      });
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
      setModalVisible(false);
      resetForm();
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> & { isApproved?: boolean } }) => {
      const url = new URL(`/api/admin/products/${id}`, getApiUrl());
      const response = await fetch(url.toString(), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-user-id": ADMIN_USER_ID,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update product");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
      setEditingProduct(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const url = new URL(`/api/admin/products/${id}`, getApiUrl());
      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: { "x-admin-user-id": ADMIN_USER_ID },
      });
      if (!response.ok) throw new Error("Failed to delete product");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

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

  const toggleApproval = (product: Product) => {
    updateMutation.mutate({
      id: product.id,
      data: { isApproved: !product.isApproved },
    });
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
                { backgroundColor: item.isApproved ? theme.success + "30" : theme.error + "30" },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: item.isApproved ? theme.success : theme.error },
                ]}
              >
                {item.isApproved ? "Approved" : "Hidden"}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={() => toggleApproval(item)}
            style={[styles.actionButton, { backgroundColor: theme.backgroundTertiary }]}
          >
            <Feather
              name={item.isApproved ? "eye-off" : "eye"}
              size={16}
              color={theme.textSecondary}
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

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          contentContainerStyle={[
            styles.list,
            { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 80 },
          ]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="package" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No products yet. Add your first product.
              </Text>
            </View>
          }
        />
      )}

      <Pressable
        onPress={openCreateModal}
        style={[styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + 16 }]}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>

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
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
  },
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
