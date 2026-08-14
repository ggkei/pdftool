"use client";

import { useMemo, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

type RepayType = "equal-principal-interest" | "equal-principal";

export default function Page() {
  const [amount, setAmount] = useState<number>(100);
  const [years, setYears] = useState<number>(30);
  const [annualRate, setAnnualRate] = useState<number>(3.95);
  const [type, setType] = useState<RepayType>("equal-principal-interest");

  const result = useMemo(() => {
    const P = amount * 10000;
    const r = annualRate / 12 / 100;
    const n = years * 12;
    if (P <= 0 || r < 0 || n <= 0) return null;

    if (type === "equal-principal-interest") {
      if (r === 0) {
        const monthly = P / n;
        return {
          firstMonth: monthly,
          lastMonth: monthly,
          totalPayment: P,
          totalInterest: 0,
          monthlyList: Array(n).fill(monthly),
        };
      }
      const monthly = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      const total = monthly * n;
      return {
        firstMonth: monthly,
        lastMonth: monthly,
        totalPayment: total,
        totalInterest: total - P,
        monthlyList: Array(n).fill(monthly),
      };
    } else {
      const principalPerMonth = P / n;
      const monthlyList: number[] = [];
      for (let i = 0; i < n; i++) {
        const remaining = P - principalPerMonth * i;
        const interest = remaining * r;
        monthlyList.push(principalPerMonth + interest);
      }
      const total = monthlyList.reduce((s, v) => s + v, 0);
      return {
        firstMonth: monthlyList[0],
        lastMonth: monthlyList[n - 1],
        totalPayment: total,
        totalInterest: total - P,
        monthlyList,
      };
    }
  }, [amount, years, annualRate, type]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title="房贷计算器" description="支持等额本息与等额本金两种还款方式，快速计算月供和总利息" />

      <section className="card p-6 space-y-5 animate-slide-up">
        <div>
          <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-zinc-700">
            贷款金额
            <span className="text-xs text-zinc-400">{amount} 万元</span>
          </label>
          <input
            type="number"
            min={1}
            max={10000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className="input-base"
          />
        </div>

        <div>
          <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-zinc-700">
            贷款期限
            <span className="text-xs text-zinc-400">{years} 年（{years * 12} 期）</span>
          </label>
          <input
            type="range"
            min={1}
            max={30}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="w-full accent-primary-600"
          />
          <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
            <span>1年</span><span>10年</span><span>20年</span><span>30年</span>
          </div>
        </div>

        <div>
          <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-zinc-700">
            年利率
            <span className="text-xs text-zinc-400">{annualRate}%</span>
          </label>
          <input
            type="number"
            min={0}
            max={20}
            step={0.01}
            value={annualRate}
            onChange={(e) => setAnnualRate(Number(e.target.value) || 0)}
            className="input-base"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700">还款方式</label>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1">
            <button
              onClick={() => setType("equal-principal-interest")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                type === "equal-principal-interest"
                  ? "bg-white text-primary-600 shadow-soft"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              等额本息
            </button>
            <button
              onClick={() => setType("equal-principal")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                type === "equal-principal"
                  ? "bg-white text-primary-600 shadow-soft"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              等额本金
            </button>
          </div>
        </div>
      </section>

      {result && (
        <section className="mt-6 card p-6 animate-slide-up">
          <h3 className="mb-4 font-display text-lg font-semibold text-zinc-900">计算结果</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-primary-50 p-4">
              <div className="text-xs text-primary-600">
                {type === "equal-principal-interest" ? "每月月供" : "首月月供"}
              </div>
              <div className="mt-1 font-display text-2xl font-bold text-primary-700">
                ¥ {result.firstMonth.toFixed(2)}
              </div>
              {type === "equal-principal" && (
                <div className="mt-1 text-[10px] text-zinc-500">
                  末月 ¥{result.lastMonth.toFixed(2)}，每月递减 ¥{((amount * 10000) / (years * 12) * annualRate / 12 / 100).toFixed(2)}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <div className="text-xs text-amber-600">总利息</div>
              <div className="mt-1 font-display text-2xl font-bold text-amber-700">
                ¥ {result.totalInterest.toFixed(2)}
              </div>
              <div className="mt-1 text-[10px] text-zinc-500">
                占贷款 {(result.totalInterest / (amount * 10000) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="rounded-xl bg-zinc-100 p-4">
              <div className="text-xs text-zinc-600">还款总额</div>
              <div className="mt-1 font-display text-2xl font-bold text-zinc-800">
                ¥ {result.totalPayment.toFixed(2)}
              </div>
              <div className="mt-1 text-[10px] text-zinc-500">
                本金 ¥{(amount * 10000).toFixed(2)}
              </div>
            </div>
          </div>

          {type === "equal-principal" && (
            <div className="mt-5">
              <div className="mb-2 text-xs font-medium text-zinc-600">前 12 期还款明细</div>
              <div className="rounded-lg border border-zinc-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-zinc-50 text-zinc-500 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left">期数</th>
                      <th className="px-3 py-2 text-right">月供</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.monthlyList.slice(0, 12).map((m, i) => (
                      <tr key={i} className="border-t border-zinc-100">
                        <td className="px-3 py-1.5 text-zinc-600">第 {i + 1} 期</td>
                        <td className="px-3 py-1.5 text-right font-mono text-zinc-800">¥ {m.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      <p className="mt-5 text-center text-xs text-zinc-400">
        计算结果仅供参考，实际还款以银行核算为准
      </p>
            <ToolUsage tool={getToolById("mortgage")!} />
</main>
  );
}
