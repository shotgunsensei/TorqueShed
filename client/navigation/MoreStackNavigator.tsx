import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

import MoreScreen from "@/screens/MoreScreen";
import PartsScreen from "@/screens/PartsScreen";
import TrendingScreen from "@/screens/TrendingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import { screenTitles } from "@/constants/brand";
import { Spacing } from "@/constants/theme";

export type MoreStackParamList = {
  MoreMenu: undefined;
  TorqueAssist: undefined;
  ToolAndGear: undefined;
};

const Stack = createNativeStackNavigator<MoreStackParamList>();

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

export default function MoreStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="MoreMenu"
        component={MoreScreen}
        options={{ headerTitle: "More" }}
      />
      <Stack.Screen
        name="TorqueAssist"
        component={SafePartsScreen}
        options={{ headerTitle: screenTitles.torqueAssist }}
      />
      <Stack.Screen
        name="ToolAndGear"
        component={TrendingScreen}
        options={{ headerTitle: screenTitles.toolGear }}
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
