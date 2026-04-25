import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

import PartsScreen from "@/screens/PartsScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { screenTitles } from "@/constants/brand";

export type DiagnoseStackParamList = {
  Diagnose: undefined;
};

const Stack = createNativeStackNavigator<DiagnoseStackParamList>();

function DiagnoseFallback({ error: _error, resetError }: { error: Error; resetError: () => void }) {
  const { theme } = useTheme();

  return (
    <ThemedView style={styles.errorContainer}>
      <Feather name="alert-triangle" size={48} color={theme.error} />
      <ThemedText type="h3" style={styles.errorTitle}>
        TorqueAssist hit a snag
      </ThemedText>
      <ThemedText type="body" style={[styles.errorMessage, { color: theme.textSecondary }]}>
        Diagnostic engine ran into an issue. Try reloading.
      </ThemedText>
      <Button onPress={resetError} style={styles.retryButton}>
        Try Again
      </Button>
    </ThemedView>
  );
}

function SafeDiagnoseScreen() {
  return (
    <ErrorBoundary FallbackComponent={DiagnoseFallback}>
      <PartsScreen />
    </ErrorBoundary>
  );
}

export default function DiagnoseStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Diagnose"
        component={SafeDiagnoseScreen}
        options={{ headerTitle: screenTitles.torqueAssist }}
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
