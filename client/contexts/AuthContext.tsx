import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { getApiUrl } from "@/lib/query-client";

const TOKEN_KEY = "torqueshed_auth_token";

export interface User {
  id: string;
  username: string;
  role: string;
}

interface AuthContextType {
  accessToken: string | null;
  currentUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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

  useEffect(() => {
    async function restoreAuth() {
      try {
        const token = await getStoredToken();
        if (token) {
          const user = await fetchCurrentUser(token);
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
        setIsLoading(false);
      }
    }
    restoreAuth();
  }, [fetchCurrentUser]);

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

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        currentUser,
        isLoading,
        isAuthenticated: !!accessToken && !!currentUser,
        login,
        signup,
        logout,
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
