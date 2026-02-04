import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import PartsScreen from "@/screens/PartsScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import { screenTitles } from "@/constants/brand";
import { Spacing } from "@/constants/theme";

export type PartsStackParamList = {
  Parts: undefined;
};

const Stack = createNativeStackNavigator<PartsStackParamList>();

function TorqueAssistFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  const { theme } = useTheme();
  
  return (
    <ThemedView style={styles.errorContainer}>
      <Feather name="alert-triangle" size={48} color={theme.error} />
      <ThemedText type="h3" style={styles.errorTitle}>
        TorqueAssist encountered an issue
      </ThemedText>
      <ThemedText type="body" style={[styles.errorMessage, { color: theme.textSecondary }]}>
        Something went wrong loading the diagnostic tool. Please try again.
      </ThemedText>
      <Button onPress={resetError} style={styles.retryButton}>
        Try Again
      </Button>
    </ThemedView>
  );
}

function SafePartsScreen() {
  return (
    <ErrorBoundary FallbackComponent={TorqueAssistFallback}>
      <PartsScreen />
    </ErrorBoundary>
  );
}

export default function PartsStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();
  const navigation = useNavigation();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Parts"
        component={SafePartsScreen}
        options={{
          headerTitle: screenTitles.torqueAssist,
          headerRight: () => (
            <Pressable
              onPress={() => (navigation as any).navigate("Profile")}
              hitSlop={8}
            >
              <Feather name="user" size={22} color={theme.text} />
            </Pressable>
          ),
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  errorTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  errorMessage: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  retryButton: {
    minWidth: 150,
  },
});
