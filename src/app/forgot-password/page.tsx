"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-base pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
      >
        {show ? (
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
  );
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>();

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

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
        body: JSON.stringify({ email, purpose: "reset" }),
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

  const resetPassword = async () => {
    setErr("");
    if (!email || !code || !newPassword) {
      setErr("请填写所有字段");
      return;
    }
    if (newPassword.length < 6) {
      setErr("密码至少 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword, code }),
      });
      const data = await r.json();
      if (data.ok) {
        setSuccess(true);
        setTimeout(() => router.push("/"), 2000);
      } else {
        setErr(data.reason || "重置失败");
      }
    } catch (e: any) {
      setErr(e?.message || "网络错误");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-900">密码重置成功</h3>
            <p className="mt-1 text-sm text-zinc-500">即将跳转到首页，请使用新密码登录</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-12">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="relative px-6 pt-6 pb-4">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">找回密码</h3>
                <p className="text-xs text-zinc-500">通过邮箱验证码重置密码</p>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">注册邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErr(""); }}
                placeholder="you@example.com"
                className="input-base"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">邮箱验证码</label>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(""); }}
                  placeholder="6 位验证码"
                  maxLength={6}
                  className="input-base flex-1 text-center text-lg tracking-[0.3em] font-mono uppercase"
                />
                <button
                  onClick={sendCode}
                  disabled={countdown > 0 || loading}
                  className="btn-primary whitespace-nowrap"
                >
                  {countdown > 0 ? `${countdown}s` : "发送验证码"}
                </button>
              </div>
              {devCode && (
                <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                  验证码：<span className="font-mono font-bold">{devCode}</span>（开发模式）
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">新密码</label>
              <PasswordInput value={newPassword} onChange={(v) => { setNewPassword(v); setErr(""); }} placeholder="至少 6 位" />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">确认新密码</label>
              <PasswordInput value={confirmPassword} onChange={(v) => { setConfirmPassword(v); setErr(""); }} placeholder="再次输入新密码" />
            </div>

            {err && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                {err}
              </div>
            )}

            <button
              onClick={resetPassword}
              disabled={loading}
              className="btn w-full btn-primary"
            >
              {loading ? "重置中..." : "重置密码"}
            </button>

            <div className="flex items-center justify-between text-xs">
              <Link href="/" className="text-zinc-500 hover:text-zinc-700">
                返回首页
              </Link>
              <Link href="/register" className="text-brand-600 hover:text-brand-700 font-medium">
                注册新账号
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
