"use client";

import { t } from "@/i18n/dictionary";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

function getJsonErrorPosition(text: string, errorMsg: string): { line: number; col: number } | null {
  const match = errorMsg.match(/position\s+(\d+)/i);
  if (!match) return null;
  const pos = parseInt(match[1], 10);
  let line = 1;
  let col = 1;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text[i] === "\n") { line++; col = 1; } else { col++; }
  }
  return { line, col };
}

function tryParseJson(text: string): { ok: true; data: any } | { ok: false; error: string; pos: { line: number; col: number } | null } {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (e: any) {
    return { ok: false, error: e.message, pos: getJsonErrorPosition(text, e.message) };
  }
}

export default function Page() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [errorPos, setErrorPos] = useState<{ line: number; col: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const lineCount = useMemo(() => {
    if (!output) return 0;
    return output.split("\n").length;
  }, [output]);

  const charCount = useMemo(() => output.length, [output]);
  const byteSize = useMemo(() => new Blob([output]).size, [output]);

  function doFormat() {
    const text = input.trim();
    if (!text) { setStatus("idle"); setOutput(""); return; }
    const r = tryParseJson(text);
    if (r.ok) {
      setOutput(JSON.stringify(r.data, null, 2));
      setStatus("ok"); setErrorMsg(""); setErrorPos(null);
    } else {
      setStatus("error"); setErrorMsg(r.error); setErrorPos(r.pos);
    }
  }

  function doMinify() {
    const text = input.trim();
    if (!text) { setStatus("idle"); setOutput(""); return; }
    const r = tryParseJson(text);
    if (r.ok) {
      setOutput(JSON.stringify(r.data));
      setStatus("ok"); setErrorMsg(""); setErrorPos(null);
    } else {
      setStatus("error"); setErrorMsg(r.error); setErrorPos(r.pos);
    }
  }

  function doValidate() {
    const text = input.trim();
    if (!text) { setStatus("idle"); setOutput(""); return; }
    const r = tryParseJson(text);
    if (r.ok) {
      setOutput(t("util_json_format.valid_msg") + "\n\n" + t("util_json_format.type_label") + ": " + typeof r.data + (Array.isArray(r.data) ? " (array)" : "") +
        t("util_json_format.顶层键数量") + (r.data && typeof r.data === "object" && !Array.isArray(r.data) ? Object.keys(r.data).length : "N/A"));
      setStatus("ok"); setErrorMsg(""); setErrorPos(null);
    } else {
      setStatus("error"); setErrorMsg(r.error); setErrorPos(r.pos);
    }
  }

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function clearAll() {
    setInput(""); setOutput(""); setStatus("idle"); setErrorMsg(""); setErrorPos(null);
  }

  function sampleInput() {
    setInput('{\n  "name": "json-formatter",\n  "version": "1.0.0",\n  "features": ["format", "minify", "validate"],\n  "active": true,\n  "count": 42\n}');
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-10 animate-fade-in">
        <Link href="/" className="group mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-brand-600">
          <svg className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("common.back_to_tools")}
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">{t("util_json_format.title")}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">{t("util_json_format.description")}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/70 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-600 text-xs font-semibold">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </span>
              <h2 className="text-sm font-semibold text-zinc-800">{t("util_json_format.input_title")}</h2>
              <span className="text-[11px] text-zinc-400">{t("common.n_chars", {n: input.length})}</span>
            </div>
            <button onClick={sampleInput} className="text-xs text-brand-600 hover:text-brand-700 font-medium">{t("util_common.fill_sample")}</button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("util_json_format.placeholder_input")}
            spellCheck={false}
            className="h-[420px] w-full resize-none bg-transparent px-5 py-4 font-mono text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-none scrollbar-thin"
          />
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-semibold ${
                status === "ok" ? "bg-green-50 text-green-600" :
                status === "error" ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-400"
              }`}>
                {status === "ok" ? (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : status === "error" ? (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </span>
              <h2 className="text-sm font-semibold text-zinc-800">{t("util_json_format.output_title")}</h2>
              {status === "ok" && (
                <span className="text-[11px] text-green-600 font-medium">{t("util_json_format.valid_msg")}</span>
              )}
              {status === "error" && (
                <span className="text-[11px] text-red-600 font-medium">{t("util_json_format.syntax_error")}</span>
              )}
            </div>
            <button onClick={copyOutput} disabled={!output}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:bg-slate-50 disabled:opacity-40">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? t("util_common.copied") : t("util_common.copy")}
            </button>
          </div>

          {status === "error" && errorMsg && (
            <div className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <div className="font-medium">{t("util_json_format.error_info")}</div>
              <div className="mt-1 font-mono">{errorMsg}</div>
              {errorPos && (
                <div className="mt-1 text-red-500">
                  {t("util_json_format.error_position", {line: errorPos.line, col: errorPos.col})}
                </div>
              )}
            </div>
          )}

          <textarea
            value={output}
            readOnly
            placeholder={t("util_json_format.placeholder_output")}
            spellCheck={false}
            className="h-[420px] w-full resize-none bg-transparent px-5 py-4 font-mono text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-none scrollbar-thin"
          />
        </section>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200/70 bg-white shadow-soft p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={doFormat}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-brand-700 hover:shadow-glow active:scale-[0.98] transition-all">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            {t("util_json_format.格式化")}
          </button>
          <button onClick={doMinify}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-soft hover:border-slate-300 hover:bg-slate-50 transition-all">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            {t("util_json_format.压缩")}
          </button>
          <button onClick={doValidate}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-soft hover:border-slate-300 hover:bg-slate-50 transition-all">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t("util_json_format.校验")}
          </button>
          <div className="ml-auto flex items-center gap-3 text-xs text-zinc-400">
            {output && (
              <>
                <span>{lineCount} {t("util_common.行")}</span>
                <span>{charCount} {t("util_common.字符")}</span>
                <span>{byteSize} {t("util_common.字节")}</span>
              </>
            )}
            <button onClick={clearAll} className="text-zinc-400 hover:text-red-500 transition-colors font-medium">{t("util_common.clear")}</button>
          </div>
        </div>
      </div>
            <ToolUsage tool={getToolById("json-format")!} />
</main>
  );
}
