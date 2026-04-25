import React, { useState } from "react";
import { View, StyleSheet, FlatList, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MoreStackParamList } from "@/navigation/MoreStackNavigator";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { LockedFeature } from "@/components/LockedFeature";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { useEntitlements } from "@/lib/entitlements";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const TOOL_CATEGORIES: { value: string; label: string }[] = [
  { value: "hand_tool", label: "Hand Tool" },
  { value: "power_tool", label: "Power Tool" },
  { value: "diagnostic", label: "Diagnostic" },
  { value: "lifting", label: "Lifting" },
  { value: "specialty", label: "Specialty" },
  { value: "consumable", label: "Consumable" },
  { value: "safety", label: "Safety" },
  { value: "other", label: "Other" },
];

interface Tool {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  notes: string | null;
  purchasePrice: string | null;
  storageLocation: string | null;
}

export default function ToolInventoryScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasFeature } = useEntitlements();

  const canUse = hasFeature("tool_inventory");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [notes, setNotes] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [storageLocation, setStorageLocation] = useState("");

  const { data: tools = [], isLoading } = useQuery<Tool[]>({
    queryKey: ["/api/tools"],
    enabled: canUse,
  });

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setBrand("");
    setCategoryIndex(0);
    setNotes("");
    setPurchasePrice("");
    setStorageLocation("");
    setShowForm(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        brand: brand.trim() || null,
        category: TOOL_CATEGORIES[categoryIndex].value,
        notes: notes.trim() || null,
        purchasePrice: purchasePrice.trim() || null,
        storageLocation: storageLocation.trim() || null,
      };
      if (editingId) {
        return apiRequest("PATCH", `/api/tools/${editingId}`, payload);
      }
      return apiRequest("POST", "/api/tools", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tools"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show(editingId ? "Tool updated" : "Tool added", "success");
      resetForm();
    },
    onError: (e: Error) => toast.show(e.message || "Failed to save tool", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/tools/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tools"] });
      toast.show("Tool removed", "success");
    },
    onError: (e: Error) => toast.show(e.message || "Failed to delete", "error"),
  });

  const handleEdit = (tool: Tool) => {
    setEditingId(tool.id);
    setName(tool.name);
    setBrand(tool.brand ?? "");
    const idx = TOOL_CATEGORIES.findIndex((c) => c.value === tool.category);
    setCategoryIndex(idx >= 0 ? idx : 0);
    setNotes(tool.notes ?? "");
    setPurchasePrice(tool.purchasePrice ?? "");
    setStorageLocation(tool.storageLocation ?? "");
    setShowForm(true);
  };

  const handleDelete = (tool: Tool) => {
    Alert.alert("Delete tool?", `Remove ${tool.name} from your inventory?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(tool.id) },
    ]);
  };

  if (!canUse) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg }]}>
        <ThemedText type="h2" style={{ marginBottom: Spacing.sm }}>Tool Inventory</ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.xl }}>
          Catalog the tools in your shop so you can attach them to cases and track what you own.
        </ThemedText>
        <LockedFeature
          feature="tool_inventory"
          title="Tool Inventory"
          description="Add hand tools, power tools, diagnostic gear, and specialty tools to a searchable list you can reference on every case."
          onUpgrade={() => navigation.navigate("Subscription")}
        />
      </View>
    );
  }

  if (showForm) {
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
        <ThemedText type="h2" style={{ marginBottom: Spacing.lg }}>
          {editingId ? "Edit Tool" : "Add Tool"}
        </ThemedText>
        <View style={{ gap: Spacing.lg }}>
          <Input label="Name" placeholder={'e.g., 1/2" Torque Wrench'} value={name} onChangeText={setName} leftIcon="tool" />
          <Input label="Brand" placeholder="e.g., Snap-on" value={brand} onChangeText={setBrand} leftIcon="award" />

          <View style={{ gap: Spacing.sm }}>
            <ThemedText type="body">Category</ThemedText>
            <View style={styles.chipRow}>
              {TOOL_CATEGORIES.map((c, i) => (
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
                  testID={`tool-category-${c.value}`}
                >
                  <ThemedText type="caption" style={{ color: i === categoryIndex ? "#FFFFFF" : theme.text }}>
                    {c.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <Input label="Storage location" placeholder="e.g., Top drawer, left chest" value={storageLocation} onChangeText={setStorageLocation} leftIcon="map-pin" />
          <Input label="Purchase price" placeholder="e.g., 189.99" value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="decimal-pad" leftIcon="dollar-sign" />
          <Input label="Notes" placeholder="Calibration date, accessories, etc." value={notes} onChangeText={setNotes} multiline numberOfLines={4} style={{ minHeight: 100, textAlignVertical: "top" }} />

          <Button onPress={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : editingId ? "Save Changes" : "Add Tool"}
          </Button>
          <Pressable onPress={resetForm} style={{ alignItems: "center", padding: Spacing.md }}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <Skeleton.List count={4} style={{ paddingTop: headerHeight + Spacing.lg }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={tools}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingHorizontal: Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: Spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md }}>
              <ThemedText type="h2">Tool Inventory</ThemedText>
              <Pressable onPress={() => setShowForm(true)} style={[styles.addBtn, { backgroundColor: theme.primary }]} testID="button-add-tool">
                <Feather name="plus" size={18} color="#0D0F12" />
              </Pressable>
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {tools.length} {tools.length === 1 ? "tool" : "tools"} cataloged
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => {
          const cat = TOOL_CATEGORIES.find((c) => c.value === item.category)?.label ?? item.category;
          return (
            <Card style={{ marginBottom: Spacing.md, padding: Spacing.lg }} testID={`tool-card-${item.id}`}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: Spacing.md }}>
                <View style={[styles.iconCircle, { backgroundColor: theme.primary + "20" }]}>
                  <Feather name="tool" size={20} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="h4">{item.name}</ThemedText>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    <View style={[styles.metaChip, { backgroundColor: theme.backgroundDefault }]}>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>{cat}</ThemedText>
                    </View>
                    {item.brand ? (
                      <View style={[styles.metaChip, { backgroundColor: theme.backgroundDefault }]}>
                        <ThemedText type="caption" style={{ color: theme.textSecondary }}>{item.brand}</ThemedText>
                      </View>
                    ) : null}
                    {item.purchasePrice ? (
                      <View style={[styles.metaChip, { backgroundColor: theme.backgroundDefault }]}>
                        <ThemedText type="caption" style={{ color: theme.primary }}>${item.purchasePrice}</ThemedText>
                      </View>
                    ) : null}
                  </View>
                  {item.storageLocation ? (
                    <ThemedText type="caption" style={{ color: theme.textMuted, marginTop: 6 }}>
                      <Feather name="map-pin" size={10} color={theme.textMuted} /> {item.storageLocation}
                    </ThemedText>
                  ) : null}
                  {item.notes ? (
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }} numberOfLines={2}>
                      {item.notes}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md, justifyContent: "flex-end" }}>
                <Pressable onPress={() => handleEdit(item)} style={[styles.actionBtn, { borderColor: theme.border }]} testID={`button-edit-tool-${item.id}`}>
                  <Feather name="edit-2" size={12} color={theme.textSecondary} />
                  <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>Edit</ThemedText>
                </Pressable>
                <Pressable onPress={() => handleDelete(item)} style={[styles.actionBtn, { borderColor: theme.error }]} testID={`button-delete-tool-${item.id}`}>
                  <Feather name="trash-2" size={12} color={theme.error} />
                  <ThemedText type="caption" style={{ color: theme.error, marginLeft: 4 }}>Delete</ThemedText>
                </Pressable>
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="tool"
            title="No Tools Yet"
            description="Add your first tool to start building your inventory."
            actionLabel="Add Tool"
            onAction={() => setShowForm(true)}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  metaChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
