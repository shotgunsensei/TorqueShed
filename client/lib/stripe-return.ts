import { Platform } from "react-native";
import type { QueryClient } from "@tanstack/react-query";

import { apiRequest } from "@/lib/query-client";
import type { Tier } from "@/lib/entitlements";

const PENDING_KEY = "torqueshed_pending_checkout_session";

const TIER_DISPLAY_NAME: Record<Tier, string> = {
  free: "Free",
  diy_pro: "DIY Pro",
  garage_pro: "Garage Pro",
  shop_pro: "Shop Pro",
};

let inFlight = false;
const consumed = new Set<string>();

export interface ConfirmDeps {
  queryClient: QueryClient;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export async function confirmCheckoutSession(
  sessionId: string,
  deps: ConfirmDeps
): Promise<void> {
  if (!sessionId) return;
  if (consumed.has(sessionId)) return;
  if (inFlight) return;
  inFlight = true;
  consumed.add(sessionId);
  try {
    const res = await apiRequest("POST", "/api/subscription/confirm", { sessionId });
    const data = await res.json();
    const newTier: Tier | undefined = data?.tier;
    await deps.queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
    if (data?.pending) {
      deps.showToast(
        typeof data?.message === "string"
          ? data.message
          : "Payment confirmed — your new plan is taking a moment to activate.",
        "info"
      );
      consumed.delete(sessionId); // allow a retry later
    } else if (newTier && newTier !== "free") {
      deps.showToast(`You're now on ${TIER_DISPLAY_NAME[newTier] ?? newTier}`, "success");
    } else if (data?.paymentStatus === "unpaid" || data?.sessionStatus === "open") {
      deps.showToast("Checkout not completed yet — try again or wait for confirmation.", "error");
      consumed.delete(sessionId);
    } else {
      deps.showToast("Subscription updated", "success");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to confirm subscription";
    deps.showToast(message, "error");
    consumed.delete(sessionId);
  } finally {
    inFlight = false;
  }
}

export function rememberPendingCheckoutSession(sessionId: string | null | undefined) {
  if (!sessionId) return;
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PENDING_KEY, sessionId);
  } catch {
    // ignore
  }
}

export function takePendingCheckoutSession(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(PENDING_KEY);
    if (v) window.localStorage.removeItem(PENDING_KEY);
    return v;
  } catch {
    return null;
  }
}

/**
 * Parse a URL (web location.href or a deep link like
 * torqueshed://billing/return?stripe=success&session_id=...) and return the
 * Stripe session_id if it indicates a successful checkout return.
 */
export function extractSessionIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    // URL constructor handles both http(s) and custom schemes in Hermes/JSC.
    const parsed = new URL(url);
    const params = parsed.searchParams;
    const isSuccess =
      params.get("stripe") === "success" || params.get("billing") === "success";
    const sid = params.get("session_id");
    if (isSuccess && sid) return sid;
    // Fallback: match against the raw query string in case URL parser misbehaves.
  } catch {
    // ignore — fall through to manual parsing
  }
  const m = /[?&]session_id=([^&#]+)/.exec(url);
  const isSuccess = /[?&](stripe|billing)=success/.test(url);
  if (isSuccess && m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return null;
}

export function stripStripeParamsFromCurrentUrl() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("stripe") && !params.has("billing") && !params.has("session_id")) {
      return;
    }
    ["stripe", "billing", "session_id", "tier"].forEach((k) => params.delete(k));
    const newSearch = params.toString();
    const newUrl =
      window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
    window.history.replaceState({}, "", newUrl);
  } catch {
    // ignore
  }
}
