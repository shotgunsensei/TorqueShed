import React, { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Alert, ActionSheetIOS, Platform, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import { Spacing, BorderRadius } from "@/constants/theme";
import { uploadFileToStorage, resolveImageUri } from "@/utils/objectStorageExpo";

interface PhotoPickerGridProps {
  values: string[];
  onChange: (next: string[]) => void;
  max?: number;
  label?: string;
  helperText?: string;
  testID?: string;
  disabled?: boolean;
}

export function PhotoPickerGrid({
  values,
  onChange,
  max = 5,
  label,
  helperText,
  testID,
  disabled = false,
}: PhotoPickerGridProps) {
  const { theme } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const atCapacity = values.length >= max;

  const compressAndUpload = async (uri: string): Promise<string | null> => {
    try {
      setBusy(true);
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      const { url } = await uploadFileToStorage(manipulated.uri, "image/jpeg");
      return url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.show(msg, "error");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to attach images.");
      return;
    }
    const remaining = Math.max(1, max - values.length);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
      quality: 0.9,
    });
    if (result.canceled || !result.assets.length) return;
    const next: string[] = [...values];
    for (const asset of result.assets) {
      if (next.length >= max) break;
      const url = await compressAndUpload(asset.uri);
      if (url) {
        next.push(url);
        onChange([...next]);
        Haptics.selectionAsync();
      }
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow camera access to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    const url = await compressAndUpload(result.assets[0].uri);
    if (url) {
      onChange([...values, url]);
      Haptics.selectionAsync();
    }
  };

  const handleAdd = () => {
    if (atCapacity || busy || disabled) return;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Library"],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) takePhoto();
          if (idx === 2) pickFromLibrary();
        },
      );
    } else {
      Alert.alert("Add photo", undefined, [
        { text: "Cancel", style: "cancel" },
        { text: "Take Photo", onPress: takePhoto },
        { text: "Choose from Library", onPress: pickFromLibrary },
      ]);
    }
  };

  const handleRemove = (idx: number) => {
    const next = values.filter((_, i) => i !== idx);
    onChange(next);
    Haptics.selectionAsync();
  };

  return (
    <View style={styles.wrapper} testID={testID}>
      {label ? (
        <ThemedText type="body" style={{ marginBottom: Spacing.xs }}>
          {label} {max > 1 ? <ThemedText type="caption" style={{ color: theme.textMuted }}>({values.length}/{max})</ThemedText> : null}
        </ThemedText>
      ) : null}
      {helperText ? (
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
          {helperText}
        </ThemedText>
      ) : null}
      <View style={styles.row}>
        {values.map((uri, idx) => {
          const resolved = resolveImageUri(uri);
          return (
            <View
              key={`${uri}-${idx}`}
              style={[styles.thumb, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}
              testID={`photo-thumb-${idx}`}
            >
              {resolved ? (
                <Image source={{ uri: resolved }} style={styles.thumbImage} resizeMode="cover" />
              ) : (
                <Feather name="image" size={20} color={theme.textMuted} />
              )}
              {!disabled ? (
                <Pressable
                  style={[styles.removeBtn, { backgroundColor: theme.text }]}
                  onPress={() => handleRemove(idx)}
                  hitSlop={6}
                  testID={`button-remove-photo-${idx}`}
                >
                  <Feather name="x" size={12} color={theme.backgroundRoot} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {!atCapacity && !disabled ? (
          <Pressable
            onPress={handleAdd}
            disabled={busy}
            style={[styles.addBtn, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}
            testID="button-add-photo"
          >
            {busy ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <>
                <Feather name="camera" size={18} color={theme.text} />
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                  Add
                </ThemedText>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const THUMB_SIZE = 80;

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
});
