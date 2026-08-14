"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "./UserContext";

interface Props {
  onClose?: () => void;
  onSuccess?: () => void;
}

export function LoginModal({ onClose, onSuccess }: Props) {
  const router = useRouter();
  const { refresh, closeLogin, loginModalOpen } = useUser();
  const [tab, setTab] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();

  useEffect(() => {
    if (!loginModalOpen) return;
    setEmail("");
    setCode("");
    setPassword("");
    setShowPassword(false);
    setCodeSent(false);
    setErr("");
    setDevCode(undefined);
    setTab("password");
  }, [loginModalOpen]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (!loginModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loginModalOpen]);

  const handleClose = () => {
    onClose?.();
    closeLogin();
  };

  const sendCode = async () => {
    setErr("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr("邮箱格式不正确");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      if (data.ok) {
        setCodeSent(true);
        setCountdown(60);
        setDevCode(data.devCode);
      } else {
        setErr(data.reason || "发送失败");
      }
    } catch (e: any) {
      setErr(e?.message || "网络错误");
    } finally {
      setLoading(false);
    }
  };

  const loginWithCode = async () => {
    setErr("");
    if (!email || !code) { setErr("请输入邮箱和验证码"); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await r.json();
      if (data.ok) {
        await refresh();
        onSuccess?.();
        handleClose();
      } else {
        setErr(data.reason || "登录失败");
      }
    } catch (e: any) {
      setErr(e?.message || "网络错误");
    } finally {
      setLoading(false);
    }
  };

  const loginWithPassword = async () => {
    setErr("");
    if (!email || !password) { setErr("请输入邮箱和密码"); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (data.ok) {
        await refresh();
        onSuccess?.();
        handleClose();
      } else {
        setErr(data.reason || "登录失败");
      }
    } catch (e: any) {
      setErr(e?.message || "网络错误");
    } finally {
      setLoading(false);
    }
  };

  if (!loginModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm animate-fade-in">
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
                <h3 className="text-base font-semibold text-zinc-900">登录 PDFTool</h3>
                <p className="text-xs text-zinc-500">密码登录或验证码登录</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              aria-label="关闭"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => { setTab("password"); setErr(""); }}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                tab === "password" ? "bg-white text-brand-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              密码登录
            </button>
            <button
              onClick={() => { setTab("code"); setErr(""); }}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                tab === "code" ? "bg-white text-brand-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              验证码登录
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">邮箱地址</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErr(""); }}
              placeholder="you@example.com"
              className="input-base"
              autoFocus
            />
          </div>

          {tab === "password" && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-600">密码</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErr(""); }}
                    placeholder="请输入密码"
                    className="input-base pr-10"
                    onKeyDown={(e) => { if (e.key === "Enter") loginWithPassword(); }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M1 1l22 22" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => { handleClose(); router.push("/forgot-password"); }}
                  className="text-xs text-brand-600 hover:text-brand-700"
                >
                  忘记密码？
                </button>
              </div>
              <button
                onClick={loginWithPassword}
                disabled={loading}
                className="btn w-full btn-primary"
              >
                {loading ? "登录中..." : "密码登录"}
              </button>
            </>
          )}

          {tab === "code" && (
            <>
              {!codeSent ? (
                <button
                  onClick={sendCode}
                  disabled={loading}
                  className="btn w-full btn-primary"
                >
                  {loading ? "发送中..." : "发送验证码"}
                </button>
              ) : (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600">验证码</label>
                  <div className="flex gap-2">
                    <input
                      value={code}
                      onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(""); }}
                      placeholder="6 位验证码"
                      maxLength={6}
                      className="input-base flex-1 text-center text-lg tracking-[0.3em] font-mono uppercase"
                    />
                    <button
                      onClick={loginWithCode}
                      disabled={loading}
                      className="btn-primary"
                    >
                      {loading ? "..." : "登录"}
                    </button>
                  </div>
                  {devCode && (
                    <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                      验证码：<span className="font-mono font-bold">{devCode}</span>（开发模式）
                    </p>
                  )}
                  <button
                    onClick={sendCode}
                    disabled={countdown > 0 || loading}
                    className="mt-3 text-xs text-brand-600 hover:text-brand-700 disabled:text-zinc-400"
                  >
                    {countdown > 0 ? `${countdown}s 后重新发送` : "重新发送验证码"}
                  </button>
                </div>
              )}
            </>
          )}

          {err && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              {err}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-zinc-400">还没有账号？</span>
            <button
              onClick={() => { handleClose(); router.push("/register"); }}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              注册新账号
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
