"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function formatDate(ts: number, isMs: boolean): string {
  const d = new Date(isMs ? ts : ts * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDateReadable(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function getTimezoneOffsetStr(): string {
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export default function Page() {
  const [nowSec, setNowSec] = useState(Math.floor(Date.now() / 1000));
  const [nowMs, setNowMs] = useState(Date.now());
  const [nowReadable, setNowReadable] = useState(formatDateReadable(new Date()));
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [tsInput, setTsInput] = useState("");
  const [tsIsMs, setTsIsMs] = useState(false);
  const [tsResult, setTsResult] = useState("");
  const [tsError, setTsError] = useState("");

  const [dtInput, setDtInput] = useState("");
  const [dtResult, setDtResult] = useState<{ sec: string; ms: string } | null>(null);
  const [dtError, setDtError] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setNowSec(Math.floor(d.getTime() / 1000));
      setNowMs(d.getTime());
      setNowReadable(formatDateReadable(d));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  function handleTsToDate() {
    setTsError(""); setTsResult("");
    if (!tsInput.trim()) return;
    const num = Number(tsInput.trim());
    if (isNaN(num) || !Number.isFinite(num)) {
      setTsError("请输入有效的数字时间戳"); return;
    }
    const ms = tsIsMs ? num : num * 1000;
    if (ms < -8640000000000000 || ms > 8640000000000000) {
      setTsError("时间戳超出有效范围"); return;
    }
    const d = new Date(ms);
    setTsResult(`${formatDateReadable(d)} (本地)\n${d.toISOString()} (UTC)`);
  }

  function handleDateToTs() {
    setDtError(""); setDtResult(null);
    if (!dtInput) return;
    const d = new Date(dtInput);
    if (isNaN(d.getTime())) { setDtError("无效的日期格式"); return; }
    setDtResult({ sec: String(Math.floor(d.getTime() / 1000)), ms: String(d.getTime()) });
  }

  async function copy(key: string, text: string) {
    await copyText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-10 animate-fade-in">
        <Link href="/" className="group mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-brand-600">
          <svg className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
          </svg>
          返回工具箱
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">时间戳转换</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">Unix 时间戳与日期时间互转，秒/毫秒自由切换</p>
      </header>

      <section className="mb-6 rounded-2xl border border-brand-200/70 bg-gradient-to-br from-brand-50/80 to-white shadow-soft p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          <h2 className="text-sm font-semibold text-zinc-800">当前时间（实时更新）</h2>
          <span className="text-[11px] text-zinc-400">{getTimezoneOffsetStr()}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] text-zinc-500 mb-1">秒级时间戳</div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg font-semibold text-zinc-800">{nowSec}</span>
              <button onClick={() => copy("nowSec", String(nowSec))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-zinc-500 hover:bg-slate-50">
                {copiedKey === "nowSec" ? "已复制" : "复制"}
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] text-zinc-500 mb-1">毫秒级时间戳</div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg font-semibold text-zinc-800">{nowMs}</span>
              <button onClick={() => copy("nowMs", String(nowMs))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-zinc-500 hover:bg-slate-50">
                {copiedKey === "nowMs" ? "已复制" : "复制"}
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] text-zinc-500 mb-1">本地时间</div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-zinc-800">{nowReadable}</span>
              <button onClick={() => copy("nowReadable", nowReadable)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-zinc-500 hover:bg-slate-50">
                {copiedKey === "nowReadable" ? "已复制" : "复制"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/70 bg-white shadow-soft p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-800">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-600 text-xs">→</span>
            时间戳 → 日期
          </h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={tsInput}
                onChange={(e) => setTsInput(e.target.value)}
                placeholder="输入时间戳，例如 1700000000"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-zinc-800 placeholder:text-zinc-300 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all"
              />
              <button onClick={handleTsToDate}
                className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-brand-700 active:scale-[0.98] transition-all">
                转换
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">单位</span>
              <div className="flex rounded-lg bg-slate-100 p-1 text-xs">
                <button onClick={() => setTsIsMs(false)} className={`rounded-md px-3 py-1 ${!tsIsMs ? "bg-white text-brand-600 shadow-sm font-medium" : "text-slate-500"}`}>秒</button>
                <button onClick={() => setTsIsMs(true)} className={`rounded-md px-3 py-1 ${tsIsMs ? "bg-white text-brand-600 shadow-sm font-medium" : "text-slate-500"}`}>毫秒</button>
              </div>
            </div>
            {tsError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{tsError}</div>}
            {tsResult && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <pre className="font-mono text-[13px] text-zinc-700 whitespace-pre-wrap break-all">{tsResult}</pre>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white shadow-soft p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-800">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-600 text-xs">←</span>
            日期 → 时间戳
          </h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="datetime-local"
                step="1"
                value={dtInput}
                onChange={(e) => setDtInput(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-zinc-800 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all"
              />
              <button onClick={handleDateToTs}
                className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-brand-700 active:scale-[0.98] transition-all">
                转换
              </button>
            </div>
            <button onClick={() => setDtInput(formatDate(Date.now(), true))}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium">填入当前时间</button>
            {dtError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{dtError}</div>}
            {dtResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                  <div>
                    <div className="text-[11px] text-zinc-500">秒</div>
                    <div className="font-mono text-sm font-semibold text-zinc-800">{dtResult.sec}</div>
                  </div>
                  <button onClick={() => copy("dtSec", dtResult.sec)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-zinc-500 hover:bg-slate-50">
                    {copiedKey === "dtSec" ? "已复制" : "复制"}
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                  <div>
                    <div className="text-[11px] text-zinc-500">毫秒</div>
                    <div className="font-mono text-sm font-semibold text-zinc-800">{dtResult.ms}</div>
                  </div>
                  <button onClick={() => copy("dtMs", dtResult.ms)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-zinc-500 hover:bg-slate-50">
                    {copiedKey === "dtMs" ? "已复制" : "复制"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
            <ToolUsage tool={getToolById("timestamp")!} />
</main>
  );
}
