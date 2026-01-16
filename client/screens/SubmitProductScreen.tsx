import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function SubmitProductScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [vendor, setVendor] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1500));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  const isValid =
    title.trim() &&
    description.trim() &&
    price.trim() &&
    vendor.trim() &&
    url.trim() &&
    category.trim();

  if (isSubmitted) {
    return (
      <View
        style={[
          styles.container,
          styles.successContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <View
          style={[
            styles.successIcon,
            { backgroundColor: theme.success + "20" },
          ]}
        >
          <ThemedText type="display" style={{ color: theme.success }}>
            Submitted
          </ThemedText>
        </View>
        <ThemedText type="h2" style={styles.successTitle}>
          Product Submitted!
        </ThemedText>
        <ThemedText
          type="body"
          style={[styles.successSubtitle, { color: theme.textSecondary }]}
        >
          Your product is pending admin approval. We'll notify you when it goes
          live.
        </ThemedText>
        <Button onPress={() => navigation.goBack()}>Back to Marketplace</Button>
      </View>
    );
  }

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
        Submit Product
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
        Vendors can submit products for review. Approved products will appear in
        the marketplace.
      </ThemedText>

      <View style={styles.section}>
        <Input
          label="Product Name"
          placeholder="e.g., K&N Cold Air Intake"
          value={title}
          onChangeText={setTitle}
          leftIcon="package"
        />

        <Input
          label="Description"
          placeholder="Describe the product..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.descriptionInput}
        />

        <Input
          label="Price"
          placeholder="e.g., $349.99"
          value={price}
          onChangeText={setPrice}
          leftIcon="dollar-sign"
        />

        <Input
          label="Vendor/Brand"
          placeholder="e.g., K&N Engineering"
          value={vendor}
          onChangeText={setVendor}
          leftIcon="briefcase"
        />

        <Input
          label="Product URL"
          placeholder="https://..."
          value={url}
          onChangeText={setUrl}
          leftIcon="link"
          keyboardType="url"
          autoCapitalize="none"
        />

        <Input
          label="Category"
          placeholder="e.g., Performance, Suspension, Exhaust"
          value={category}
          onChangeText={setCategory}
          leftIcon="tag"
        />
      </View>

      <Button onPress={handleSubmit} disabled={!isValid || isSubmitting}>
        {isSubmitting ? "Submitting..." : "Submit for Review"}
      </Button>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  successContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  successTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  successSubtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
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
  descriptionInput: {
    height: 100,
    textAlignVertical: "top",
    paddingTop: Spacing.md,
  },
});
