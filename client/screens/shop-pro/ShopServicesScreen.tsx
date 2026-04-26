import React, { useState } from "react";
import { View, StyleSheet, FlatList, Pressable, Alert, Modal } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { LockedFeature } from "@/components/LockedFeature";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { useEntitlements } from "@/lib/entitlements";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "diagnostic", label: "Diagnostics" },
  { value: "maintenance", label: "Maintenance" },
  { value: "repair", label: "Repair" },
  { value: "performance", label: "Performance" },
  { value: "fabrication", label: "Fabrication" },
  { value: "inspection", label: "Inspection" },
  { value: "other", label: "Other" },
];

interface ShopService {
  id: string;
  name: string;
  category: string;
  description: string | null;
  startingPrice: string | null;
  eta: string | null;
  isActive: boolean;
}

export default function ShopServicesScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasFeature } = useEntitlements();
  const canUse = hasFeature("service_listings");

  const { data, isLoading } = useQuery<ShopService[]>({
    queryKey: ["/api/shop-services"],
    enabled: canUse,
  });

  const [editing, setEditing] = useState<ShopService | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("repair");
  const [description, setDescription] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [eta, setEta] = useState("");
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setCategory("repair");
    setDescription("");
    setStartingPrice("");
    setEta("");
    setIsActive(true);
  };

  const openEditor = (svc: ShopService | null) => {
    if (svc) {
      setEditing(svc);
      setName(svc.name);
      setCategory(svc.category);
      setDescription(svc.description ?? "");
      setStartingPrice(svc.startingPrice ?? "");
      setEta(svc.eta ?? "");
      setIsActive(svc.isActive);
    } else {
      resetForm();
    }
    setShowForm(true);
  };

  const closeEditor = () => {
    setShowForm(false);
    resetForm();
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        category,
        description: description.trim() || null,
        startingPrice: startingPrice.trim() || null,
        eta: eta.trim() || null,
        isActive,
      };
      if (!payload.name) throw new Error("Name is required");
      if (editing) {
        const res = await apiRequest("PATCH", `/api/shop-services/${editing.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/shop-services", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-services"] });
      toast.show(editing ? "Service updated" : "Service added", "success");
      closeEditor();
    },
    onError: (err: Error) => toast.show(err.message || "Failed to save", "error"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/shop-services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop-services"] });
      toast.show("Service deleted", "success");
    },
    onError: (err: Error) => toast.show(err.message || "Failed to delete", "error"),
  });

  const confirmDelete = (svc: ShopService) => {
    Alert.alert("Delete service?", `Remove "${svc.name}" from your shop page?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => del.mutate(svc.id) },
    ]);
  };

  if (!canUse) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.backgroundRoot, paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg }}>
        <LockedFeature
          feature="service_listings"
          title="Service listings"
          description="List the services your shop offers with pricing and ETA on your public page."
          onUpgrade={() => navigation.navigate("Subscription")}
        />
      </View>
    );
  }

  const renderItem = ({ item }: { item: ShopService }) => (
    <Card elevation={2} style={styles.row}>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <ThemedText type="h4" numberOfLines={1} style={{ flex: 1 }}>{item.name}</ThemedText>
          {item.startingPrice ? (
            <ThemedText type="body" style={{ color: theme.primary, fontWeight: "700" }}>{item.startingPrice}</ThemedText>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <View style={[styles.chip, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="caption" style={{ color: theme.textMuted }}>{labelFor(item.category)}</ThemedText>
          </View>
          {item.eta ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>{item.eta}</ThemedText>
          ) : null}
          {!item.isActive ? (
            <View style={[styles.chip, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText type="caption" style={{ color: theme.textMuted }}>Hidden</ThemedText>
            </View>
          ) : null}
        </View>
        {item.description ? (
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 6 }} numberOfLines={3}>{item.description}</ThemedText>
        ) : null}
        <View style={styles.actions}>
          <Pressable onPress={() => openEditor(item)} style={[styles.action, { borderColor: theme.cardBorder }]} testID={`button-edit-service-${item.id}`}>
            <Feather name="edit-2" size={14} color={theme.text} />
            <ThemedText type="small" style={{ marginLeft: 4 }}>Edit</ThemedText>
          </Pressable>
          <Pressable onPress={() => confirmDelete(item)} style={[styles.action, { borderColor: theme.cardBorder }]} testID={`button-delete-service-${item.id}`}>
            <Feather name="trash-2" size={14} color={theme.error} />
            <ThemedText type="small" style={{ marginLeft: 4, color: theme.error }}>Delete</ThemedText>
          </Pressable>
        </View>
      </View>
    </Card>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <FlatList
        data={data ?? []}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + Spacing["2xl"] + 80 }}
        ListHeaderComponent={
          <View style={{ marginBottom: Spacing.md }}>
            <ThemedText type="h2">Services</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.xxs }}>Shown publicly on your shop page.</ThemedText>
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState icon="list" title="No services yet" description="Add your first service so customers know what you offer." actionLabel="Add service" onAction={() => openEditor(null)} />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />
      <Pressable
        onPress={() => openEditor(null)}
        style={[styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + Spacing.lg }]}
        testID="button-add-service"
      >
        <Feather name="plus" size={22} color="#0D0F12" />
      </Pressable>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeEditor}>
        <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
          <View style={[styles.modalHeader, { borderColor: theme.cardBorder }]}>
            <Pressable onPress={closeEditor} testID="button-cancel-service-form"><ThemedText type="body" style={{ color: theme.textMuted }}>Cancel</ThemedText></Pressable>
            <ThemedText type="h4">{editing ? "Edit service" : "New service"}</ThemedText>
            <Pressable onPress={() => save.mutate()} disabled={save.isPending} testID="button-save-service">
              <ThemedText type="body" style={{ color: theme.primary, fontWeight: "700" }}>{save.isPending ? "Saving…" : "Save"}</ThemedText>
            </Pressable>
          </View>
          <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: Spacing.lg }}>
            <Field label="Name"><Input value={name} onChangeText={setName} placeholder="Brake fluid flush" testID="input-service-name" /></Field>
            <Field label="Category">
              <View style={styles.catRow}>
                {CATEGORIES.map((c) => {
                  const active = category === c.value;
                  return (
                    <Pressable
                      key={c.value}
                      onPress={() => setCategory(c.value)}
                      style={[styles.catChip, { borderColor: active ? theme.primary : theme.cardBorder, backgroundColor: active ? theme.primary + "20" : theme.backgroundSecondary }]}
                      testID={`chip-category-${c.value}`}
                    >
                      <ThemedText type="caption" style={{ color: active ? theme.primary : theme.textSecondary, fontWeight: active ? "700" : "500" }}>{c.label}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </Field>
            <Field label="Starting price (optional)"><Input value={startingPrice} onChangeText={setStartingPrice} placeholder="$129" testID="input-service-price" /></Field>
            <Field label="Estimated turnaround"><Input value={eta} onChangeText={setEta} placeholder="2-3 hours" testID="input-service-eta" /></Field>
            <Field label="Description"><Input value={description} onChangeText={setDescription} placeholder="What's included…" multiline numberOfLines={4} style={{ minHeight: 90 }} testID="input-service-description" /></Field>
            <Pressable onPress={() => setIsActive((v) => !v)} style={[styles.toggleRow, { borderColor: theme.cardBorder }]} testID="toggle-service-active">
              <View style={[styles.toggleBox, { borderColor: theme.cardBorder, backgroundColor: isActive ? theme.primary : "transparent" }]}>
                {isActive ? <Feather name="check" size={14} color="#0D0F12" /> : null}
              </View>
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>Show on public shop page</ThemedText>
            </Pressable>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{label}</ThemedText>
      {children}
    </View>
  );
}

function labelFor(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", padding: Spacing.md, borderRadius: BorderRadius.lg },
  rowTop: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: Spacing.sm, marginTop: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  actions: { flexDirection: "row", marginTop: Spacing.sm, gap: Spacing.sm },
  action: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  fab: { position: "absolute", right: Spacing.lg, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.lg, borderBottomWidth: 1 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  toggleRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.sm },
  toggleBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
