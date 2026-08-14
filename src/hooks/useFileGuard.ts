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
  onVerified: (kind: "verify" | "membership") => void;
  toolThresholds: ToolThresholds | null;
}

const VERIFY_KEY = "pdftool.verified";
const MEMBERSHIP_KEY = "pdftool.membership";

function loadVerify(): boolean {
  try { return sessionStorage.getItem(VERIFY_KEY) === "1"; } catch { return false; }
}
function saveVerify() { try { sessionStorage.setItem(VERIFY_KEY, "1"); } catch {} }
function loadMembership(): boolean {
  try { return sessionStorage.getItem(MEMBERSHIP_KEY) === "1"; } catch { return false; }
}
function saveMembership() { try { sessionStorage.setItem(MEMBERSHIP_KEY, "1"); } catch {} }

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

  const onVerified = useCallback((kind: "verify" | "membership") => {
    if (kind === "verify") saveVerify();
    else saveMembership();
    setLevel(null);
  }, []);

  return { config, loading, level, check, requestVerify, requestMembership, clearModal, onVerified, toolThresholds };
}
