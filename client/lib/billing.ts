import { Platform, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { apiRequest } from "@/lib/query-client";
import type { Tier } from "@/lib/entitlements";
import { rememberPendingCheckoutSession } from "@/lib/stripe-return";

export type BillingInterval = "month" | "year";

export type CheckoutResult =
  | { kind: "opened"; url: string; sessionId?: string | null; mode?: string; trialPeriodDays?: number; interval?: BillingInterval }
  | { kind: "missing_config"; message: string }
  | { kind: "error"; message: string };

export async function startCheckout(
  tier: Exclude<Tier, "free">,
  interval: BillingInterval = "month",
): Promise<CheckoutResult> {
  try {
    const res = await apiRequest("POST", "/api/billing/create-checkout-session", { tier, interval });
    const data = await res.json();
    if (!data?.url) {
      return { kind: "error", message: "Stripe did not return a checkout URL." };
    }
    const sessionId: string | null = typeof data?.sessionId === "string" ? data.sessionId : null;
    const mode: string | undefined = typeof data?.mode === "string" ? data.mode : undefined;
    if (mode !== "portal") {
      rememberPendingCheckoutSession(sessionId);
    }
    await openExternal(data.url);
    const trialPeriodDays = typeof data?.trialPeriodDays === "number" ? data.trialPeriodDays : 0;
    const responseInterval: BillingInterval = data?.interval === "year" ? "year" : "month";
    return { kind: "opened", url: data.url, sessionId, mode, trialPeriodDays, interval: responseInterval };
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
