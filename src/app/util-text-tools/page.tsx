"use client";

import { t } from "@/i18n/dictionary";

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
  { key: "upper", label: t("util_text_tools.action_upper") },
  { key: "lower", label: t("util_text_tools.action_lower") },
  { key: "capitalize", label: t("util_text_tools.action_capitalize") },
  { key: "count", label: t("util_text_tools.action_count") },
  { key: "removeBlank", label: t("util_text_tools.action_remove_blank") },
  { key: "removeSpaces", label: t("util_text_tools.action_remove_spaces") },
  { key: "dedup", label: t("util_text_tools.action_dedup") },
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
t("util_text_tools.统计结果", {chars: stats.chars, charsNoSpace: stats.charsNoSpace, words: stats.words, lines: stats.lines})
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
      <ToolHeader title={t("util_text_tools.title")} description={t("util_text_tools.desc")} />

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
              <label className="text-xs font-medium text-zinc-500">{t("util_text_tools.label_input")}</label>
              <div className="text-[11px] text-slate-400">
                {stats.chars} {t("util_common.字符")} · {stats.words} {t("util_common.词")} · {stats.lines} {t("util_common.行")}
              </div>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={12}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-zinc-900 shadow-inner focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 scrollbar-thin"
              placeholder={t("util_text_tools.placeholder_input")}
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-500">{t("util_text_tools.label_output")}</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={swap}
                  className="text-xs text-slate-500 hover:text-primary-600"
                  title={t("util_text_tools.use_as_input")}
                >
                  ↕ {t("util_text_tools.交换")}
                </button>
                <button
                  onClick={copy}
                  disabled={!output}
                  className="text-xs text-primary-600 hover:text-primary-700 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  {copied ? t("img_ocr.copied") : t("util_random.复制结果")}
                </button>
              </div>
            </div>
            <textarea
              value={output}
              readOnly
              rows={12}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-zinc-900 shadow-inner focus:outline-none scrollbar-thin"
              placeholder={t("util_text_tools.placeholder")}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-3">
          {[
            { label: t("util_text_tools.stat_chars"), val: stats.chars },
            { label: t("util_text_tools.stat_no_space"), val: stats.charsNoSpace },
            { label: t("util_text_tools.stat_words"), val: stats.words },
            { label: t("util_text_tools.stat_lines"), val: stats.lines },
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
