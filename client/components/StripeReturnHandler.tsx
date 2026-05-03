import { useEffect } from "react";
import { Platform, Linking } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  confirmCheckoutSession,
  extractSessionIdFromUrl,
  stripStripeParamsFromCurrentUrl,
  takePendingCheckoutSession,
} from "@/lib/stripe-return";

export function StripeReturnHandler() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    const deps = { queryClient, showToast: toast.show };

    // 1) Web: parse current URL on mount, plus the localStorage fallback set
    //    before redirecting to Stripe.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const fromUrl = extractSessionIdFromUrl(window.location.href);
      const pending = takePendingCheckoutSession();
      const sid = fromUrl ?? pending;
      stripStripeParamsFromCurrentUrl();
      if (sid) {
        void confirmCheckoutSession(sid, deps);
      }
    }

    // 2) Native: handle deep links opened while the app is running and the
    //    initial URL the app was launched with (e.g. torqueshed://billing/
    //    return?stripe=success&session_id=...).
    let cancelled = false;
    void Linking.getInitialURL()
      .then((url) => {
        if (cancelled) return;
        const sid = extractSessionIdFromUrl(url);
        if (sid) void confirmCheckoutSession(sid, deps);
      })
      .catch(() => {
        // ignore
      });

    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionIdFromUrl(url);
      if (sid) void confirmCheckoutSession(sid, deps);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [isAuthenticated, queryClient, toast]);

  return null;
}
