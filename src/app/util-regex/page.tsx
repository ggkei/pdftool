"use client";

import { useMemo, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

export default function UtilRegexPage() {
  const [pattern, setPattern] = useState("\\d+");
  const [flags, setFlags] = useState("g");
  const [text, setText] = useState(
    "订单号: 20240815001\n金额: ￥1,299.99\n手机号: 138-0000-1234\n日期: 2024-08-15"
  );
  const [error, setError] = useState("");

  const { matches, highlighted } = useMemo(() => {
    if (!pattern) {
      setError("");
      return { matches: [] as RegExpMatchArray[], highlighted: text };
    }
    try {
      const re = new RegExp(pattern, flags);
      setError("");
      const all: RegExpMatchArray[] = [];
      let m: RegExpExecArray | null;
      if (flags.includes("g")) {
        while ((m = re.exec(text)) !== null) {
          all.push(m as RegExpMatchArray);
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      } else {
        m = re.exec(text);
        if (m) all.push(m as RegExpMatchArray);
      }

      let hl = "";
      let last = 0;
      for (const match of all) {
        const idx = match.index ?? 0;
        hl += text.slice(last, idx);
        hl += `\u0001${match[0]}\u0002`;
        last = idx + match[0].length;
      }
      hl += text.slice(last);

      return { matches: all, highlighted: hl };
    } catch (e: any) {
      setError(e.message || "正则语法错误");
      return { matches: [] as RegExpMatchArray[], highlighted: text };
    }
  }, [pattern, flags, text]);

  const toggleFlag = (f: string) => {
    setFlags((prev) => (prev.includes(f) ? prev.replace(f, "") : prev + f));
  };

  const copyAll = () => {
    const joined = matches.map((m) => m[0]).join("\n");
    navigator.clipboard.writeText(joined);
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <ToolHeader title="正则测试器" description="输入正则表达式和测试文本，实时查看匹配结果与高亮" />

      <div className="rounded-2xl bg-white/60 backdrop-blur shadow-soft border border-slate-200/70 p-6">
        <div className="grid md:grid-cols-[1fr_auto] gap-3 items-center">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <span className="font-mono text-slate-400">/</span>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="正则表达式"
              className="flex-1 bg-transparent font-mono text-sm text-zinc-900 outline-none placeholder:text-slate-400"
            />
            <span className="font-mono text-slate-400">/</span>
            <span className="font-mono text-primary-600">{flags}</span>
          </div>
          <div className="flex gap-1">
            {["g", "i", "m", "s"].map((f) => (
              <button
                key={f}
                onClick={() => toggleFlag(f)}
                className={`h-9 w-9 rounded-lg font-mono text-sm font-semibold transition ${
                  flags.includes(f)
                    ? "bg-primary-600 text-white shadow-soft"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
                title={{ g: "全局匹配", i: "忽略大小写", m: "多行模式", s: "点匹配换行" }[f]}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 grid md:grid-cols-2 gap-5">
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-500">测试文本</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-zinc-900 shadow-inner focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 scrollbar-thin"
              placeholder="在此输入要匹配的文本..."
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">
                匹配结果 <span className="text-primary-600">{matches.length}</span> 项
              </span>
              {matches.length > 0 && (
                <button
                  onClick={copyAll}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  复制全部
                </button>
              )}
            </div>
            <div className="relative h-[220px] overflow-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-zinc-900 shadow-inner scrollbar-thin">
              {highlighted ? (
                <div className="whitespace-pre-wrap break-all">
                  {highlighted.split(/([\u0001\u0002])/g).map((seg, i) =>
                    seg === "\u0001" ? null : seg === "\u0002" ? null : (
                      <span
                        key={i}
                        className={
                          highlighted.split(/[\u0001\u0002]/g).filter(Boolean)[
                            Math.floor(i / 2)
                          ] !== undefined &&
                          i % 2 === 0 &&
                          matches.some((m) => m[0] === seg)
                            ? "bg-yellow-200 text-zinc-900 rounded px-0.5"
                            : ""
                        }
                      >
                        {seg}
                      </span>
                    )
                  )}
                </div>
              ) : (
                <span className="text-slate-400">无匹配</span>
              )}
            </div>
            {matches.length > 0 && (
              <div className="mt-3 max-h-32 overflow-auto rounded-lg bg-slate-50 p-2 scrollbar-thin">
                {matches.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono">
                    <span className="w-6 text-right text-slate-400">#{i + 1}</span>
                    <span className="text-zinc-900">{m[0]}</span>
                    <span className="ml-auto text-slate-400">@{m.index}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
            <ToolUsage tool={getToolById("regex")!} />
</main>
  );
}
