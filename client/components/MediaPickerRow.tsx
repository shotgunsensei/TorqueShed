import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useToast } from "./Toast";

const MAX_PHOTOS = 6;
const MAX_VIDEOS = 2;
const MAX_VIDEO_SECONDS = 30;

export type MediaPickerRowProps = {
  photoPaths: string[];
  videoPaths: string[];
  onChangePhotos: (paths: string[]) => void;
  onChangeVideos: (paths: string[]) => void;
  disabled?: boolean;
  testIDPrefix?: string;
};

type UploadKind = "image" | "video";

async function getPresignedUrl(kind: UploadKind): Promise<{ uploadUrl: string; objectPath: string }> {
  const res = await apiRequest("POST", "/api/objects/upload", { kind });
  return await res.json();
}

async function uploadToSignedUrl(uploadUrl: string, uri: string, contentType: string) {
  const fileResp = await fetch(uri);
  const blob = await fileResp.blob();
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    throw new Error(`Upload failed: ${putRes.status} ${text}`);
  }
}

export function resolveMediaUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//.test(path)) return path;
  const base = getApiUrl();
  const clean = path.startsWith("/") ? path : `/${path}`;
  return new URL(clean, base).href;
}

export function MediaPickerRow({
  photoPaths,
  videoPaths,
  onChangePhotos,
  onChangeVideos,
  disabled,
  testIDPrefix = "media",
}: MediaPickerRowProps) {
  const { theme } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const ensurePermission = async (): Promise<boolean> => {
    const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status === "granted") return true;
    if (!canAskAgain) {
      toast.show("Enable photo access in Settings to attach media.", "error");
    } else {
      toast.show("Photo permission is required.", "error");
    }
    return false;
  };

  const handleAddPhoto = async () => {
    if (disabled || busy) return;
    if (photoPaths.length >= MAX_PHOTOS) {
      toast.show(`Up to ${MAX_PHOTOS} photos.`, "info");
      return;
    }
    const ok = await ensurePermission();
    if (!ok) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    try {
      setBusy(true);
      Haptics.selectionAsync();
      const asset = result.assets[0];
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );
      const { uploadUrl, objectPath } = await getPresignedUrl("image");
      await uploadToSignedUrl(uploadUrl, manipulated.uri, "image/jpeg");
      onChangePhotos([...photoPaths, objectPath]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Photo upload error:", err);
      toast.show("Couldn't upload photo. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleAddVideo = async () => {
    if (disabled || busy) return;
    if (videoPaths.length >= MAX_VIDEOS) {
      toast.show(`Up to ${MAX_VIDEOS} videos.`, "info");
      return;
    }
    const ok = await ensurePermission();
    if (!ok) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsMultipleSelection: false,
      videoMaxDuration: MAX_VIDEO_SECONDS,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (asset.duration && asset.duration / 1000 > MAX_VIDEO_SECONDS + 0.5) {
      toast.show(`Videos must be ${MAX_VIDEO_SECONDS}s or shorter.`, "error");
      return;
    }

    try {
      setBusy(true);
      Haptics.selectionAsync();
      const contentType = asset.mimeType || "video/mp4";
      const { uploadUrl, objectPath } = await getPresignedUrl("video");
      await uploadToSignedUrl(uploadUrl, asset.uri, contentType);
      onChangeVideos([...videoPaths, objectPath]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Video upload error:", err);
      toast.show("Couldn't upload video. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = (idx: number) => {
    onChangePhotos(photoPaths.filter((_, i) => i !== idx));
  };
  const removeVideo = (idx: number) => {
    onChangeVideos(videoPaths.filter((_, i) => i !== idx));
  };

  const showRow = photoPaths.length > 0 || videoPaths.length > 0 || busy;

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Pressable
          onPress={handleAddPhoto}
          disabled={disabled || busy}
          style={[styles.actionBtn, { borderColor: theme.cardBorder, opacity: disabled || busy ? 0.6 : 1 }]}
          testID={`${testIDPrefix}-add-photo`}
        >
          <Feather name="camera" size={16} color={theme.text} />
          <ThemedText type="caption">Add photo</ThemedText>
        </Pressable>
        <Pressable
          onPress={handleAddVideo}
          disabled={disabled || busy}
          style={[styles.actionBtn, { borderColor: theme.cardBorder, opacity: disabled || busy ? 0.6 : 1 }]}
          testID={`${testIDPrefix}-add-video`}
        >
          <Feather name="video" size={16} color={theme.text} />
          <ThemedText type="caption">Add video (≤30s)</ThemedText>
        </Pressable>
        {busy ? <ActivityIndicator color={theme.primary} /> : null}
      </View>

      {showRow ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
          {photoPaths.map((p, i) => (
            <View key={`p-${i}-${p}`} style={[styles.thumb, { borderColor: theme.cardBorder }]}>
              <Image source={{ uri: resolveMediaUrl(p) }} style={styles.thumbImg} testID={`${testIDPrefix}-photo-${i}`} />
              <Pressable
                onPress={() => removePhoto(i)}
                style={[styles.removeBtn, { backgroundColor: theme.backgroundDefault }]}
                testID={`${testIDPrefix}-remove-photo-${i}`}
              >
                <Feather name="x" size={12} color={theme.text} />
              </Pressable>
            </View>
          ))}
          {videoPaths.map((p, i) => (
            <View key={`v-${i}-${p}`} style={[styles.thumb, styles.videoThumb, { borderColor: theme.cardBorder, backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="film" size={28} color={theme.textMuted} />
              <ThemedText type="caption" style={styles.videoLabel}>Video</ThemedText>
              <Pressable
                onPress={() => removeVideo(i)}
                style={[styles.removeBtn, { backgroundColor: theme.backgroundDefault }]}
                testID={`${testIDPrefix}-remove-video-${i}`}
              >
                <Feather name="x" size={12} color={theme.text} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  actions: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, flexWrap: "wrap" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
  },
  previewRow: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    position: "relative",
  },
  thumbImg: { width: "100%", height: "100%" },
  videoThumb: { alignItems: "center", justifyContent: "center" },
  videoLabel: { marginTop: 2 },
  removeBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
