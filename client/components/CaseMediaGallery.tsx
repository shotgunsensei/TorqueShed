import React, { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "./ThemedText";
import { resolveMediaUrl } from "./MediaPickerRow";

type Props = {
  photoUrls?: string[] | null;
  videoUrls?: string[] | null;
  testIDPrefix?: string;
  thumbSize?: number;
};

function VideoTile({ uri, size, testID }: { uri: string; size: number; testID?: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
  });
  return (
    <VideoView
      player={player}
      style={{ width: size, height: size, borderRadius: BorderRadius.md }}
      contentFit="cover"
      nativeControls
      testID={testID}
    />
  );
}

function PhotoLightbox({ uri, onClose }: { uri: string; onClose: () => void }) {
  const { theme } = useTheme();
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.lightbox, { backgroundColor: "rgba(0,0,0,0.92)" }]}>
        <Pressable style={styles.lightboxClose} onPress={onClose} testID="button-lightbox-close">
          <Feather name="x" size={28} color="#fff" />
        </Pressable>
        <Pressable style={styles.lightboxBody} onPress={onClose}>
          <Image source={{ uri }} style={styles.lightboxImg} resizeMode="contain" />
        </Pressable>
      </View>
    </Modal>
  );
}

export function CaseMediaGallery({
  photoUrls,
  videoUrls,
  testIDPrefix = "media",
  thumbSize = 110,
}: Props) {
  const { theme } = useTheme();
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);

  const photos = (photoUrls ?? []).filter(Boolean);
  const videos = (videoUrls ?? []).filter(Boolean);

  if (photos.length === 0 && videos.length === 0) return null;

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {photos.map((p, i) => {
          const uri = resolveMediaUrl(p);
          return (
            <Pressable
              key={`p-${i}-${p}`}
              onPress={() => setOpenPhoto(uri)}
              style={[styles.tile, { width: thumbSize, height: thumbSize, borderColor: theme.cardBorder }]}
              testID={`${testIDPrefix}-photo-${i}`}
            >
              <Image source={{ uri }} style={styles.tileImg} />
            </Pressable>
          );
        })}
        {videos.map((v, i) => {
          const uri = resolveMediaUrl(v);
          return (
            <View
              key={`v-${i}-${v}`}
              style={[styles.tile, { width: thumbSize, height: thumbSize, borderColor: theme.cardBorder }]}
            >
              <VideoTile uri={uri} size={thumbSize} testID={`${testIDPrefix}-video-${i}`} />
            </View>
          );
        })}
      </ScrollView>
      {openPhoto ? <PhotoLightbox uri={openPhoto} onClose={() => setOpenPhoto(null)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  tile: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileImg: { width: "100%", height: "100%" },
  lightbox: { flex: 1, justifyContent: "center", alignItems: "center" },
  lightboxBody: { flex: 1, width: "100%", justifyContent: "center", alignItems: "center" },
  lightboxImg: { width: "100%", height: "85%" },
  lightboxClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
});
