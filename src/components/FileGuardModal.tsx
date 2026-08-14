"use client";

import { useState } from "react";
import { useUser } from "./UserContext";

interface Props {
  mode: "verify" | "membership";
  fileSizeMB: number;
  verifyMb: number;
  membershipMb: number;
  onClose: () => void;
  onVerified: (kind: "verify" | "membership") => void;
}

export function FileGuardModal({ mode, fileSizeMB, verifyMb, membershipMb, onClose, onVerified }: Props) {
  const { user, refresh, openLogin } = useUser();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!value.trim()) { setErr("请输入内容"); return; }
    setLoading(true);
    try {
      const endpoint = mode === "verify" ? "/api/verify-code" : "/api/verify-membership";
      const body = mode === "verify" ? { code: value } : { token: value };
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const data = await r.json();

      if (mode === "membership") {
        if (data.ok && data.bound) {
          await refresh();
          onVerified("membership");
          setValue("");
        } else if (data.ok && data.needLogin) {
          openLogin(value);
          onClose();
        } else {
          setErr(data.reason || "验证失败");
        }
      } else {
        if (data.ok) {
          onVerified(mode);
          setValue("");
        } else {
          setErr(data.reason || "验证失败");
        }
      }
    } catch (e: any) {
      setErr(e?.message || "网络错误");
    } finally {
      setLoading(false);
    }
  };

  const thresholdLabel = mode === "verify"
    ? `超过 ${verifyMb}MB 需输入验证码`
    : `超过 ${membershipMb}MB 需会员`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md animate-scale-in overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_-12px_rgba(15,23,42,0.25)]">
        <div className="relative px-6 pt-6 pb-4">
          <div className={`absolute inset-x-0 top-0 h-1 ${mode === "verify" ? "bg-gradient-to-r from-brand-500 to-brand-400" : "bg-gradient-to-r from-amber-500 to-amber-400"}`} />
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${mode === "verify" ? "bg-brand-100 text-brand-600" : "bg-amber-100 text-amber-600"}`}>
                {mode === "verify" ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path strokeLinecap="round" d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">
                  {mode === "verify" ? "验证码验证" : "会员验证"}
                </h3>
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
          <div className={`mb-5 flex items-center gap-3 rounded-xl border p-3 ${mode === "verify" ? "bg-brand-50/60 border-brand-200/70" : "bg-amber-50/60 border-amber-200/70"}`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${mode === "verify" ? "bg-brand-100 text-brand-700" : "bg-amber-100 text-amber-700"}`}>
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

          {mode === "membership" && user?.isMember && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              你已是 <b>{user.tierInfo?.name || "会员"}</b>（{user.remainingDays === -1 ? "永久" : `剩余 ${user.remainingDays} 天`}），点击下方"取消"即可继续使用。
            </div>
          )}

          {mode === "verify" ? (
            <>
              <label className="mb-2 block text-xs font-medium text-zinc-600">验证码</label>
              <input
                value={value}
                onChange={(e) => { setValue(e.target.value.toUpperCase()); setErr(""); }}
                maxLength={12}
                placeholder="如 A1B2C3"
                className="input-base text-center text-lg tracking-[0.3em] font-mono uppercase"
                autoFocus
              />
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                请通过官方小程序获取验证码，输入下方即可解锁（有效期 30 分钟）
              </p>
            </>
          ) : (
            <>
              {user ? (
                <>
                  <label className="mb-2 block text-xs font-medium text-zinc-600">会员码（将绑定到你的账号）</label>
                  <input
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setErr(""); }}
                    placeholder="如 MB-XXXX-XXXX"
                    className="input-base font-mono"
                    autoFocus
                  />
                  <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                    会员码将永久绑定到 {user.email}
                  </p>
                </>
              ) : (
                <>
                  <label className="mb-2 block text-xs font-medium text-zinc-600">会员码</label>
                  <input
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setErr(""); }}
                    placeholder="如 MB-XXXX-XXXX"
                    className="input-base font-mono"
                    autoFocus
                  />
                  <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                    输入后将引导你登录并绑定到账号
                  </p>
                </>
              )}
            </>
          )}

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
              className={`flex-1 ${mode === "verify" ? "btn-primary" : "btn"} bg-amber-500 hover:bg-amber-600 shadow-card text-white`}
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  验证中...
                </>
              ) : mode === "membership" && !user ? "登录并绑定" : "确认"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
