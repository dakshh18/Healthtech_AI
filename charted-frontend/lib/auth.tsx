"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, TOKEN_KEY, USER_KEY } from "./api";
import type { Role, User } from "@/types";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  role: "PATIENT" | "DOCTOR";
  phone?: string;
  gender?: "Male" | "Female" | "Other";
  age?: number;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(USER_KEY);
      if (raw && window.localStorage.getItem(TOKEN_KEY)) setUser(JSON.parse(raw));
    } catch {
      // ignore corrupt storage
    }
    setLoading(false);
  }, []);

  const persist = (token: string, u: User) => {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>("/api/auth/login", { email, password });
    persist(res.token, res.user);
  };

  const register = async (input: RegisterInput) => {
    const res = await api.post<{ token: string; user: User }>("/api/auth/register", input);
    persist(res.token, res.user);
  };

  const logout = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function roleHome(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "DOCTOR") return "/";
  return "/appointments";
}
