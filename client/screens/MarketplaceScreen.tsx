import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, RefreshControl, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/EmptyState";
import { FAB } from "@/components/FAB";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { SAMPLE_PRODUCTS, type Product } from "@/constants/products";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const [products] = useState<Product[]>(
    SAMPLE_PRODUCTS.filter((p) => p.isApproved)
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleProductPress = (product: Product) => {
    Linking.openURL(product.affiliateUrl);
  };

  const handleSubmitProduct = () => {
    navigation.navigate("SubmitProduct");
  };

  const renderProduct = ({ item, index }: { item: Product; index: number }) => {
    const isOdd = index % 2 === 1;
    return (
      <View style={[styles.cardWrapper, isOdd ? styles.cardRight : null]}>
        <ProductCard product={item} onPress={() => handleProductPress(item)} />
      </View>
    );
  };

  const renderEmpty = () => (
    <EmptyState
      image={require("../../assets/images/empty-marketplace.png")}
      title="No Products Yet"
      description="Check back soon for trending automotive products"
    />
  );

  return (
    <>
      <FlatList
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl + 80,
          },
          products.length === 0 ? styles.emptyContainer : null,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
      <FAB icon="plus" onPress={handleSubmitProduct} bottom={tabBarHeight + 20} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  emptyContainer: {
    flex: 1,
  },
  row: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardWrapper: {
    flex: 1,
  },
  cardRight: {},
});
