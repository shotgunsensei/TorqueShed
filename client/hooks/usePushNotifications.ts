import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { apiRequest } from "@/lib/query-client";

async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;

  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted" && existing.canAskAgain) {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return null;

    const token = await Notifications.getExpoPushTokenAsync();
    return token.data ?? null;
  } catch (err) {
    console.warn("[push] failed to obtain token:", err);
    return null;
  }
}

export function usePushNotifications(isAuthenticated: boolean): void {
  const registered = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || registered.current) return;
    registered.current = true;

    (async () => {
      const token = await getExpoPushToken();
      if (!token) return;
      try {
        await apiRequest("PATCH", "/api/users/me/notifications", {
          expoPushToken: token,
        });
      } catch (err) {
        console.warn("[push] failed to register token with server:", err);
        registered.current = false;
      }
    })();
  }, [isAuthenticated]);
}
