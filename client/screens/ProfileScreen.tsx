import React, { useState, useEffect } from "react";
import { View, StyleSheet, Image, Pressable, ActivityIndicator, Alert, Text, ScrollView } from "react-native";
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
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { getUserRoleDisplay } from "@/components/UserAvatar";
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
  solutionCount: number;
  listingCount: number;
  vehicleCount: number;
}

interface RecentActivity {
  id: string;
  type: "thread" | "reply";
  title: string;
  garageId: string | null;
  createdAt: string;
}

interface PublicVehicle {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  nickname: string | null;
}

interface FullProfileData {
  profile: UserProfile;
  stats: UserStats;
  role: string | null;
  recentActivity: RecentActivity[];
  publicVehicles: PublicVehicle[];
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays > 30) return `${Math.floor(diffDays / 30)}mo ago`;
  if (diffDays > 0) return `${diffDays}d ago`;
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours > 0) return `${diffHours}h ago`;
  return "Just now";
}

function StatItem({ value, label, icon, color }: { value: number; label: string; icon: keyof typeof Feather.glyphMap; color: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.statCell}>
      <Feather name={icon} size={14} color={color} style={{ marginBottom: 2 }} />
      <Text style={[styles.statNumber, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { currentUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [vehiclesWorkedOn, setVehiclesWorkedOn] = useState("");
  const [yearsWrenching, setYearsWrenching] = useState("");
  const [shopAffiliation, setShopAffiliation] = useState("");
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<FocusArea[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/users/me/profile"],
  });

  const { data: fullProfile } = useQuery<FullProfileData>({
    queryKey: [`/api/users/${currentUser?.id}/profile`],
    enabled: !!currentUser?.id,
  });

  const stats = fullProfile?.stats;
  const recentActivity = fullProfile?.recentActivity || [];
  const publicVehicles = fullProfile?.publicVehicles || [];
  const userRole = getUserRoleDisplay(fullProfile?.role || currentUser?.role);

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
      queryClient.invalidateQueries({ queryKey: ["/api/users", currentUser?.id, "profile"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Profile updated", "success");
      setHasChanges(false);
      setShowEditForm(false);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.show("Failed to update profile", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/users/me");
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Account deleted", "success");
      logout();
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.show("Failed to delete account", "error");
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
      toast.show("Avatar updated", "success");
    } catch {
      toast.show("Failed to upload avatar", "error");
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

  const isTrustedSolver = (stats?.solutionCount || 0) >= 3;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <Skeleton.List count={4} style={{ paddingTop: headerHeight + Spacing.lg }} />
      </View>
    );
  }

  const vehicleLabel = (v: PublicVehicle) => {
    if (v.nickname) return v.nickname;
    return [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";
  };

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
      <View style={styles.heroSection}>
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

        <View style={styles.heroMeta}>
          {userRole ? (
            <StatusBadge label={userRole} icon="shield" variant="primary" size="md" />
          ) : null}
          {isTrustedSolver ? (
            <StatusBadge label="Trusted Solver" icon="check-circle" variant="success" size="md" />
          ) : null}
        </View>

        <View style={styles.heroDetails}>
          {profile?.location ? (
            <View style={styles.heroDetailRow}>
              <Feather name="map-pin" size={13} color={theme.textMuted} />
              <Text style={[styles.heroDetailText, { color: theme.textSecondary }]}>{profile.location}</Text>
            </View>
          ) : null}
          {joinDate ? (
            <View style={styles.heroDetailRow}>
              <Feather name="calendar" size={13} color={theme.textMuted} />
              <Text style={[styles.heroDetailText, { color: theme.textSecondary }]}>Member since {joinDate}</Text>
            </View>
          ) : null}
          {profile?.yearsWrenching ? (
            <View style={styles.heroDetailRow}>
              <Feather name="clock" size={13} color={theme.textMuted} />
              <Text style={[styles.heroDetailText, { color: theme.textSecondary }]}>
                {profile.yearsWrenching} {profile.yearsWrenching === 1 ? "year" : "years"} wrenching
              </Text>
            </View>
          ) : null}
          {profile?.shopAffiliation ? (
            <View style={styles.heroDetailRow}>
              <Feather name="home" size={13} color={theme.textMuted} />
              <Text style={[styles.heroDetailText, { color: theme.textSecondary }]}>{profile.shopAffiliation}</Text>
            </View>
          ) : null}
        </View>

        {profile?.bio ? (
          <Text style={[styles.bioText, { color: theme.text }]}>{profile.bio}</Text>
        ) : null}

        {selectedFocusAreas.length > 0 ? (
          <View style={styles.focusChipsRow}>
            {selectedFocusAreas.map((area) => (
              <View key={area} style={[styles.focusChipDisplay, { backgroundColor: theme.primary + "15", borderColor: theme.primary + "30" }]}>
                <Text style={[styles.focusChipText, { color: theme.primary }]}>{area}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {stats ? (
        <View style={[styles.statsRow, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
          <StatItem value={stats.vehicleCount} label="Vehicles" icon="truck" color={theme.primary} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatItem value={stats.threadCount} label="Threads" icon="message-circle" color={theme.primary} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatItem value={stats.solutionCount} label="Solutions" icon="check-circle" color={theme.success} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatItem value={stats.replyCount} label="Replies" icon="message-square" color={theme.primary} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatItem value={stats.listingCount} label="Listings" icon="tag" color={theme.primary} />
        </View>
      ) : null}

      {publicVehicles.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="truck" size={16} color={theme.primary} />
            <ThemedText type="h4" style={styles.sectionTitle}>Vehicles</ThemedText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehiclesScroller}>
            {publicVehicles.map((v) => (
              <View key={v.id} style={[styles.vehicleCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
                <Feather name="truck" size={20} color={theme.primary} style={{ marginBottom: Spacing.xs }} />
                <Text style={[styles.vehicleCardTitle, { color: theme.text }]} numberOfLines={1}>{vehicleLabel(v)}</Text>
                {v.nickname ? (
                  <Text style={[styles.vehicleCardSub, { color: theme.textMuted }]} numberOfLines={1}>
                    {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {recentActivity.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="activity" size={16} color={theme.primary} />
            <ThemedText type="h4" style={styles.sectionTitle}>Recent Activity</ThemedText>
          </View>
          {recentActivity.slice(0, 5).map((activity) => (
            <View
              key={`${activity.type}-${activity.id}`}
              style={[styles.activityItem, { borderBottomColor: theme.border }]}
            >
              <View style={[styles.activityIcon, { backgroundColor: activity.type === "thread" ? theme.primary + "15" : theme.success + "15" }]}>
                <Feather
                  name={activity.type === "thread" ? "message-circle" : "corner-down-right"}
                  size={14}
                  color={activity.type === "thread" ? theme.primary : theme.success}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: theme.text }]} numberOfLines={1}>
                  {activity.type === "thread" ? "Started: " : "Replied to: "}
                  {activity.title}
                </Text>
                <Text style={[styles.activityTime, { color: theme.textMuted }]}>{formatTimeAgo(activity.createdAt)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable
        style={[styles.editToggle, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}
        onPress={() => setShowEditForm(!showEditForm)}
        testID="button-toggle-edit"
      >
        <View style={styles.menuItemLeft}>
          <Feather name="edit-2" size={18} color={theme.primary} />
          <Text style={[styles.editToggleText, { color: theme.text }]}>
            {showEditForm ? "Hide Edit Form" : "Edit Profile"}
          </Text>
        </View>
        <Feather name={showEditForm ? "chevron-up" : "chevron-down"} size={20} color={theme.textMuted} />
      </Pressable>

      {showEditForm ? (
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
      ) : null}

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
  heroSection: {
    alignItems: "center",
    marginBottom: Spacing.lg,
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
    marginBottom: 4,
  },
  heroMeta: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  heroDetails: {
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  heroDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  heroDetailText: {
    ...Typography.caption,
  },
  bioText: {
    ...Typography.body,
    textAlign: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  focusChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  focusChipDisplay: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  focusChipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    ...Typography.h4,
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 10,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    flex: 1,
  },
  vehiclesScroller: {
    gap: Spacing.sm,
  },
  vehicleCard: {
    width: 140,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  vehicleCardTitle: {
    ...Typography.caption,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  vehicleCardSub: {
    ...Typography.caption,
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTitle: {
    ...Typography.caption,
    fontFamily: "Inter_500Medium",
  },
  activityTime: {
    fontSize: 10,
    marginTop: 1,
  },
  editToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  editToggleText: {
    ...Typography.body,
    fontFamily: "Inter_500Medium",
    marginLeft: Spacing.md,
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
