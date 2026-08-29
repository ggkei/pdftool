"use client";

import { useCallback, useEffect, useState } from "react";
import { TOOLS, DEFAULT_TOOL_THRESHOLDS, MEMBERSHIP_TIERS, type MembershipTier } from "@/lib/tools";

type Screen = "login" | "dashboard";

interface ToolThresholds {
  verifyMb: number;
  membershipMb: number;
}

interface AdminConfig {
  config: Record<string, string>;
  public: {
    verify: { enabled: boolean; mb: number };
    membership: { enabled: boolean; mb: number };
    tools: Record<string, ToolThresholds>;
  };
  codes: any[];
  tokens: any[];
}

const AUTH_KEY = "pdftool.admin.auth";
const TOKEN_KEY = "pdftool.admin.token";

function isAuthed(): boolean {
  try { return sessionStorage.getItem(AUTH_KEY) === "1" && !!sessionStorage.getItem(TOKEN_KEY); } catch { return false; }
}
function setAuthed(v: boolean, token?: string) {
  try {
    if (v && token) {
      sessionStorage.setItem(AUTH_KEY, "1");
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}
function getStoredToken(): string {
  try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}

async function apiAdmin(action: string, body: any = {}): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (action !== "login" && isAuthed()) headers["x-admin-auth"] = getStoredToken();
  const r = await fetch("/api/admin", {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...body }),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(d.reason || "请求失败");
  return d;
}

export default function AdminPage() {
  const [screen, setScreen] = useState<Screen>(() => isAuthed() ? "dashboard" : "login");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleLogin = useCallback(async () => {
    setLoginError("");
    try {
      await apiAdmin("login", { password });
      setAuthed(true, password);
      setScreen("dashboard");
      setPassword("");
    } catch (e: any) {
      setLoginError(e.message);
    }
  }, [password]);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin", {
        method: "GET",
        headers: isAuthed() ? { "x-admin-auth": getStoredToken() } : {},
      });
      const d = await r.json();
      if (d.ok) setConfig(d);
      else if (d.reason === "未授权") { setAuthed(false); setScreen("login"); }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (screen === "dashboard") fetchConfig();
  }, [screen, fetchConfig]);

  const updateConfig = useCallback(async (key: string, value: string) => {
    try {
      await apiAdmin("update-config", { updates: { [key]: value } });
      showToast("已保存");
      fetchConfig();
    } catch (e: any) {
      showToast(e.message);
    }
  }, [fetchConfig]);

  const generateCodes = useCallback(async () => {
    try {
      const d = await apiAdmin("generate-codes", { count: 20, minutes: 30 });
      showToast(`已生成 ${d.codes.length} 个验证码`);
      fetchConfig();
    } catch (e: any) {
      showToast(e.message);
    }
  }, [fetchConfig]);

  const [createTier, setCreateTier] = useState<MembershipTier>("year");
  const createToken = useCallback(async () => {
    try {
      const d = await apiAdmin("create-membership", { tier: createTier });
      showToast(`已生成 ${d.tierName} 会员码: ${d.token}`);
      fetchConfig();
    } catch (e: any) {
      showToast(e.message);
    }
  }, [createTier, fetchConfig]);

  const revokeToken = useCallback(async (token: string) => {
    if (!confirm(`确定停用会员码 ${token}？`)) return;
    try {
      await apiAdmin("revoke-membership", { token });
      showToast("已停用");
      fetchConfig();
    } catch (e: any) {
      showToast(e.message);
    }
  }, [fetchConfig]);

  const [newPwd, setNewPwd] = useState("");
  const changePassword = useCallback(async () => {
    if (!newPwd) return;
    try {
      await apiAdmin("set-password", { password: newPwd });
      showToast("密码已更新");
      setNewPwd("");
    } catch (e: any) {
      showToast(e.message);
    }
  }, [newPwd]);

  if (screen === "login") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-center text-xl font-semibold text-slate-800">🔐 管理员登录</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="默认密码: admin123"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
          {loginError && <p className="mt-2 text-xs text-red-600">{loginError}</p>}
          <button
            onClick={handleLogin}
            className="mt-4 w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
            登录
          </button>
        </div>
      </main>
    );
  }

  if (!config) {
    return <main className="mx-auto max-w-5xl px-4 py-8"><div className="animate-pulse">加载中...</div></main>;
  }

  const c = config.config;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">🛠️ AtoolX 管理后台</h1>
        <button onClick={() => { setAuthed(false); setScreen("login"); setConfig(null); }} className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50">
          退出登录
        </button>
      </div>

      {toast && (
        <div className="fixed right-4 top-4 z-50 rounded-lg bg-slate-800 px-4 py-2 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* 开关控制 */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">功能开关</h2>
        <div className="space-y-3">
          <ToggleRow
            label="验证码验证"
            desc="超过阈值后需输入验证码"
            checked={config.public.verify.enabled}
            onChange={(v) => updateConfig("verify.enabled", String(v))}
          />
          <ToggleRow
            label="会员限制"
            desc="超过阈值后需会员"
            checked={config.public.membership.enabled}
            onChange={(v) => updateConfig("membership.enabled", String(v))}
          />
        </div>
      </section>

      {/* 阈值配置 */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">文件大小阈值</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ThresholdInput
            label="验证码阈值"
            unit="MB"
            value={config.public.verify.mb}
            onChange={(v) => updateConfig("verify.mb", String(v))}
          />
          <ThresholdInput
            label="会员阈值"
            unit="MB"
            value={config.public.membership.mb}
            onChange={(v) => updateConfig("membership.mb", String(v))}
          />
        </div>
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
          文件 ≤ {config.public.verify.mb}MB 完全免费 ·
          {config.public.verify.enabled ? ` ${config.public.verify.mb}-${config.public.membership.mb}MB 需验证码` : ""}
          {config.public.membership.enabled ? ` · >${config.public.membership.mb}MB 需会员` : ""}
        </p>
      </section>

      {/* 每工具阈值 */}
      <ToolThresholdTable
        config={config}
        globalVerifyMb={config.public.verify.mb}
        globalMembershipMb={config.public.membership.mb}
        updateConfig={updateConfig}
        showToast={showToast}
      />

      {/* 验证码管理 */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">验证码（发给用户小程序获取）</h2>
          <button onClick={generateCodes}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
            ➕ 生成 20 个
          </button>
        </div>
        {config.codes.length === 0 ? (
          <p className="text-sm text-slate-400">暂无验证码</p>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr><th className="py-1 text-left">验证码</th><th className="py-1 text-left">有效期</th><th className="py-1 text-left">状态</th></tr>
              </thead>
              <tbody>
                {config.codes.map((cd: any) => (
                  <tr key={cd.code} className="border-t border-slate-100">
                    <td className="py-1.5 font-mono text-slate-700">{cd.code}</td>
                    <td className="py-1.5 text-slate-500">
                      {new Date(cd.expires_at).toLocaleString()}
                    </td>
                    <td className="py-1.5">
                      {cd.used
                        ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">已使用</span>
                        : cd.expires_at < Date.now()
                          ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-600">已过期</span>
                          : <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">有效</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 会员码管理 */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700">会员码</h2>
          <div className="flex items-center gap-2">
            <select
              value={createTier}
              onChange={(e) => setCreateTier(e.target.value as MembershipTier)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            >
              {MEMBERSHIP_TIERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.days > 0 ? ` (${t.days}天)` : ""}
                </option>
              ))}
            </select>
            <button onClick={createToken}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
              ➕ 创建会员码
            </button>
          </div>
        </div>
        {config.tokens.length === 0 ? (
          <p className="text-sm text-slate-400">暂无会员码</p>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 text-left">会员码</th>
                  <th className="py-1 text-left">套餐</th>
                  <th className="py-1 text-left">到期时间</th>
                  <th className="py-1 text-left">剩余</th>
                  <th className="py-1 text-left">状态</th>
                  <th className="py-1 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {config.tokens.map((t: any) => (
                  <tr key={t.token} className="border-t border-slate-100">
                    <td className="py-1.5 font-mono text-slate-700">{t.token}</td>
                    <td className="py-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${t.tierInfo?.color ?? "bg-slate-100 text-slate-600"}`}>
                        {t.tierInfo?.name ?? t.tier}
                      </span>
                    </td>
                    <td className="py-1.5 text-slate-500">{t.expiresAtFormatted ?? new Date(t.expires_at).toLocaleString()}</td>
                    <td className="py-1.5 text-slate-500">
                      {t.isForever ? "∞" : `${t.remaining}天`}
                    </td>
                    <td className="py-1.5">
                      {t.isActive
                        ? <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">有效</span>
                        : <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">失效</span>
                      }
                    </td>
                    <td className="py-1.5">
                      {t.isActive && (
                        <button
                          onClick={() => revokeToken(t.token)}
                          className="text-slate-400 hover:text-red-500"
                          title="停用"
                        >
                          停用
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 修改密码 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">修改管理员密码</h2>
        <div className="flex gap-2">
          <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
            placeholder="新密码" className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <button onClick={changePassword}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
            更新
          </button>
        </div>
      </section>
    </main>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
      <div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        {desc && <div className="text-xs text-slate-500">{desc}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-primary-600" : "bg-slate-300"
        }`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

function ThresholdInput({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number" min={1} max={200} value={value}
          onChange={(e) => onChange(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <span className="text-xs text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

function ToolThresholdTable({
  config,
  globalVerifyMb,
  globalMembershipMb,
  updateConfig,
  showToast,
}: {
  config: AdminConfig;
  globalVerifyMb: number;
  globalMembershipMb: number;
  updateConfig: (key: string, value: string) => Promise<void>;
  showToast: (msg: string) => void;
}) {
  const [rows, setRows] = useState<Record<string, { verifyMb: string; membershipMb: string }>>(() => {
    const out: Record<string, { verifyMb: string; membershipMb: string }> = {};
    for (const t of TOOLS) {
      const saved = config.public.tools?.[t.id];
      const def = DEFAULT_TOOL_THRESHOLDS[t.id];
      const defV = def?.verify ?? globalVerifyMb;
      const defM = def?.membership ?? globalMembershipMb;
      out[t.id] = {
        verifyMb: saved?.verifyMb != null && saved.verifyMb !== defV ? String(saved.verifyMb) : "",
        membershipMb: saved?.membershipMb != null && saved.membershipMb !== defM ? String(saved.membershipMb) : "",
      };
    }
    return out;
  });

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = (toolId: string, field: "verifyMb" | "membershipMb", val: string) => {
    setRows((prev) => ({ ...prev, [toolId]: { ...prev[toolId], [field]: val } }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      for (const t of TOOLS) {
        const r = rows[t.id];
        updates[`verify.mb.${t.id}`] = r.verifyMb.trim();
        updates[`membership.mb.${t.id}`] = r.membershipMb.trim();
      }
      for (const [k, v] of Object.entries(updates)) {
        await updateConfig(k, v);
      }
      setDirty(false);
      showToast("每工具阈值已保存");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (toolId: string) => {
    setRows((prev) => ({ ...prev, [toolId]: { verifyMb: "", membershipMb: "" } }));
    setDirty(true);
  };

  const resolveMb = (toolId: string, field: "verifyMb" | "membershipMb"): number => {
    const r = rows[toolId];
    const v = field === "verifyMb" ? r.verifyMb.trim() : r.membershipMb.trim();
    if (v) return parseInt(v, 10) || 1;
    const def = DEFAULT_TOOL_THRESHOLDS[toolId];
    if (def) return field === "verifyMb" ? def.verify : def.membership;
    return field === "verifyMb" ? globalVerifyMb : globalMembershipMb;
  };

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">按功能设置文件大小阈值</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            留空表示使用全局默认值（{globalVerifyMb}MB / {globalMembershipMb}MB），每个工具可单独覆盖
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "💾 保存更改"}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4 font-medium">功能</th>
              <th className="py-2 pr-4 font-medium">说明</th>
              <th className="py-2 pr-4 font-medium">验证码阈值 (MB)</th>
              <th className="py-2 pr-4 font-medium">会员阈值 (MB)</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {TOOLS.map((t) => {
              const noLimit = !t.requiresFileLimit;
              const currentV = resolveMb(t.id, "verifyMb");
              const currentM = resolveMb(t.id, "membershipMb");
              const hasCustom = !noLimit && (rows[t.id].verifyMb.trim() || rows[t.id].membershipMb.trim());
              const def = DEFAULT_TOOL_THRESHOLDS[t.id];
              const defV = def?.verify ?? globalVerifyMb;
              const defM = def?.membership ?? globalMembershipMb;
              return (
                <tr key={t.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{t.name}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${t.category === "pdf" ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"}`}>
                        {t.category === "pdf" ? "PDF" : "实用"}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-slate-500">{t.desc}</td>
                  <td className="py-2.5 pr-4">
                    {noLimit ? (
                      <span className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-600">无限制</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={rows[t.id].verifyMb}
                          placeholder={String(defV)}
                          onChange={(e) => handleChange(t.id, "verifyMb", e.target.value)}
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        />
                        {hasCustom && currentV !== defV && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                            有效 {currentV}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    {noLimit ? (
                      <span className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-600">无限制</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={rows[t.id].membershipMb}
                          placeholder={String(defM)}
                          onChange={(e) => handleChange(t.id, "membershipMb", e.target.value)}
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        />
                        {hasCustom && currentM !== defM && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                            有效 {currentM}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5">
                    {!noLimit && hasCustom && (
                      <button
                        onClick={() => handleReset(t.id)}
                        className="text-xs text-slate-400 hover:text-red-500"
                        title="清除自定义值，使用默认"
                      >
                        重置
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
