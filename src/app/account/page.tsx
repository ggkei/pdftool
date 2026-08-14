"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/components/UserContext";

function formatDate(ts?: number | null) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tierBadgeClass(tier?: string | null) {
  switch (tier) {
    case "forever": return "bg-gradient-to-r from-amber-400 to-amber-500 text-white";
    case "three_year": return "bg-purple-100 text-purple-700";
    case "year": return "bg-violet-100 text-violet-700";
    case "half_year": return "bg-cyan-100 text-cyan-700";
    case "month": return "bg-blue-100 text-blue-700";
    default: return "bg-zinc-100 text-zinc-600";
  }
}

export default function AccountPage() {
  const { user, loading, openLogin, bindMembership, logout } = useUser();
  const [token, setToken] = useState("");
  const [binding, setBinding] = useState(false);
  const [bindMsg, setBindMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!user && !loading) {
      openLogin();
    }
  }, [user, loading, openLogin]);

  const handleBind = async () => {
    setBindMsg(null);
    if (!token.trim()) {
      setBindMsg({ type: "error", text: "请输入会员码" });
      return;
    }
    setBinding(true);
    const r = await bindMembership(token.trim().toUpperCase());
    setBinding(false);
    if (r.ok) {
      setBindMsg({ type: "success", text: "会员码绑定成功！" });
      setToken("");
    } else {
      setBindMsg({ type: "error", text: r.reason || "绑定失败" });
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 rounded-lg bg-slate-200" />
          <div className="h-40 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
          <p className="text-zinc-600">请先登录以查看账户信息</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">账户中心</h1>
        <p className="mt-1 text-sm text-zinc-500">管理你的账号和会员状态</p>
      </div>

      {/* User Info Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-xl font-semibold">
            {(user.nickname || user.email?.split("@")[0] || "U").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-zinc-900 truncate">
                {user.nickname || user.email?.split("@")[0]}
              </span>
              {user.isMember && user.tierInfo && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tierBadgeClass(user.membershipTier)}`}>
                  {user.tierInfo.name}
                </span>
              )}
            </div>
            <div className="text-sm text-zinc-500 truncate">{user.email}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-zinc-500">登录方式</div>
            <div className="mt-0.5 font-medium text-zinc-800">
              {(user as any).hasPassword ? "邮箱 + 密码" : "邮箱验证"}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-zinc-500">注册时间</div>
            <div className="mt-0.5 font-medium text-zinc-800">{formatDate((user as any).createdAt)}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-zinc-500">上次登录</div>
            <div className="mt-0.5 font-medium text-zinc-800">{formatDate((user as any).lastLoginAt)}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-zinc-500">会员状态</div>
            <div className={`mt-0.5 font-medium ${user.isMember ? "text-amber-600" : "text-zinc-500"}`}>
              {user.isMember
                ? (user.remainingDays === -1 ? "永久有效" : `剩余 ${user.remainingDays} 天`)
                : "非会员"}
            </div>
          </div>
        </div>
      </div>

      {/* Password Management Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-base font-semibold text-zinc-900">密码管理</h2>
        <p className="mt-1 text-xs text-zinc-500">
          设置密码后可使用密码快速登录，无需每次接收验证码。
        </p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={`inline-flex h-2 w-2 rounded-full ${(user as any).hasPassword ? "bg-green-500" : "bg-zinc-300"}`} />
            <span className="text-zinc-600">{(user as any).hasPassword ? "已设置密码" : "未设置密码"}</span>
          </div>
          <a
            href="/forgot-password"
            className="inline-block text-sm text-brand-600 hover:text-brand-700"
          >
            {(user as any).hasPassword ? "修改密码" : "设置密码"} →
          </a>
        </div>
      </div>

      {/* Membership Binding Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-base font-semibold text-zinc-900">绑定会员码</h2>
        <p className="mt-1 text-xs text-zinc-500">
          输入管理员提供的会员码，即可解锁大文件处理权限。会员码将永久绑定到你的账号。
        </p>

        <div className="mt-4 space-y-3">
          <input
            value={token}
            onChange={(e) => { setToken(e.target.value.toUpperCase()); setBindMsg(null); }}
            placeholder="如 MB-XXXX-XXXX"
            maxLength={30}
            className="input-base font-mono"
          />
          <button
            onClick={handleBind}
            disabled={binding}
            className="btn w-full btn-primary"
          >
            {binding ? "绑定中..." : "绑定会员码"}
          </button>

          {bindMsg && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
              bindMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}>
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                {bindMsg.type === "success" ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                ) : (
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                    <circle cx="12" cy="12" r="10" />
                  </>
                )}
              </svg>
              {bindMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* Logout Button */}
      <div className="flex justify-end">
        <button
          onClick={async () => { await logout(); }}
          className="text-sm text-zinc-500 hover:text-red-600 transition-colors"
        >
          退出登录
        </button>
      </div>
    </div>
  );
}
