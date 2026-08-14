"use client";

import { useEffect, useRef, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

type Mode = "number" | "draw";

function randInt(min: number, max: number): number {
  const range = max - min + 1;
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return min + (arr[0] % range);
}

function pickOne<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  const idx = randInt(0, arr.length - 1);
  return arr[idx];
}

export default function UtilRandomPage() {
  const [mode, setMode] = useState<Mode>("number");

  const [minVal, setMinVal] = useState(1);
  const [maxVal, setMaxVal] = useState(100);
  const [count, setCount] = useState(5);
  const [unique, setUnique] = useState(true);
  const [sorted, setSorted] = useState(false);
  const [results, setResults] = useState<number[]>([]);

  const [names, setNames] = useState("张三\n李四\n王五\n赵六\n钱七\n孙八");
  const [picked, setPicked] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const rollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doGenNumber = () => {
    const lo = Math.min(minVal, maxVal);
    const hi = Math.max(minVal, maxVal);
    const totalNums = hi - lo + 1;
    const n = Math.max(1, Math.min(count, unique ? totalNums : 1000));

    if (unique && n > totalNums) {
      const range: number[] = [];
      for (let i = lo; i <= hi; i++) range.push(i);
      const arr = new Uint32Array(range.length);
      crypto.getRandomValues(arr);
      for (let i = range.length - 1; i > 0; i--) {
        const j = arr[i] % (i + 1);
        [range[i], range[j]] = [range[j], range[i]];
      }
      const slice = range.slice(0, n);
      setResults(sorted ? [...slice].sort((a, b) => a - b) : slice);
      return;
    }

    const out: number[] = [];
    if (unique) {
      const used = new Set<number>();
      while (out.length < n) {
        const v = randInt(lo, hi);
        if (!used.has(v)) {
          used.add(v);
          out.push(v);
        }
      }
    } else {
      for (let i = 0; i < n; i++) out.push(randInt(lo, hi));
    }
    setResults(sorted ? [...out].sort((a, b) => a - b) : out);
  };

  const doDraw = () => {
    const list = names
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) return;

    setRolling(true);
    let ticks = 0;
    const totalTicks = 20;
    if (rollTimerRef.current) clearInterval(rollTimerRef.current);
    rollTimerRef.current = setInterval(() => {
      const preview = pickOne(list);
      setPicked(preview);
      ticks++;
      if (ticks >= totalTicks) {
        if (rollTimerRef.current) clearInterval(rollTimerRef.current);
        const final = pickOne(list);
        setPicked(final);
        setRolling(false);
      }
    }, 60);
  };

  useEffect(() => {
    return () => {
      if (rollTimerRef.current) clearInterval(rollTimerRef.current);
    };
  }, []);

  const copyResults = () => {
    navigator.clipboard.writeText(results.join("\n"));
  };

  const copyPicked = () => {
    if (picked) navigator.clipboard.writeText(picked);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ToolHeader title="随机生成器" description="随机数生成与随机抽签，支持批量与不重复选项" />

      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setMode("number")}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
            mode === "number"
              ? "bg-primary-600 text-white shadow-soft"
              : "border border-slate-200 bg-white text-zinc-700 hover:border-primary-400 hover:text-primary-600"
          }`}
        >
          🎲 随机数
        </button>
        <button
          onClick={() => setMode("draw")}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
            mode === "draw"
              ? "bg-primary-600 text-white shadow-soft"
              : "border border-slate-200 bg-white text-zinc-700 hover:border-primary-400 hover:text-primary-600"
          }`}
        >
          🎯 随机抽签
        </button>
      </div>

      <div className="rounded-2xl bg-white/60 backdrop-blur shadow-soft border border-slate-200/70 p-6">
        {mode === "number" && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">最小值</label>
                <input
                  type="number"
                  value={minVal}
                  onChange={(e) => setMinVal(+e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-zinc-900 shadow-inner focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">最大值</label>
                <input
                  type="number"
                  value={maxVal}
                  onChange={(e) => setMaxVal(+e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-zinc-900 shadow-inner focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">生成数量</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, +e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-zinc-900 shadow-inner focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10"
                />
              </div>
            </div>

            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={unique}
                  onChange={(e) => setUnique(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-zinc-700">不重复</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sorted}
                  onChange={(e) => setSorted(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-zinc-700">排序显示</span>
              </label>
            </div>

            <button
              onClick={doGenNumber}
              className="w-full rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-primary-700 hover:shadow-glow active:scale-[0.98] transition"
            >
              🎲 生成随机数
            </button>

            {results.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">
                    共 {results.length} 个结果
                  </span>
                  <button
                    onClick={copyResults}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    复制全部
                  </button>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-inner min-h-[80px]">
                  <div className="flex flex-wrap gap-2">
                    {results.map((n, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center justify-center rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-sm font-mono font-semibold text-zinc-800 shadow-soft"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === "draw" && (
          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                候选名单（每行一个）
              </label>
              <textarea
                value={names}
                onChange={(e) => setNames(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-inner focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 scrollbar-thin"
                placeholder="张三&#10;李四&#10;王五"
              />
              <div className="mt-1 text-[11px] text-slate-400">
                共 {names.split(/\r?\n/).filter((s) => s.trim()).length} 位候选人
              </div>
            </div>

            <button
              onClick={doDraw}
              disabled={rolling || !names.trim()}
              className="w-full rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-primary-700 hover:shadow-glow active:scale-[0.98] transition disabled:bg-slate-300 disabled:shadow-none"
            >
              {rolling ? "抽取中..." : "🎯 开始抽签"}
            </button>

            {(picked || rolling) && (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary-300 bg-primary-50/50 py-10">
                <div className="text-xs text-primary-600 mb-2">🎉 幸运儿</div>
                <div
                  className={`text-4xl font-bold font-display text-primary-700 transition-all ${
                    rolling ? "animate-pulse-soft" : "animate-scale-in"
                  }`}
                >
                  {picked || "—"}
                </div>
                {picked && !rolling && (
                  <button
                    onClick={copyPicked}
                    className="mt-4 rounded-lg border border-primary-200 bg-white px-4 py-1.5 text-xs text-primary-700 hover:bg-primary-50"
                  >
                    复制结果
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
            <ToolUsage tool={getToolById("random")!} />
</main>
  );
}
