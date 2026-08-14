"use client";

import { useMemo, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

type Action =
  | "upper"
  | "lower"
  | "capitalize"
  | "count"
  | "removeBlank"
  | "removeSpaces"
  | "dedup";

const LABELS: { key: Action; label: string }[] = [
  { key: "upper", label: "转大写" },
  { key: "lower", label: "转小写" },
  { key: "capitalize", label: "首字母大写" },
  { key: "count", label: "统计字数" },
  { key: "removeBlank", label: "去除空行" },
  { key: "removeSpaces", label: "去除空格" },
  { key: "dedup", label: "去重行" },
];

function capitalize(text: string): string {
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}

function removeBlank(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .join("\n");
}

function removeSpaces(text: string): string {
  return text.replace(/\s+/g, "");
}

function dedup(text: string): string {
  const seen = new Set<string>();
  return text
    .split(/\r?\n/)
    .filter((l) => {
      const k = l.trim();
      if (!k) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join("\n");
}

function apply(text: string, action: Action): string {
  switch (action) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "capitalize":
      return capitalize(text);
    case "removeBlank":
      return removeBlank(text);
    case "removeSpaces":
      return removeSpaces(text);
    case "dedup":
      return dedup(text);
    default:
      return text;
  }
}

export default function UtilTextToolsPage() {
  const [input, setInput] = useState(
    `Hello World\n  this is a test  \n\nLine one\nLine two\nLine one\nHELLO WORLD\nfoo bar baz`
  );
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    const chars = input.length;
    const charsNoSpace = input.replace(/\s/g, "").length;
    const words = input.trim() ? input.trim().split(/\s+/).length : 0;
    const lines = input ? input.split(/\r?\n/).length : 0;
    return { chars, charsNoSpace, words, lines };
  }, [input]);

  const runAction = (a: Action) => {
    if (a === "count") {
      setOutput(
        `字符总数: ${stats.chars}\n不含空白: ${stats.charsNoSpace}\n词数: ${stats.words}\n行数: ${stats.lines}`
      );
      return;
    }
    setOutput(apply(input, a));
  };

  const copy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const swap = () => {
    setInput(output);
    setOutput("");
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <ToolHeader title="文本工具箱" description="大小写转换、字数统计、去空行、去空格、行去重" />

      <div className="rounded-2xl bg-white/60 backdrop-blur shadow-soft border border-slate-200/70 p-6">
        <div className="flex flex-wrap gap-2">
          {LABELS.map((item) => (
            <button
              key={item.key}
              onClick={() => runAction(item.key)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 shadow-soft transition hover:border-primary-400 hover:text-primary-600 hover:shadow-card active:scale-[0.98]"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-500">输入文本</label>
              <div className="text-[11px] text-slate-400">
                {stats.chars} 字符 · {stats.words} 词 · {stats.lines} 行
              </div>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={12}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-zinc-900 shadow-inner focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 scrollbar-thin"
              placeholder="在这里输入或粘贴文本..."
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-500">处理结果</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={swap}
                  className="text-xs text-slate-500 hover:text-primary-600"
                  title="将结果作为新的输入"
                >
                  ↕ 交换
                </button>
                <button
                  onClick={copy}
                  disabled={!output}
                  className="text-xs text-primary-600 hover:text-primary-700 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  {copied ? "✓ 已复制" : "复制结果"}
                </button>
              </div>
            </div>
            <textarea
              value={output}
              readOnly
              rows={12}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-zinc-900 shadow-inner focus:outline-none scrollbar-thin"
              placeholder="点击上方按钮查看处理结果..."
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-3">
          {[
            { label: "总字符", val: stats.chars },
            { label: "不含空白", val: stats.charsNoSpace },
            { label: "词数", val: stats.words },
            { label: "行数", val: stats.lines },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-slate-50 p-3 text-center">
              <div className="text-[11px] text-slate-500">{s.label}</div>
              <div className="mt-0.5 text-lg font-semibold text-zinc-900">{s.val}</div>
            </div>
          ))}
        </div>
      </div>
            <ToolUsage tool={getToolById("text-tools")!} />
</main>
  );
}
