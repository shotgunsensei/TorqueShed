import React, { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { resolveMediaUrl } from "./MediaPickerRow";
import { PhotoViewerModal } from "./PhotoViewerModal";

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

export function CaseMediaGallery({
  photoUrls,
  videoUrls,
  testIDPrefix = "media",
  thumbSize = 110,
}: Props) {
  const { theme } = useTheme();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const photos = (photoUrls ?? []).filter(Boolean);
  const videos = (videoUrls ?? []).filter(Boolean);

  if (photos.length === 0 && videos.length === 0) return null;

  const photoUris = photos.map((p) => resolveMediaUrl(p)).filter((u): u is string => !!u);

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {photos.map((p, i) => {
          const uri = resolveMediaUrl(p);
          return (
            <Pressable
              key={`p-${i}-${p}`}
              onPress={() => setViewerIndex(i)}
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
      <PhotoViewerModal
        visible={viewerIndex !== null}
        uris={photoUris}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
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
});
