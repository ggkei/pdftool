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
  membershipExpiresAt?: number | null;
}

interface UserContextValue {
  user: UserInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  openLogin: (pendingMembershipToken?: string | null) => void;
  loginModalOpen: boolean;
  closeLogin: () => void;
  bindMembership: (token: string) => Promise<{ ok: boolean; reason?: string; expiresAt?: number }>;
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
      // Sync server-side membership to localStorage for cross-browser support
      if (data.user?.isMember) {
        try {
          localStorage.setItem("pdftool.membership", "1");
          localStorage.setItem("pdftool.membership_expiry", String(data.user.membershipExpiresAt || 0));
        } catch {}
      }
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
        if (data.mode === "in-memory") {
          const days = data.days ?? 1;
          const isForever = days === 0;
          const now = Date.now();
          let expiresAt: number;

          if (isForever) {
            expiresAt = 0;
          } else {
            const current = userRef.current;
            if (current?.isMember && current?.membershipExpiresAt && current.membershipExpiresAt > now) {
              expiresAt = current.membershipExpiresAt + days * 86_400_000;
            } else {
              expiresAt = now + days * 86_400_000;
            }
          }

          const remainingDays = isForever ? -1 : Math.max(1, Math.ceil((expiresAt - now) / 86_400_000));
          const tier = data.tier || "day";
          const tierInfo = {
            id: tier,
            name: data.tierName || "日卡",
            days: days,
            color: data.tierColor || "bg-green-100 text-green-700",
          };

          const updateUser = (prev: UserInfo | null): UserInfo | null => prev ? {
            ...prev,
            isMember: true,
            membershipTier: tier,
            remainingDays,
            tierInfo,
            membershipExpiresAt: expiresAt,
          } : prev;

          setUser(updateUser);
          if (userRef.current) {
            userRef.current = {
              ...userRef.current,
              isMember: true,
              membershipTier: tier,
              remainingDays,
              tierInfo,
              membershipExpiresAt: expiresAt,
            };
          }
          // Sync to localStorage so useFileGuard picks it up
          try {
            localStorage.setItem("pdftool.membership", "1");
            localStorage.setItem("pdftool.membership_expiry", String(expiresAt));
          } catch {}
        } else {
          await refresh();
        }
      }
      return { ok: !!data.ok, reason: data.reason, expiresAt: data.ok ? (userRef.current?.membershipExpiresAt ?? undefined) : undefined };
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