"use client";

import { useEffect, useMemo, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

interface Currency {
  code: string;
  name: string;
  flag: string;
}

const CURRENCIES: Currency[] = [
  { code: "CNY", name: "人民币", flag: "🇨🇳" },
  { code: "USD", name: "美元", flag: "🇺🇸" },
  { code: "EUR", name: "欧元", flag: "🇪🇺" },
  { code: "JPY", name: "日元", flag: "🇯🇵" },
  { code: "GBP", name: "英镑", flag: "🇬🇧" },
  { code: "HKD", name: "港币", flag: "🇭🇰" },
  { code: "AUD", name: "澳元", flag: "🇦🇺" },
  { code: "CAD", name: "加元", flag: "🇨🇦" },
  { code: "KRW", name: "韩元", flag: "🇰🇷" },
  { code: "SGD", name: "新加坡元", flag: "🇸🇬" },
];

const FALLBACK_RATES_USD: Record<string, number> = {
  CNY: 7.25, USD: 1, EUR: 0.92, JPY: 155.8, GBP: 0.79, HKD: 7.81,
  AUD: 1.52, CAD: 1.36, KRW: 188.7, SGD: 1.35,
};

interface RateData {
  rates: Record<string, number>;
  base: string;
  date: string;
  fetchedAt: number;
  cached?: boolean;
  stale?: boolean;
  fallback?: boolean;
}

export default function Page() {
  const [data, setData] = useState<RateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState<string>("1000");
  const [from, setFrom] = useState<string>("CNY");
  const [to, setTo] = useState<string>("USD");

  useEffect(() => {
    let mounted = true;
    fetch("/api/currency?base=USD")
      .then((r) => r.json())
      .then((d) => {
        if (mounted) setData(d);
      })
      .catch(() => {
        if (mounted) {
          setData({
            rates: FALLBACK_RATES_USD,
            base: "USD",
            date: new Date().toISOString().slice(0, 10),
            fetchedAt: Date.now(),
            fallback: true,
          });
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const getRate = (code: string): number => {
    if (!data) return FALLBACK_RATES_USD[code] ?? 1;
    if (data.base === code) return 1;
    if (data.rates[code]) return data.rates[code];
    return FALLBACK_RATES_USD[code] ?? 1;
  };

  const result = useMemo(() => {
    const num = parseFloat(amount);
    if (isNaN(num) || num < 0) return null;
    const fromCur = CURRENCIES.find((c) => c.code === from)!;
    const toCur = CURRENCIES.find((c) => c.code === to)!;
    const fromRate = getRate(from);
    const toRate = getRate(to);
    const converted = (num / fromRate) * toRate;
    const rate = toRate / fromRate;
    return { converted, fromCur, toCur, rate };
  }, [amount, from, to, data]);

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
  };

  const refresh = () => {
    setLoading(true);
    setData(null);
    fetch("/api/currency?base=USD")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {
        setData({
          rates: FALLBACK_RATES_USD,
          base: "USD",
          date: new Date().toISOString().slice(0, 10),
          fetchedAt: Date.now(),
          fallback: true,
        });
      })
      .finally(() => setLoading(false));
  };

  const sourceLabel = data?.fallback
    ? "静态参考汇率"
    : data?.stale
    ? "缓存汇率（API 不可用）"
    : data?.cached
    ? "缓存汇率"
    : "实时汇率";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title="货币转换器" description="实时汇率换算，数据每分钟更新" />

      <section className="card p-6 space-y-5 animate-slide-up">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">金额</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-base font-display text-lg"
          />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">源货币</label>
            <select value={from} onChange={(e) => setFrom(e.target.value)} className="input-base">
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSwap}
            className="mb-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white shadow-soft hover:bg-primary-700 active:scale-95 transition-transform"
            title="交换货币"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">目标货币</label>
            <select value={to} onChange={(e) => setTo(e.target.value)} className="input-base">
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {loading && (
        <section className="mt-6 card p-10 text-center text-zinc-400 animate-pulse">
          正在获取最新汇率...
        </section>
      )}

      {!loading && result && (
        <section className="mt-6 card p-6 animate-slide-up">
          <div className="rounded-2xl bg-gradient-to-br from-primary-50 to-purple-50 p-6 text-center">
            <div className="text-xs text-zinc-500 mb-2">转换结果</div>
            <div className="font-display text-3xl sm:text-4xl font-bold text-primary-700 break-all">
              {result.converted.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
              {result.toCur.code}
            </div>
            <div className="mt-2 text-sm text-zinc-500">
              {amount} {result.fromCur.code} = {result.converted.toFixed(4)} {result.toCur.code}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-zinc-50 p-3">
              <div className="text-[10px] text-zinc-500">
                {result.fromCur.flag} {result.fromCur.name}
              </div>
              <div className="font-mono text-zinc-700">
                1 {result.fromCur.code} = {result.rate.toFixed(6)} {result.toCur.code}
              </div>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <div className="text-[10px] text-zinc-500">
                {result.toCur.flag} {result.toCur.name}
              </div>
              <div className="font-mono text-zinc-700">
                1 {result.toCur.code} = {(1 / result.rate).toFixed(6)} {result.fromCur.code}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg bg-primary-50 px-4 py-2.5 text-xs">
            <span className="text-primary-700">
              <span
                className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${
                  data?.fallback ? "bg-amber-500" : data?.stale ? "bg-orange-500" : "bg-green-500 animate-pulse"
                }`}
              />
              {sourceLabel} · {data?.date || new Date().toISOString().slice(0, 10)}
            </span>
            <button
              onClick={refresh}
              className="text-primary-600 hover:text-primary-800 font-medium inline-flex items-center gap-1"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              刷新
            </button>
          </div>
        </section>
      )}

      {!loading && data && (
        <section className="mt-6 card p-5">
          <h3 className="mb-3 text-sm font-semibold text-zinc-800">
            常见汇率表（以 1 USD 为基准）
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {CURRENCIES.filter((c) => c.code !== "USD").map((c) => {
              const r = getRate(c.code);
              return (
                <div
                  key={c.code}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2"
                >
                  <span className="text-zinc-600">
                    {c.flag} {c.code}
                  </span>
                  <span className="font-mono text-zinc-800">{r.toFixed(4)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="mt-5 text-center text-xs text-zinc-400">
        数据来源：Frankfurter（欧洲央行），仅供参考，实际交易以银行柜台价格为准
      </p>
      <ToolUsage tool={getToolById("currency")!} />
    </main>
  );
}
