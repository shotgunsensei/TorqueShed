import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { getApiUrl } from "@/lib/query-client";

// Pull an OperatorOS SSO token off any URL we receive — works for both the
// web `/?ssoToken=...` redirect and the native `torqueshed://sso?token=...`
// deep link emitted by the bridge HTML. Returns null if no token is present.
function extractSsoTokenFromUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    // Linking.parse handles both schemed (torqueshed://) and http(s) URLs and
    // surfaces query params consistently across platforms.
    const parsed = Linking.parse(rawUrl);
    const qp = parsed.queryParams || {};
    const candidate = qp.ssoToken ?? qp.token;
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
    return null;
  } catch {
    return null;
  }
}

const TOKEN_KEY = "torqueshed_auth_token";

export interface User {
  id: string;
  username: string;
  role: string;
  onboardingCompleted: boolean;
  onboardingGoals: string[];
  email?: string | null;
  emailVerifiedAt?: string | null;
  notificationsEnabled?: boolean;
}

interface AuthContextType {
  accessToken: string | null;
  currentUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function setStoredToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch (error) {
    console.error("Failed to store token:", error);
  }
}

async function removeStoredToken(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (error) {
    console.error("Failed to remove token:", error);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = useCallback(async (token: string): Promise<User | null> => {
    try {
      const url = new URL("/api/users/me", getApiUrl());
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  // Shared SSO ingestion path used by both the boot-time URL check and the
  // runtime Linking listener (native cold/warm starts both go through here).
  // Persists the token, refreshes the current user, and -- on web only --
  // strips the `ssoToken` query param via history.replaceState so it doesn't
  // sit in the address bar or get shared.
  const ingestSsoToken = useCallback(
    async (ssoToken: string) => {
      try {
        await setStoredToken(ssoToken);
        const user = await fetchCurrentUser(ssoToken);
        if (user) {
          setAccessToken(ssoToken);
          setCurrentUser(user);
        } else {
          // Token rejected by /api/auth/me — purge so we don't loop on it.
          await removeStoredToken();
        }
      } catch (error) {
        console.error("Failed to ingest SSO token:", error);
      } finally {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          try {
            const params = new URLSearchParams(window.location.search);
            if (params.has("ssoToken")) {
              params.delete("ssoToken");
              const cleaned =
                window.location.pathname +
                (params.toString() ? `?${params.toString()}` : "") +
                window.location.hash;
              window.history.replaceState({}, "", cleaned);
            }
          } catch {
            // Best effort — never let a URL clean-up failure break sign-in.
          }
        }
      }
    },
    [fetchCurrentUser],
  );

  useEffect(() => {
    let cancelled = false;
    async function restoreAuth() {
      try {
        // OperatorOS SSO handoff. Look at whichever URL the platform exposes
        // at boot:
        //   - Web: window.location (the bridge fallback hits /?ssoToken=...).
        //   - Native: Linking.getInitialURL() (the bridge attempted
        //     torqueshed://sso?token=... before the web fallback).
        let initialUrl: string | null = null;
        if (Platform.OS === "web" && typeof window !== "undefined") {
          initialUrl = window.location.href;
        } else {
          try {
            initialUrl = await Linking.getInitialURL();
          } catch {
            initialUrl = null;
          }
        }
        const ssoToken = extractSsoTokenFromUrl(initialUrl);
        if (ssoToken && !cancelled) {
          await ingestSsoToken(ssoToken);
          setIsLoading(false);
          return;
        }

        const token = await getStoredToken();
        if (cancelled) return;
        if (token) {
          const user = await fetchCurrentUser(token);
          if (cancelled) return;
          if (user) {
            setAccessToken(token);
            setCurrentUser(user);
          } else {
            await removeStoredToken();
          }
        }
      } catch (error) {
        console.error("Failed to restore auth:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    restoreAuth();
    return () => {
      cancelled = true;
    };
  }, [fetchCurrentUser, ingestSsoToken]);

  // Also handle warm-launch SSO deep links (app already running when the user
  // taps a torqueshed://sso?token=... link). Web handles this implicitly via
  // the boot flow because clicking a link reloads the page.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", (event) => {
      const ssoToken = extractSsoTokenFromUrl(event.url);
      if (ssoToken) void ingestSsoToken(ssoToken);
    });
    return () => sub.remove();
  }, [ingestSsoToken]);

  const login = useCallback(async (username: string, password: string) => {
    const url = new URL("/api/auth/login", getApiUrl());
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Login failed");
    }

    const data = await response.json();
    await setStoredToken(data.token);
    setAccessToken(data.token);
    setCurrentUser(data.user);
  }, []);

  const signup = useCallback(async (username: string, password: string) => {
    const url = new URL("/api/auth/signup", getApiUrl());
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Signup failed");
    }

    const data = await response.json();
    await setStoredToken(data.token);
    setAccessToken(data.token);
    setCurrentUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await removeStoredToken();
    setAccessToken(null);
    setCurrentUser(null);
  }, []);

  const completeOnboarding = useCallback(() => {
    setCurrentUser((prev) =>
      prev ? { ...prev, onboardingCompleted: true } : prev
    );
  }, []);

  const isAuthenticated = !!accessToken && !!currentUser;
  const needsOnboarding = isAuthenticated && currentUser?.onboardingCompleted === false;

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        currentUser,
        isLoading,
        isAuthenticated,
        needsOnboarding,
        login,
        signup,
        logout,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
