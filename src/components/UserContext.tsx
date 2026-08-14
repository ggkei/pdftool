"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";

export interface UserInfo {
  id: number;
  email?: string | null;
  nickname?: string | null;
  membershipTier?: string | null;
  isMember: boolean;
  remainingDays: number;
  tierInfo?: { id: string; name: string; days: number; color: string } | null;
}

interface UserContextValue {
  user: UserInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  openLogin: (pendingMembershipToken?: string | null) => void;
  loginModalOpen: boolean;
  closeLogin: () => void;
  bindMembership: (token: string) => Promise<{ ok: boolean; reason?: string }>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const userRef = useRef<UserInfo | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await r.json();
      setUser(data.user);
      userRef.current = data.user;
    } catch {
      setUser(null);
      userRef.current = null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/me", { method: "POST" });
    setUser(null);
    userRef.current = null;
  }, []);

  const bindMembership = useCallback(async (token: string) => {
    try {
      const r = await fetch("/api/membership/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "include",
      });
      const data = await r.json();
      if (data.ok) {
        await refresh();
      }
      return { ok: !!data.ok, reason: data.reason };
    } catch (e: any) {
      return { ok: false, reason: e?.message || "网络错误" };
    }
  }, [refresh]);

  const openLogin = useCallback((token?: string | null) => {
    if (token) setPendingToken(token);
    setLoginModalOpen(true);
  }, []);

  const closeLogin = useCallback(() => {
    setLoginModalOpen(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (pendingToken && user) {
      bindMembership(pendingToken).then(() => {
        setPendingToken(null);
      });
    }
  }, [user, pendingToken, bindMembership]);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        refresh,
        logout,
        openLogin,
        closeLogin,
        bindMembership,
        loginModalOpen,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
}
