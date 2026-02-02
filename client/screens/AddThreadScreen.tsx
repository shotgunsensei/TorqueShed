import React, { useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
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
import { Spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type RoutePropType = RouteProp<RootStackParamList, "AddThread">;

export default function AddThreadScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RoutePropType>();
  const queryClient = useQueryClient();
  const { garageId } = route.params;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/garages/${garageId}/threads`, {
        title: title.trim(),
        content: content.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/garages/${garageId}/threads`] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to create thread");
    },
  });

  const handleSubmit = () => {
    createThreadMutation.mutate();
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
        New Thread
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
        Start a discussion with the community
      </ThemedText>

      <View style={styles.section}>
        <Input
          label="Title"
          placeholder="e.g., Best oil filter for 5.0 Coyote?"
          value={title}
          onChangeText={setTitle}
          leftIcon="message-circle"
        />

        <Input
          label="Details"
          placeholder="Describe your question or topic..."
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={6}
          style={styles.contentInput}
        />
      </View>

      <Button onPress={handleSubmit} disabled={!isValid || createThreadMutation.isPending}>
        {createThreadMutation.isPending ? "Posting..." : "Post Thread"}
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
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  contentInput: {
    minHeight: 120,
    textAlignVertical: "top",
  },
});
