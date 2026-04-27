import { Platform, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { apiRequest } from "@/lib/query-client";
import type { Tier } from "@/lib/entitlements";

export type CheckoutResult =
  | { kind: "opened"; url: string }
  | { kind: "missing_config"; message: string }
  | { kind: "error"; message: string };

export async function startCheckout(tier: Exclude<Tier, "free">): Promise<CheckoutResult> {
  try {
    const res = await apiRequest("POST", "/api/billing/create-checkout-session", { tier });
    const data = await res.json();
    if (!data?.url) {
      return { kind: "error", message: "Stripe did not return a checkout URL." };
    }
    await openExternal(data.url);
    return { kind: "opened", url: data.url };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start checkout";
    if (/missingConfig|not configured|503/.test(message)) {
      return { kind: "missing_config", message };
    }
    return { kind: "error", message };
  }
}

export async function openBillingPortal(): Promise<CheckoutResult> {
  try {
    const res = await apiRequest("POST", "/api/billing/create-portal-session", {});
    const data = await res.json();
    if (!data?.url) return { kind: "error", message: "Stripe did not return a portal URL." };
    await openExternal(data.url);
    return { kind: "opened", url: data.url };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to open billing portal";
    return { kind: "error", message };
  }
}

async function openExternal(url: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.location.assign(url);
      return;
    }
  }
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  } catch {
    await Linking.openURL(url);
  }
}
