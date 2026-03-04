import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { PART_VENDORS, MAKES, YEARS } from "@/constants/products";

interface PartResult {
  id: string;
  name: string;
  fitment: string;
  vendors: { name: string; url: string; price: string }[];
}

export default function PartsFinderScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const [inputMode, setInputMode] = useState(0);
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [partQuery, setPartQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<PartResult[]>([]);

  const handleSearch = async () => {
    if (!partQuery.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSearching(true);

    const fitment = inputMode === 0 && vin 
      ? `VIN: ...${vin.slice(-6)}`
      : `${year} ${make} ${model}`;

    const searchTerm = encodeURIComponent(partQuery.trim());
    const vehicleInfo = encodeURIComponent(fitment);

    const vendorLinks: PartResult = {
      id: "1",
      name: partQuery.trim(),
      fitment: fitment,
      vendors: PART_VENDORS
        .filter(v => v.id !== "ebay")
        .map((vendor) => {
          let url = "";
          switch (vendor.id) {
            case "rockauto":
              url = `https://www.rockauto.com/en/catalog/?a=${searchTerm}`;
              break;
            case "autozone":
              url = `https://www.autozone.com/searchresult?searchText=${searchTerm}`;
              break;
            case "oreilly":
              url = `https://www.oreillyauto.com/shop/b?q=${searchTerm}`;
              break;
            case "amazon":
              url = `https://www.amazon.com/s?k=${searchTerm}+${vehicleInfo}`;
              break;
            default:
              url = `https://www.google.com/search?q=${searchTerm}+${vehicleInfo}`;
          }
          return { name: vendor.name, url, price: "Search" };
        }),
    };

    setResults([vendorLinks]);
    setIsSearching(false);
  };

  const handleVendorPress = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url);
  };

  const isSearchDisabled =
    !partQuery.trim() ||
    (inputMode === 0 && !vin.trim()) ||
    (inputMode === 1 && (!year || !make || !model));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Find Your Part
        </ThemedText>

        <SegmentedControl
          segments={["VIN Lookup", "Year/Make/Model"]}
          selectedIndex={inputMode}
          onIndexChange={setInputMode}
        />
      </View>

      <View style={styles.section}>
        {inputMode === 0 ? (
          <Input
            label="Vehicle Identification Number"
            placeholder="Enter 17-character VIN"
            value={vin}
            onChangeText={setVin}
            leftIcon="hash"
            autoCapitalize="characters"
            maxLength={17}
          />
        ) : (
          <>
            <Input
              label="Year"
              placeholder="Select year"
              value={year}
              onChangeText={setYear}
              leftIcon="calendar"
            />
            <Input
              label="Make"
              placeholder="Select make"
              value={make}
              onChangeText={setMake}
              leftIcon="truck"
            />
            <Input
              label="Model"
              placeholder="Enter model"
              value={model}
              onChangeText={setModel}
              leftIcon="tag"
            />
          </>
        )}

        <Input
          label="What part are you looking for?"
          placeholder="e.g., front left wheel bearing"
          value={partQuery}
          onChangeText={setPartQuery}
          leftIcon="search"
        />

        <Button
          onPress={handleSearch}
          disabled={isSearchDisabled || isSearching}
        >
          {isSearching ? "Searching..." : "Find Parts"}
        </Button>
      </View>

      {results.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Results
          </ThemedText>

          {results.map((result) => (
            <View
              key={result.id}
              style={[
                styles.resultCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View style={styles.resultHeader}>
                <Feather name="check-circle" size={20} color={theme.success} />
                <View style={styles.resultInfo}>
                  <ThemedText type="h4">{result.name}</ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    {result.fitment}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.vendorList}>
                {result.vendors.map((vendor) => (
                  <Pressable
                    key={vendor.name}
                    style={[
                      styles.vendorCard,
                      { backgroundColor: theme.backgroundSecondary },
                    ]}
                    onPress={() => handleVendorPress(vendor.url)}
                  >
                    <View>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {vendor.name}
                      </ThemedText>
                      <ThemedText type="h4" style={{ color: theme.primary }}>
                        {vendor.price}
                      </ThemedText>
                    </View>
                    <Feather
                      name="external-link"
                      size={18}
                      color={theme.textSecondary}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  resultCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  resultInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  vendorList: {
    gap: Spacing.sm,
  },
  vendorCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
});
