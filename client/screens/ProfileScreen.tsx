import React, { useState, useEffect } from "react";
import { View, StyleSheet, Image, Pressable, ActivityIndicator, Alert, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
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

interface UserStats {
  threadCount: number;
  replyCount: number;
  listingCount: number;
  vehicleCount: number;
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/users/me/profile"],
  });

  const { data: stats } = useQuery<UserStats>({
    queryKey: ["/api/users/me/stats"],
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

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to upload an avatar.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return;

    try {
      setUploadingAvatar(true);
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 300, height: 300 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      const base64DataUrl = `data:image/jpeg;base64,${manipulated.base64}`;
      await apiRequest("PATCH", "/api/users/me/profile", { avatarUrl: base64DataUrl });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/profile"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to upload avatar. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
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

  const joinDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

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
        <View style={styles.avatarWrapper}>
          <View
            style={[
              styles.avatarContainer,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                <ThemedText type="h2" style={{ color: "#FFFFFF" }}>
                  {(currentUser?.username || "T").charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}
          </View>
          <Pressable
            style={[styles.editAvatarButton, { backgroundColor: theme.primary }]}
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            testID="button-change-avatar"
          >
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="camera" size={16} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
        <ThemedText type="h2" style={styles.username}>
          {currentUser?.username || profile?.username || "TorqueShed User"}
        </ThemedText>
        {joinDate ? (
          <ThemedText type="caption" style={{ color: theme.textMuted, marginTop: 2 }}>
            Wrenching since {joinDate}
          </ThemedText>
        ) : null}
      </View>

      {stats ? (
        <View style={[styles.statsRow, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
          <View style={styles.statCell}>
            <Text style={[styles.statNumber, { color: theme.primary }]}>{stats.vehicleCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Vehicles</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statCell}>
            <Text style={[styles.statNumber, { color: theme.primary }]}>{stats.threadCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Threads</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statCell}>
            <Text style={[styles.statNumber, { color: theme.primary }]}>{stats.replyCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Replies</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statCell}>
            <Text style={[styles.statNumber, { color: theme.primary }]}>{stats.listingCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Listings</Text>
          </View>
        </View>
      ) : null}

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
              "Notification settings coming soon. You will be able to manage push notifications for new replies, swap shop messages, and community updates.",
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
              "Your data is important to us.\n\n- Profile visibility: Public\n- Activity: Only you can see your activity history\n- Messages: Direct messages are private\n\nFull privacy controls coming in a future update.",
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
              "Need help with TorqueShed?\n\nFAQ & Guides: Check our community forums for tips and tutorials.\n\nContact Us: support@torqueshed.pro\n\nVersion: 1.0.0",
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
  avatarWrapper: {
    position: "relative",
    marginBottom: Spacing.md,
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
  avatarPlaceholder: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  username: {
    marginBottom: 2,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    ...Typography.h3,
    fontSize: 22,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
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
