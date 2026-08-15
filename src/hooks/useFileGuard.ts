"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ToolThresholds {
  verifyMb: number;
  membershipMb: number;
}

export interface PublicConfig {
  verify: { enabled: boolean; mb: number };
  membership: { enabled: boolean; mb: number };
  tools: Record<string, ToolThresholds>;
}

export type GuardLevel = "free" | "verify" | "membership";

export interface FileGuardState {
  config: PublicConfig | null;
  loading: boolean;
  level: GuardLevel | null;
  check: (fileSize: number) => GuardLevel;
  requestVerify: () => void;
  requestMembership: () => void;
  clearModal: () => void;
  onVerified: (kind: "verify" | "membership", expiry?: number) => void;
  toolThresholds: ToolThresholds | null;
}

const VERIFY_KEY = "pdftool.verified";
const VERIFY_AT_KEY = "pdftool.verified_at";
const VERIFY_TTL = 15 * 60 * 1000; // 15 minutes
const MEMBERSHIP_KEY = "pdftool.membership";
const MEMBERSHIP_EXPIRY_KEY = "pdftool.membership_expiry";

function loadVerify(): boolean {
  try {
    if (localStorage.getItem(VERIFY_KEY) !== "1") return false;
    const ts = parseInt(localStorage.getItem(VERIFY_AT_KEY) || "0", 10);
    if (Date.now() - ts > VERIFY_TTL) {
      localStorage.removeItem(VERIFY_KEY);
      localStorage.removeItem(VERIFY_AT_KEY);
      return false;
    }
    return true;
  } catch { return false; }
}
function saveVerify() {
  try {
    localStorage.setItem(VERIFY_KEY, "1");
    localStorage.setItem(VERIFY_AT_KEY, String(Date.now()));
  } catch {}
}
function loadMembership(): boolean {
  try {
    if (localStorage.getItem(MEMBERSHIP_KEY) !== "1") return false;
    const expiry = parseInt(localStorage.getItem(MEMBERSHIP_EXPIRY_KEY) || "0", 10);
    if (expiry > 0 && Date.now() > expiry) {
      localStorage.removeItem(MEMBERSHIP_KEY);
      localStorage.removeItem(MEMBERSHIP_EXPIRY_KEY);
      return false;
    }
    return true;
  } catch { return false; }
}
function saveMembership(expiry?: number) {
  try {
    localStorage.setItem(MEMBERSHIP_KEY, "1");
    localStorage.setItem(MEMBERSHIP_EXPIRY_KEY, String(expiry || 0));
  } catch {}
}

function resolveThresholds(cfg: PublicConfig, toolId?: string): ToolThresholds {
  if (toolId && cfg.tools?.[toolId]) return cfg.tools[toolId];
  return { verifyMb: cfg.verify.mb, membershipMb: cfg.membership.mb };
}

export function useFileGuard(toolId?: string): FileGuardState {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<GuardLevel | null>(null);
  const [toolThresholds, setToolThresholds] = useState<ToolThresholds | null>(null);

  const configRef = useRef<PublicConfig | null>(null);
  const toolRef = useRef<string | undefined>(toolId);
  toolRef.current = toolId;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config")
      .then((r) => r.json())
      .then((c: PublicConfig) => {
        if (cancelled) return;
        configRef.current = c;
        setConfig(c);
        setToolThresholds(resolveThresholds(c, toolRef.current));
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const check = useCallback((fileSize: number): GuardLevel => {
    const cfg = configRef.current;
    if (!cfg) return "free";
    const mb = fileSize / 1024 / 1024;
    const t = resolveThresholds(cfg, toolRef.current);
    if (cfg.membership.enabled && mb > t.membershipMb) {
      if (loadMembership()) return "free";
      return "membership";
    }
    if (cfg.verify.enabled && mb > t.verifyMb) {
      if (loadVerify() || loadMembership()) return "free";
      return "verify";
    }
    return "free";
  }, []);

  const requestVerify = useCallback(() => setLevel("verify"), []);
  const requestMembership = useCallback(() => setLevel("membership"), []);
  const clearModal = useCallback(() => setLevel(null), []);

  const onVerified = useCallback((kind: "verify" | "membership", expiry?: number) => {
    if (kind === "verify") saveVerify();
    else saveMembership(expiry);
    setLevel(null);
  }, []);

  return { config, loading, level, check, requestVerify, requestMembership, clearModal, onVerified, toolThresholds };
}