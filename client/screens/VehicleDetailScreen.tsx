import React from "react";
import { View, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { NoteCard } from "@/components/NoteCard";
import { EmptyState } from "@/components/EmptyState";
import { FAB } from "@/components/FAB";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { type VehicleNote } from "@/constants/vehicles";
import { emptyStates } from "@/constants/brand";
import type { NotesStackParamList } from "@/navigation/NotesStackNavigator";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

interface ApiNote {
  id: string;
  vehicleId: string;
  title: string;
  content: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

function transformToNote(apiNote: ApiNote): VehicleNote {
  return {
    id: apiNote.id,
    vehicleId: apiNote.vehicleId,
    title: apiNote.title,
    content: apiNote.content,
    createdAt: new Date(apiNote.createdAt),
    isPrivate: apiNote.isPrivate,
  };
}

type RoutePropType = RouteProp<NotesStackParamList, "VehicleDetail">;
type NavigationProp = NativeStackNavigationProp<NotesStackParamList & RootStackParamList>;

export default function VehicleDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  const { vehicleId, vehicleName } = route.params;

  const { data: apiNotes = [], isLoading } = useQuery<ApiNote[]>({
    queryKey: [`/api/vehicles/${vehicleId}/notes`],
  });

  const notes = apiNotes.map(transformToNote);

  const handleAddNote = () => {
    navigation.navigate("AddNote", { vehicleId });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View
        style={[
          styles.vehicleImage,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <Feather name="truck" size={48} color={theme.textSecondary} />
      </View>

      <View
        style={[
          styles.infoCard,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <ThemedText type="h2">{vehicleName}</ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          Vehicle ID: {vehicleId}
        </ThemedText>
      </View>

      <ThemedText type="h3" style={styles.sectionTitle}>
        Maintenance Notes
      </ThemedText>
    </View>
  );

  const renderNote = ({ item }: { item: VehicleNote }) => (
    <NoteCard note={item} onPress={() => {}} />
  );

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
        image={require("../../assets/images/empty-threads.png")}
        title={emptyStates.notes.title}
        description={emptyStates.notes.message}
        actionLabel={emptyStates.notes.action}
        onAction={handleAddNote}
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
            paddingBottom: insets.bottom + Spacing.xl + 80,
          },
          notes.length === 0 ? styles.emptyContainer : null,
        ]}
        data={notes}
        renderItem={renderNote}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
      {notes.length > 0 ? (
        <FAB icon="plus" onPress={handleAddNote} bottom={insets.bottom + 20} />
      ) : null}
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
  },
  header: {
    marginBottom: Spacing.lg,
  },
  vehicleImage: {
    height: 180,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
});
