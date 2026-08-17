"use client";

import { useState } from "react";
import { useUser } from "./UserContext";
import { PaymentModal } from "./PaymentModal";

interface Props {
  mode: "verify" | "membership";
  fileSizeMB: number;
  verifyMb: number;
  membershipMb: number;
  onClose: () => void;
  onVerified: (kind: "verify" | "membership", expiry?: number) => void;
}

export function FileGuardModal({ mode, fileSizeMB, verifyMb, membershipMb, onClose, onVerified }: Props) {
  const { refresh, openLogin, bindMembership } = useUser();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showPayment, setShowPayment] = useState(false);

  const submit = async () => {
    setErr("");
    if (!value.trim()) { setErr("请输入激活码"); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/activate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value.trim() }),
        credentials: "include",
      });
      const data = await r.json();

      if (data.ok && data.type === "verify") {
        if (mode === "membership") {
          setErr("此文件较大，需要会员激活码");
        } else {
          onVerified("verify");
          setValue("");
        }
      } else if (data.ok && data.type === "membership") {
        if (data.bound) {
          await refresh();
          const expiry = parseInt(localStorage.getItem("pdftool.membership_expiry") || "0", 10);
          onVerified("membership", expiry);
        } else if (data.needLogin) {
          openLogin(value.trim());
          onClose();
        } else {
          const result = await bindMembership(value.trim());
          onVerified("membership", result.expiresAt);
        }
        setValue("");
      } else {
        setErr(data.reason || "激活码无效");
      }
    } catch (e: any) {
      setErr(e?.message || "网络错误");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeReceived = (code: string) => {
    setValue(code);
    setShowPayment(false);
  };

  const thresholdLabel = mode === "verify"
    ? `超过 ${verifyMb}MB 需输入激活码`
    : `超过 ${membershipMb}MB 需会员激活码`;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-md animate-scale-in overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_-12px_rgba(15,23,42,0.25)]">
          <div className="relative px-6 pt-6 pb-4">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 to-brand-400" />
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path strokeLinecap="round" d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-900">激活码验证</h3>
                  <p className="text-xs text-zinc-500">
                    {mode === "verify" ? "解锁临时处理权限" : "解锁大文件处理权限"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
                aria-label="关闭"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="px-6 pb-6">
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-brand-200/70 bg-brand-50/60 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
              <div className="text-xs leading-relaxed text-zinc-700">
                当前文件 <span className="font-bold text-zinc-900">{fileSizeMB.toFixed(1)} MB</span>
                <span className="mx-1 text-zinc-400">·</span>
                {thresholdLabel}
              </div>
            </div>

            <label className="mb-2 block text-xs font-medium text-zinc-600">激活码</label>
            <input
              value={value}
              onChange={(e) => { setValue(e.target.value.toUpperCase()); setErr(""); }}
              maxLength={20}
              placeholder="输入验证码或会员码"
              className="input-base text-center text-lg tracking-[0.2em] font-mono uppercase"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />

            {err && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                {err}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">
                取消
              </button>
              <button
                onClick={submit}
                disabled={loading}
                className="btn-primary flex-1"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    验证中...
                  </>
                ) : "确认激活"}
              </button>
            </div>

            {/* Buy Membership Button */}
            <button
              onClick={() => setShowPayment(true)}
              className="mt-4 w-full rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 py-2.5 text-sm font-semibold text-amber-700 transition-all hover:border-amber-400 hover:from-amber-100 hover:to-orange-100"
            >
              购买会员 · 立即解锁全部功能
            </button>

            {/* Mini Program QR Code Section */}
            <div className="mt-5 flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
              <p className="text-xs text-zinc-500">没有激活码？微信扫码看广告免费获取</p>
              <div className="flex h-32 w-32 flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-white">
                <svg className="h-12 w-12 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 14h3M14 18h3M18 18v3" />
                </svg>
                <span className="mt-1 text-[10px] text-zinc-400">小程序二维码</span>
              </div>
              <p className="text-[11px] leading-relaxed text-center text-zinc-400">
                微信扫码 → 看广告 → 获取激活码<br/>
                验证码 15 分钟有效 · 看 3 次送 1 天会员
              </p>
            </div>
          </div>
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          onClose={() => setShowPayment(false)}
          onCodeReceived={handleCodeReceived}
        />
      )}
    </>
  );
}