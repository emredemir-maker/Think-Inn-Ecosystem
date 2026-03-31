import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API_ORIGIN } from "./api-config";

const API_BASE = `${API_ORIGIN}/api`;

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  email: string;
  role: "super_admin" | "moderator" | "master" | "user";
  avatarUrl?: string | null;
  bio?: string | null;
  pageAccess?: Array<{ page: string; granted: boolean }>;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isRole: (minRole: AuthUser["role"]) => boolean;
}

interface RegisterData {
  username: string;
  displayName: string;
  email: string;
  password: string;
}

const ROLE_LEVELS: Record<string, number> = {
  user: 1,
  master: 2,
  moderator: 3,
  super_admin: 4,
};

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "think_inn_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  const apiFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
          ...options?.headers,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Bir hata oluştu");
      return json;
    },
    []
  );

  // Restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) { setLoading(false); return; }
    apiFetch("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [apiFetch]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
  }, [apiFetch]);

  const register = useCallback(async (data: RegisterData) => {
    const res = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
  }, [apiFetch]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const isRole = useCallback(
    (minRole: AuthUser["role"]) => {
      if (!user) return false;
      return (ROLE_LEVELS[user.role] ?? 0) >= (ROLE_LEVELS[minRole] ?? 0);
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Typed fetch helper for community + admin API calls */
export async function authFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Bir hata oluştu");
  return json.data as T;
}
