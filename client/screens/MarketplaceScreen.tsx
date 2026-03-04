import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, RefreshControl, Linking, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/EmptyState";
import { FAB } from "@/components/FAB";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import type { Product } from "@/constants/products";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ApiProduct {
  id: string;
  title: string;
  description: string | null;
  price: string | null;
  imageUrl: string | null;
  vendor: string | null;
  affiliateLink: string | null;
  category: string;
  isSponsored: boolean | null;
  submissionStatus: string | null;
}

function transformToProduct(p: ApiProduct): Product {
  return {
    id: p.id,
    title: p.title,
    description: p.description || "",
    price: p.price || "",
    imageUrl: p.imageUrl || undefined,
    vendor: p.vendor || "",
    affiliateUrl: p.affiliateLink || "",
    category: p.category,
    isApproved: true,
  };
}

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();

  const { data: apiProducts = [], isLoading } = useQuery<ApiProduct[]>({
    queryKey: ["/api/products"],
  });

  const products = apiProducts.map(transformToProduct);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    queryClient.invalidateQueries({ queryKey: ["/api/products"] }).then(() => {
      setRefreshing(false);
    });
  }, [queryClient]);

  const handleProductPress = (product: Product) => {
    if (product.affiliateUrl) {
      Linking.openURL(product.affiliateUrl);
    }
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

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }
    return (
      <EmptyState
        image={require("../../assets/images/empty-marketplace.png")}
        title="No Products Yet"
        description="Check back soon for trending automotive products"
      />
    );
  };

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
        columnWrapperStyle={products.length > 0 ? styles.row : undefined}
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
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
