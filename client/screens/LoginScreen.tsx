import React, { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import logoImage from "../../assets/logo.png";
import * as Haptics from "expo-haptics";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

interface LoginScreenProps {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Login">;
}

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { login } = useAuth();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("Please enter username and password");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await login(username.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top + Spacing["2xl"],
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={styles.header}>
        <Image source={logoImage} style={styles.logoImage} resizeMode="contain" />
        <ThemedText type="h1" style={styles.title}>TorqueShed</ThemedText>
        <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
          The Garage for Real People
        </ThemedText>
      </View>

      <View style={styles.form}>
        {error ? (
          <View style={[styles.errorContainer, { backgroundColor: theme.error + "20" }]}>
            <ThemedText type="caption" style={{ color: theme.error }}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        <Input
          label="Username"
          placeholder="Enter your username"
          value={username}
          onChangeText={setUsername}
          leftIcon="user"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Input
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          leftIcon="lock"
          secureTextEntry
        />

        <Button onPress={handleLogin} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            "Log In"
          )}
        </Button>
      </View>

      <View style={styles.footer}>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          Don't have an account?
        </ThemedText>
        <Pressable onPress={() => navigation.navigate("Signup")}>
          <ThemedText type="body" style={[styles.link, { color: theme.primary }]}>
            Sign Up
          </ThemedText>
        </Pressable>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: "center",
  },
  form: {
    marginBottom: Spacing.xl,
  },
  errorContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
  },
  link: {
    fontWeight: "600",
  },
});
