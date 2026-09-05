"use client";

import { useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

interface DiffLine {
  type: "same" | "add" | "remove";
  text: string;
  lineNum?: number;
}

export default function UtilTextDiffPage() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [diff, setDiff] = useState<DiffLine[] | null>(null);

  const compare = () => {
    const leftLines = left.split("\n");
    const rightLines = right.split("\n");
    const result: DiffLine[] = [];
    const maxLen = Math.max(leftLines.length, rightLines.length);

    for (let i = 0; i < maxLen; i++) {
      const l = leftLines[i] ?? "";
      const r = rightLines[i] ?? "";
      if (l === r) {
        result.push({ type: "same", text: l, lineNum: i + 1 });
      } else {
        if (l) result.push({ type: "remove", text: l, lineNum: i + 1 });
        if (r) result.push({ type: "add", text: r, lineNum: i + 1 });
      }
    }
    setDiff(result);
  };

  const tool = getToolById("text-compare")!;

  const addCount = diff?.filter((d) => d.type === "add").length ?? 0;
  const removeCount = diff?.filter((d) => d.type === "remove").length ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      <div className="mt-8 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
            <label className="mb-2 block text-sm font-medium text-zinc-700">{t("util_text_diff.label_original")}</label>
            <textarea value={left} onChange={(e) => setLeft(e.target.value)} rows={10}
              placeholder={t("util_text_diff.placeholder_original")}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono" />
          </div>
          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
            <label className="mb-2 block text-sm font-medium text-zinc-700">{t("util_text_diff.label_modified")}</label>
            <textarea value={right} onChange={(e) => setRight(e.target.value)} rows={10}
              placeholder={t("util_text_diff.placeholder_modified")}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono" />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={compare} className="btn-primary" disabled={!left && !right}>{t("util_text_diff.对比")}</button>
          <button onClick={() => { setLeft(""); setRight(""); setDiff(null); }} className="btn-secondary">{t("util_common.clear")}</button>
        </div>

        {diff && (
          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
            <div className="mb-3 flex gap-4 text-sm">
              <span className="text-green-600">+ {addCount} {t("util_text_diff.行新增")}</span>
              <span className="text-red-600">- {removeCount} {t("util_text_diff.行删除")}</span>
            </div>
            <div className="overflow-x-auto">
              {diff.map((line, i) => (
                <div key={i} className={`flex gap-3 px-3 py-0.5 text-sm font-mono ${
                  line.type === "add" ? "bg-green-50 text-green-800" :
                  line.type === "remove" ? "bg-red-50 text-red-800" : ""
                }`}>
                  <span className="w-8 text-right text-xs text-zinc-400 flex-shrink-0">{line.lineNum ?? ""}</span>
                  <span className="flex-shrink-0">{line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}</span>
                  <span className="whitespace-pre-wrap break-all">{line.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
