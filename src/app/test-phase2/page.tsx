"use client";

import { useState, useEffect } from "react";

export default function TestPhase2() {
  const [adCount, setAdCount] = useState(0);
  const [lastCode, setLastCode] = useState("");
  const [membershipCode, setMembershipCode] = useState("");
  const [rewarded, setRewarded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [testCode, setTestCode] = useState("");
  const [testToken, setTestToken] = useState("");
  const [verifyResult, setVerifyResult] = useState("");
  const [tokenResult, setTokenResult] = useState("");
  const [storageInfo, setStorageInfo] = useState("");

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("zh-CN");
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 20));
  };

  const refreshStorage = () => {
    const v = localStorage.getItem("pdftool.verified");
    const vAt = localStorage.getItem("pdftool.verified_at");
    const m = localStorage.getItem("pdftool.membership");
    const mExp = localStorage.getItem("pdftool.membership_expiry");
    let info = "localStorage:\n";
    info += `  verified: ${v || "(空)"}\n`;
    if (vAt) {
      const elapsed = Math.floor((Date.now() - parseInt(vAt)) / 1000);
      const remaining = 900 - elapsed;
      info += `  verified_at: ${vAt} (${elapsed}s ago, ${remaining > 0 ? remaining + "s remaining" : "EXPIRED"})\n`;
    }
    info += `  membership: ${m || "(空)"}\n`;
    if (mExp && parseInt(mExp) > 0) {
      const remaining = Math.floor((parseInt(mExp) - Date.now()) / 1000);
      info += `  membership_expiry: ${mExp} (${remaining > 0 ? remaining + "s remaining" : "EXPIRED"})\n`;
    }
    setStorageInfo(info);
  };

  useEffect(() => {
    refreshStorage();
    const interval = setInterval(refreshStorage, 5000);
    return () => clearInterval(interval);
  }, []);

  // Simulate ad success
  const watchAd = async () => {
    setLoading(true);
    addLog("广告播放中...");
    try {
      const res = await fetch("/api/wechat/ad-reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: "test-user@local",
          identifierType: "email",
          adUnitId: "adunit_test_001",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAdCount(data.adCount);
        setLastCode(data.code);
        addLog(`广告成功! 验证码: ${data.code} (第${data.adCount}次)`);
        if (data.rewardGranted && data.membershipCode) {
          setMembershipCode(data.membershipCode);
          setRewarded(true);
          addLog(`🎉 24小时会员码: ${data.membershipCode}`);
        }
        if (data.mode === "in-memory") {
          addLog("(使用内存模式 - 无数据库连接)");
        }
      } else {
        addLog(`失败: ${data.reason}`);
      }
    } catch (e: any) {
      addLog(`错误: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Test verification code
  const testVerifyCode = async () => {
    if (!testCode.trim()) return;
    setVerifyResult("验证中...");
    try {
      const res = await fetch("/api/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: testCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (data.ok) {
        // Simulate frontend saving verify state
        localStorage.setItem("pdftool.verified", "1");
        localStorage.setItem("pdftool.verified_at", String(Date.now()));
        refreshStorage();
        setVerifyResult(`✅ 验证成功! 15分钟内有效 ${data.mode ? "(内存模式)" : ""}`);
        addLog(`验证码 ${testCode} 验证成功`);
      } else {
        setVerifyResult(`❌ ${data.reason}`);
      }
    } catch (e: any) {
      setVerifyResult(`❌ ${e.message}`);
    }
  };

  // Test TEMP24 membership code
  const testMembership = async () => {
    if (!testToken.trim()) return;
    setTokenResult("验证中...");
    try {
      const res = await fetch("/api/verify-membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: testToken.trim() }),
      });
      const data = await res.json();
      if (data.ok && data.tempExpiry) {
        // Simulate frontend saving membership with expiry
        localStorage.setItem("pdftool.membership", "1");
        localStorage.setItem("pdftool.membership_expiry", String(data.tempExpiry));
        refreshStorage();
        const hours = Math.floor((data.tempExpiry - Date.now()) / 3600000);
        setTokenResult(`✅ 24小时会员激活! 有效期约 ${hours} 小时`);
        addLog(`会员码 ${testToken} 激活成功，24小时有效`);
      } else if (data.ok && data.bound) {
        setTokenResult(`✅ 会员码已绑定到账号`);
      } else if (data.ok && data.needLogin) {
        setTokenResult(`⚠️ 会员码有效，需要登录后绑定`);
      } else {
        setTokenResult(`❌ ${data.reason}`);
      }
    } catch (e: any) {
      setTokenResult(`❌ ${e.message}`);
    }
  };

  const clearStorage = () => {
    localStorage.removeItem("pdftool.verified");
    localStorage.removeItem("pdftool.verified_at");
    localStorage.removeItem("pdftool.membership");
    localStorage.removeItem("pdftool.membership_expiry");
    refreshStorage();
    addLog("localStorage 已清空");
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-2xl font-bold text-zinc-900">Phase 2 测试页面</h1>
        <p className="mb-6 text-sm text-zinc-500">模拟广告观看 → 验证码 → 3次奖励24h会员码 完整流程</p>

        {/* Ad Simulation */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-zinc-800">1. 模拟看广告</h2>
          <p className="mb-3 text-xs text-zinc-500">每次点击模拟一次广告观看成功，自动生成验证码。12小时内满3次自动发放24h会员码。</p>
          <button
            onClick={watchAd}
            disabled={loading}
            className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? "广告播放中..." : "▶ 播放广告"}
          </button>
          <div className="mt-3 flex gap-4 text-sm">
            <span className="text-zinc-600">广告成功次数: <b className="text-brand-600">{adCount}/3</b></span>
            {lastCode && <span className="text-zinc-600">最新验证码: <b className="font-mono text-brand-600">{lastCode}</b></span>}
          </div>
          {rewarded && membershipCode && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-800">🎉 24小时会员码（复制后去测试验证）:</p>
              <p className="mt-1 font-mono text-lg font-bold text-amber-900">{membershipCode}</p>
            </div>
          )}
        </div>

        {/* Verify Code Test */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-zinc-800">2. 测试验证码（8-20MB文件解锁）</h2>
          <div className="flex gap-2">
            <input
              value={testCode}
              onChange={e => setTestCode(e.target.value.toUpperCase())}
              placeholder="输入验证码"
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
            />
            <button onClick={testVerifyCode} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-900">
              验证
            </button>
          </div>
          {verifyResult && <p className="mt-2 text-sm">{verifyResult}</p>}
        </div>

        {/* Membership Code Test */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-zinc-800">3. 测试24h会员码（20MB+文件解锁）</h2>
          <div className="flex gap-2">
            <input
              value={testToken}
              onChange={e => setTestToken(e.target.value)}
              placeholder="输入 TEMP24-XXXXXXXX"
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
            />
            <button onClick={testMembership} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600">
              激活
            </button>
          </div>
          {tokenResult && <p className="mt-2 text-sm">{tokenResult}</p>}
        </div>

        {/* Storage Info */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-800">4. localStorage 状态</h2>
            <button onClick={refreshStorage} className="text-xs text-zinc-500 hover:text-zinc-700">刷新</button>
          </div>
          <pre className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 whitespace-pre-wrap">{storageInfo}</pre>
          <button onClick={clearStorage} className="mt-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
            清空 localStorage
          </button>
        </div>

        {/* Logs */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-zinc-800">操作日志</h2>
          <div className="space-y-1">
            {logs.length === 0 ? (
              <p className="text-xs text-zinc-400">暂无操作记录</p>
            ) : (
              logs.map((log, i) => (
                <p key={i} className="text-xs text-zinc-600 font-mono">{log}</p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}