"use client";

import { useMemo, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

const BASES: { value: number; label: string; prefix: string }[] = [
  { value: 2, label: "二进制", prefix: "0b" },
  { value: 8, label: "八进制", prefix: "0o" },
  { value: 10, label: "十进制", prefix: "" },
  { value: 16, label: "十六进制", prefix: "0x" },
];

function isValidForBase(value: string, base: number): boolean {
  if (!value) return true;
  const patterns: Record<number, RegExp> = {
    2: /^-?[01]+$/,
    8: /^-?[0-7]+$/,
    10: /^-?\d+$/,
    16: /^-?[0-9a-fA-F]+$/,
  };
  return patterns[base].test(value);
}

function convertFromBase(value: string, fromBase: number): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isValidForBase(trimmed, fromBase)) return null;
  try {
    const num = parseInt(trimmed, fromBase);
    if (isNaN(num)) return null;
    return num;
  } catch {
    return null;
  }
}

export default function Page() {
  const [input, setInput] = useState<string>("255");
  const [base, setBase] = useState<number>(10);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const decimalValue = useMemo(() => convertFromBase(input, base), [input, base]);
  const isValid = input.trim() === "" || isValidForBase(input, base);

  const results = useMemo(() => {
    if (decimalValue === null) return null;
    return BASES.map((b) => {
      const str = Math.abs(decimalValue).toString(b.value).toUpperCase();
      return {
        ...b,
        display: decimalValue < 0 ? "-" + str : str,
        fullPrefix: decimalValue < 0 ? "-" + b.prefix + str : b.prefix + str,
      };
    });
  }, [decimalValue]);

  const handleCopy = async (index: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1200);
    } catch {}
  };

  const quickConvert = (val: string, b: number) => {
    setInput(val);
    setBase(b);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title="进制转换器" description="实时在二进制、八进制、十进制、十六进制之间转换数字" />

      <section className="card p-6 space-y-4 animate-slide-up">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">输入数字</label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入要转换的数字"
              className={`input-base font-mono text-lg tracking-wider ${
                !isValid ? "border-red-300 focus:border-red-400 focus:ring-red-500/10" : ""
              }`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">源进制</label>
            <select
              value={base}
              onChange={(e) => setBase(Number(e.target.value))}
              className="input-base"
            >
              {BASES.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
        </div>

        {!isValid && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            ⚠️ 输入的数字不符合当前进制的字符范围
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <span className="text-xs text-zinc-400 self-center mr-1">快速转换：</span>
          <button onClick={() => quickConvert("1010", 2)} className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-200">1010b → 10</button>
          <button onClick={() => quickConvert("777", 8)} className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-200">777o → 511</button>
          <button onClick={() => quickConvert("4096", 10)} className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-200">4096d → 1000h</button>
          <button onClick={() => quickConvert("FF", 16)} className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-200">FFh → 255</button>
        </div>
      </section>

      {results && (
        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-slide-up">
          {results.map((r, i) => {
            const isError = decimalValue !== null && !isValidForBase(input, base) && i === base - 2;
            return (
              <div key={r.value} className="card p-4 group hover:border-primary-200 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                      r.value === 2 ? "bg-blue-100 text-blue-700" :
                      r.value === 8 ? "bg-purple-100 text-purple-700" :
                      r.value === 10 ? "bg-green-100 text-green-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>{r.value}</span>
                    <span className="text-sm font-medium text-zinc-700">{r.label}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(i, r.display)}
                    className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-primary-600 transition-all"
                  >
                    {copiedIndex === i ? "✓ 已复制" : "复制"}
                  </button>
                </div>
                <div className="font-mono text-xl font-semibold text-zinc-900 break-all">
                  {r.display || "—"}
                </div>
                <div className="mt-1 font-mono text-[10px] text-zinc-400">
                  {r.fullPrefix}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="mt-6 card p-5">
        <h3 className="mb-3 text-sm font-semibold text-zinc-800">常用进制对照表</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">十进制</th>
                <th className="px-3 py-2 text-left">二进制</th>
                <th className="px-3 py-2 text-left">八进制</th>
                <th className="px-3 py-2 text-left">十六进制</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[0, 1, 2, 5, 10, 16, 32, 64, 100, 128, 255, 512, 1000, 1024, 4096, 65535].map((n) => (
                <tr key={n} className="border-t border-zinc-100">
                  <td className="px-3 py-1.5 text-zinc-700">{n}</td>
                  <td className="px-3 py-1.5 text-blue-600">{n.toString(2)}</td>
                  <td className="px-3 py-1.5 text-purple-600">{n.toString(8)}</td>
                  <td className="px-3 py-1.5 text-amber-600">{n.toString(16).toUpperCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-5 text-center text-xs text-zinc-400">
        转换基于 JavaScript parseInt，支持最大安全整数 (2^53 - 1)
      </p>
            <ToolUsage tool={getToolById("number-base")!} />
</main>
  );
}
