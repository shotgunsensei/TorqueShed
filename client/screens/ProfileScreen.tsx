import React, { useState } from "react";
import { View, StyleSheet, Image, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const [handle, setHandle] = useState("gearhead_user");
  const [bio, setBio] = useState("Car enthusiast | DIY mechanic");
  const [location, setLocation] = useState("Denver, CO");
  const [specialties, setSpecialties] = useState("Ford trucks, suspension");

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
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
      </View>

      <View
        style={[
          styles.statsRow,
          { borderColor: theme.border },
        ]}
      >
        <View style={styles.statItem}>
          <ThemedText type="h3">42</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Reputation
          </ThemedText>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statItem}>
          <ThemedText type="h3">2</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Vehicles
          </ThemedText>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statItem}>
          <ThemedText type="h3">15</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Posts
          </ThemedText>
        </View>
      </View>

      <View style={styles.formSection}>
        <Input
          label="Handle"
          placeholder="Your username"
          value={handle}
          onChangeText={setHandle}
          leftIcon="at-sign"
        />

        <Input
          label="Bio"
          placeholder="Tell us about yourself"
          value={bio}
          onChangeText={setBio}
          leftIcon="user"
          multiline
        />

        <Input
          label="Location"
          placeholder="City, State"
          value={location}
          onChangeText={setLocation}
          leftIcon="map-pin"
        />

        <Input
          label="Specialties"
          placeholder="What are you good at?"
          value={specialties}
          onChangeText={setSpecialties}
          leftIcon="award"
        />

        <Button onPress={handleSave}>Save Profile</Button>
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
          onPress={() => {}}
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
          onPress={() => {}}
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
          onPress={() => {}}
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
          onPress={() => {}}
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
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    bottom: 0,
    right: "35%",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.xl,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  statItem: {
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: "100%",
  },
  formSection: {
    marginBottom: Spacing.xl,
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
});
