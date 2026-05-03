import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
  ViewToken,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "./ThemedText";

type Props = {
  visible: boolean;
  uris: string[];
  initialIndex?: number;
  onClose: () => void;
};

const MAX_SCALE = 4;
const MIN_SCALE = 1;

function ZoomablePhoto({
  uri,
  width,
  height,
  onSwipeBlocked,
}: {
  uri: string;
  width: number;
  height: number;
  onSwipeBlocked: (blocked: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const reset = () => {
    "worklet";
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      runOnJS(onSwipeBlocked)(true);
    })
    .onUpdate((e) => {
      const next = Math.min(Math.max(savedScale.value * e.scale, 0.8), MAX_SCALE);
      scale.value = next;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        reset();
        runOnJS(onSwipeBlocked)(false);
      } else {
        savedScale.value = scale.value;
        if (scale.value <= 1.01) {
          runOnJS(onSwipeBlocked)(false);
        }
      }
    });

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onUpdate((e) => {
      if (scale.value <= 1.01) return;
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.01) {
        reset();
        runOnJS(onSwipeBlocked)(false);
      } else {
        scale.value = withTiming(2);
        savedScale.value = 2;
        runOnJS(onSwipeBlocked)(true);
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[{ width, height, justifyContent: "center", alignItems: "center" }]}>
        <Animated.View style={[{ width, height }, animatedStyle]}>
          <Image
            source={{ uri }}
            style={{ width, height }}
            contentFit="contain"
            transition={150}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export function PhotoViewerModal({ visible, uris, initialIndex = 0, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [dims, setDims] = useState<{ width: number; height: number }>(() => {
    const w = Dimensions.get("window");
    return { width: w.width, height: w.height };
  });
  const { width, height } = dims;
  const [index, setIndex] = useState(initialIndex);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const listRef = useRef<FlatList<string>>(null);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setScrollEnabled(true);
      const t = setTimeout(() => {
        try {
          listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
        } catch {
          // ignore if list not ready
        }
      }, 0);
      return () => clearTimeout(t);
    }
  }, [visible, initialIndex]);

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      setDims({ width: window.width, height: window.height });
    });
    return () => sub.remove();
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  if (!uris || uris.length === 0) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: "rgba(0,0,0,0.96)" }]}>
        <FlatList
          ref={listRef}
          data={uris}
          horizontal
          pagingEnabled
          scrollEnabled={scrollEnabled}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(item, i) => `${i}-${item}`}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item }) => (
            <ZoomablePhoto
              uri={item}
              width={width}
              height={height}
              onSwipeBlocked={(blocked) => setScrollEnabled(!blocked)}
            />
          )}
        />

        <Pressable
          onPress={onClose}
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          hitSlop={12}
          testID="button-photo-viewer-close"
        >
          <Feather name="x" size={26} color="#fff" />
        </Pressable>

        {uris.length > 1 ? (
          <View style={[styles.counter, { bottom: insets.bottom + 24 }]} pointerEvents="none">
            <ThemedText type="caption" style={{ color: "#fff" }}>
              {index + 1} / {uris.length}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeBtn: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  counter: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
});

export default PhotoViewerModal;
