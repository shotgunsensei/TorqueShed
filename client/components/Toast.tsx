import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  show: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(1, { duration: 200 });

    opacity.value = withDelay(
      2500,
      withTiming(0, { duration: 300 }, (finished) => {
        if (finished) {
          runOnJS(onDismiss)();
        }
      })
    );
    translateY.value = withDelay(
      2500,
      withTiming(-100, { duration: 300 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const icon: keyof typeof Feather.glyphMap =
    toast.type === "success" ? "check-circle" :
    toast.type === "error" ? "alert-circle" : "info";

  const iconColor =
    toast.type === "success" ? theme.success :
    toast.type === "error" ? theme.error : theme.primary;

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          top: insets.top + Spacing.sm,
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.cardBorder,
        },
        animatedStyle,
      ]}
    >
      <Feather name={icon} size={18} color={iconColor} />
      <ThemedText type="small" style={styles.toastText} numberOfLines={2}>
        {toast.message}
      </ThemedText>
      <Pressable onPress={onDismiss} hitSlop={8}>
        <Feather name="x" size={16} color={theme.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-2), { id, type, message }]);

    if (type === "success") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === "error") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show: showToast }}>
      {children}
      <View style={styles.toastContainer} pointerEvents="box-none">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    minWidth: 280,
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    flex: 1,
  },
});
