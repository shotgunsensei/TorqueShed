import React, { useState } from "react";
import { View, StyleSheet, Switch, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { Spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type RoutePropType = RouteProp<RootStackParamList, "AddNote">;

export default function AddNoteScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RoutePropType>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { vehicleId } = route.params;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);

  const createNoteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/vehicles/${vehicleId}/notes`, {
        title: title.trim(),
        content: content.trim(),
        isPrivate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}/notes`] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Note saved", "success");
      navigation.goBack();
    },
    onError: (error: Error) => {
      toast.show(error.message || "Failed to save note", "error");
    },
  });

  const handleSave = () => {
    createNoteMutation.mutate();
  };

  const isValid = title.trim() && content.trim();

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
        Add Note
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
        Document maintenance, modifications, or any info about your vehicle
      </ThemedText>

      <View style={styles.section}>
        <Input
          label="Title"
          placeholder="e.g., Oil Change"
          value={title}
          onChangeText={setTitle}
          leftIcon="file-text"
        />

        <Input
          label="Details"
          placeholder="Describe what you did..."
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={6}
          style={styles.contentInput}
        />

        <View style={styles.switchRow}>
          <View>
            <ThemedText type="body">Keep Private</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Only you can see this note
            </ThemedText>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <Button onPress={handleSave} disabled={!isValid || createNoteMutation.isPending}>
        {createNoteMutation.isPending ? "Saving..." : "Save Note"}
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
    marginBottom: Spacing.xl,
  },
  contentInput: {
    height: 120,
    textAlignVertical: "top",
    paddingTop: Spacing.md,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
  },
});
