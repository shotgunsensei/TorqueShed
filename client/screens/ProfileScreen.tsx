import React, { useState, useEffect } from "react";
import { View, StyleSheet, Image, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const FOCUS_AREAS = [
  "Engine",
  "Electrical",
  "Suspension",
  "Diesel",
  "Tuning",
  "Fabrication",
  "Diagnostics",
  "HVAC",
  "Brakes",
  "Drivetrain",
] as const;

type FocusArea = typeof FOCUS_AREAS[number];

interface UserProfile {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  focusAreas: FocusArea[];
  vehiclesWorkedOn: string | null;
  yearsWrenching: number | null;
  shopAffiliation: string | null;
  createdAt: string;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { currentUser, logout } = useAuth();
  const queryClient = useQueryClient();

  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [vehiclesWorkedOn, setVehiclesWorkedOn] = useState("");
  const [yearsWrenching, setYearsWrenching] = useState("");
  const [shopAffiliation, setShopAffiliation] = useState("");
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<FocusArea[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: profile, isLoading, error } = useQuery<UserProfile>({
    queryKey: ["/api/users/me/profile"],
  });

  useEffect(() => {
    if (profile) {
      setBio(profile.bio || "");
      setLocation(profile.location || "");
      setVehiclesWorkedOn(profile.vehiclesWorkedOn || "");
      setYearsWrenching(profile.yearsWrenching?.toString() || "");
      setShopAffiliation(profile.shopAffiliation || "");
      setSelectedFocusAreas(profile.focusAreas || []);
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      return apiRequest("PATCH", "/api/users/me/profile", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/profile"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setHasChanges(false);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/users/me");
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      logout();
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to delete account. Please try again.");
    },
  });

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone. All your vehicles, notes, and messages will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  };

  const handleSave = () => {
    const years = yearsWrenching ? parseInt(yearsWrenching, 10) : null;
    updateMutation.mutate({
      bio: bio || undefined,
      location: location || undefined,
      focusAreas: selectedFocusAreas,
      vehiclesWorkedOn: vehiclesWorkedOn || undefined,
      yearsWrenching: years,
      shopAffiliation: shopAffiliation || undefined,
    } as any);
  };

  const toggleFocusArea = (area: FocusArea) => {
    setHasChanges(true);
    setSelectedFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const handleFieldChange = (setter: (value: string) => void) => (value: string) => {
    setHasChanges(true);
    setter(value);
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
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
      <View style={styles.avatarSection}>
        <View
          style={[
            styles.avatarContainer,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <Image
            source={require("../../assets/images/avatar-default.png")}
            style={styles.avatar}
          />
        </View>
        <Pressable
          style={[styles.editAvatarButton, { backgroundColor: theme.primary }]}
          onPress={() => {}}
        >
          <Feather name="camera" size={16} color="#FFFFFF" />
        </Pressable>
        <ThemedText type="h2" style={styles.username}>
          {currentUser?.username || profile?.username || "TorqueShed User"}
        </ThemedText>
      </View>

      <View style={styles.formSection}>
        <Input
          label="Bio"
          placeholder="Tell us about yourself and your automotive experience"
          value={bio}
          onChangeText={handleFieldChange(setBio)}
          leftIcon="user"
          multiline
          maxLength={500}
        />

        <Input
          label="Location"
          placeholder="City, State"
          value={location}
          onChangeText={handleFieldChange(setLocation)}
          leftIcon="map-pin"
          maxLength={100}
        />

        <View style={styles.fieldGroup}>
          <ThemedText type="caption" style={styles.label}>
            Focus Areas
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            Select areas where you have expertise
          </ThemedText>
          <View style={styles.focusAreasGrid}>
            {FOCUS_AREAS.map((area) => {
              const isSelected = selectedFocusAreas.includes(area);
              return (
                <Pressable
                  key={area}
                  style={[
                    styles.focusAreaChip,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary,
                      borderColor: isSelected ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => toggleFocusArea(area)}
                >
                  <ThemedText
                    type="caption"
                    style={{ color: isSelected ? "#FFFFFF" : theme.text }}
                  >
                    {area}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Input
          label="Vehicles Worked On"
          placeholder="e.g., Ford F-150, Chevy Silverado, Jeep Wrangler..."
          value={vehiclesWorkedOn}
          onChangeText={handleFieldChange(setVehiclesWorkedOn)}
          leftIcon="truck"
          multiline
          maxLength={1000}
        />

        <Input
          label="Years Wrenching"
          placeholder="How many years of experience?"
          value={yearsWrenching}
          onChangeText={handleFieldChange(setYearsWrenching)}
          leftIcon="clock"
          keyboardType="number-pad"
        />

        <Input
          label="Shop Affiliation (Optional)"
          placeholder="Are you affiliated with a shop or brand?"
          value={shopAffiliation}
          onChangeText={handleFieldChange(setShopAffiliation)}
          leftIcon="home"
          maxLength={200}
        />

        <Button
          onPress={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
        >
          {updateMutation.isPending ? "Saving..." : "Save Profile"}
        </Button>
      </View>

      <View style={styles.menuSection}>
        <ThemedText type="h3" style={styles.menuTitle}>
          Settings
        </ThemedText>

        <Pressable
          style={[
            styles.menuItem,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.cardBorder },
          ]}
          onPress={() => {
            Alert.alert(
              "Notifications",
              "Notification settings coming soon. You'll be able to manage push notifications for new replies, swap shop messages, and community updates.",
              [{ text: "OK" }]
            );
          }}
        >
          <View style={styles.menuItemLeft}>
            <Feather name="bell" size={20} color={theme.text} />
            <ThemedText type="body" style={styles.menuItemText}>
              Notifications
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>

        <Pressable
          style={[
            styles.menuItem,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.cardBorder },
          ]}
          onPress={() => {
            Alert.alert(
              "Privacy Settings",
              "Your data is important to us.\n\n- Profile visibility: Public (other users can see your profile)\n- Activity: Only you can see your activity history\n- Messages: Direct messages are private\n\nFull privacy controls coming in a future update.",
              [{ text: "OK" }]
            );
          }}
        >
          <View style={styles.menuItemLeft}>
            <Feather name="shield" size={20} color={theme.text} />
            <ThemedText type="body" style={styles.menuItemText}>
              Privacy
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>

        <Pressable
          style={[
            styles.menuItem,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.cardBorder },
          ]}
          onPress={() => {
            Alert.alert(
              "Help & Support",
              "Need help with TorqueShed?\n\nFAQ & Guides: Check our community forums for tips and tutorials.\n\nContact Us: support@torqueshed.pro\n\nReport a Bug: Use the feedback option in any thread.\n\nVersion: 1.0.0",
              [{ text: "OK" }]
            );
          }}
        >
          <View style={styles.menuItemLeft}>
            <Feather name="help-circle" size={20} color={theme.text} />
            <ThemedText type="body" style={styles.menuItemText}>
              Help & Support
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>

        <Pressable
          style={[
            styles.menuItem,
            styles.logoutItem,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.cardBorder },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            logout();
          }}
        >
          <View style={styles.menuItemLeft}>
            <Feather name="log-out" size={20} color={theme.error} />
            <ThemedText
              type="body"
              style={[styles.menuItemText, { color: theme.error }]}
            >
              Log Out
            </ThemedText>
          </View>
        </Pressable>

        <Pressable
          style={[
            styles.menuItem,
            styles.deleteItem,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.error },
          ]}
          onPress={handleDeleteAccount}
          disabled={deleteMutation.isPending}
        >
          <View style={styles.menuItemLeft}>
            <Feather name="trash-2" size={20} color={theme.error} />
            <ThemedText
              type="body"
              style={[styles.menuItemText, { color: theme.error }]}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Account"}
            </ThemedText>
          </View>
        </Pressable>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
  },
  avatar: {
    width: 100,
    height: 100,
  },
  editAvatarButton: {
    position: "absolute",
    top: 68,
    right: "35%",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  username: {
    marginTop: Spacing.md,
  },
  formSection: {
    marginBottom: Spacing.xl,
  },
  fieldGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.xs,
  },
  focusAreasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  focusAreaChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  menuSection: {},
  menuTitle: {
    marginBottom: Spacing.md,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuItemText: {
    marginLeft: Spacing.md,
  },
  logoutItem: {
    marginTop: Spacing.md,
  },
  deleteItem: {
    marginTop: Spacing.sm,
  },
});
