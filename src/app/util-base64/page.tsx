"use client";

import Link from "next/link";
import { useState } from "react";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

function b64encode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64decode(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export default function Page() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"utf8" | "latin1">("utf8");

  function doEncode() {
    try {
      const result = mode === "utf8" ? b64encode(input) : btoa(input);
      setOutput(result);
      setStatus("ok"); setErrorMsg("");
    } catch (e: any) {
      setStatus("error"); setErrorMsg(e.message || "编码失败");
    }
  }

  function doDecode() {
    try {
      const result = mode === "utf8" ? b64decode(input.trim()) : atob(input.trim());
      setOutput(result);
      setStatus("ok"); setErrorMsg("");
    } catch (e: any) {
      setStatus("error"); setErrorMsg(e.message || "解码失败，请检查 Base64 格式是否正确");
    }
  }

  function swap() {
    setInput(output); setOutput(input); setStatus("idle"); setErrorMsg("");
  }

  function clearAll() {
    setInput(""); setOutput(""); setStatus("idle"); setErrorMsg("");
  }

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
        <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">Base64 编码/解码</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">支持 UTF-8 编码，可处理中文、Emoji 等 Unicode 字符</p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white shadow-soft px-5 py-3">
        <span className="text-xs font-medium text-zinc-600">字符编码</span>
        <div className="flex rounded-lg bg-slate-100 p-1 text-xs">
          <button onClick={() => setMode("utf8")} className={`rounded-md px-3 py-1 ${mode === "utf8" ? "bg-white text-brand-600 shadow-sm font-medium" : "text-slate-500"}`}>UTF-8 (推荐)</button>
          <button onClick={() => setMode("latin1")} className={`rounded-md px-3 py-1 ${mode === "latin1" ? "bg-white text-brand-600 shadow-sm font-medium" : "text-slate-500"}`}>Latin-1</button>
        </div>
        <span className="text-[11px] text-zinc-400">UTF-8 模式可正确处理中文和 Emoji</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/70 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-600 text-xs font-semibold">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </span>
              <h2 className="text-sm font-semibold text-zinc-800">输入</h2>
              <span className="text-[11px] text-zinc-400">{input.length} 字符</span>
            </div>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "utf8" ? "输入文本或 Base64 字符串..." : "输入 Latin-1 文本或 Base64..."}
            spellCheck={false}
            className="h-[380px] w-full resize-none bg-transparent px-5 py-4 font-mono text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-none scrollbar-thin"
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
              <h2 className="text-sm font-semibold text-zinc-800">输出</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={copyOutput} disabled={!output}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:bg-slate-50 disabled:opacity-40">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copied ? "已复制" : "复制"}
              </button>
            </div>
          </div>

          {status === "error" && errorMsg && (
            <div className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 font-mono">
              {errorMsg}
            </div>
          )}

          <textarea
            value={output}
            readOnly
            placeholder="结果将显示在这里"
            spellCheck={false}
            className="h-[380px] w-full resize-none bg-transparent px-5 py-4 font-mono text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-none scrollbar-thin"
          />
        </section>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200/70 bg-white shadow-soft p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={doEncode}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-brand-700 hover:shadow-glow active:scale-[0.98] transition-all">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            编码 → Base64
          </button>
          <button onClick={doDecode}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-soft hover:border-slate-300 hover:bg-slate-50 transition-all">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8v12m0 0l-4-4m4 4l4-4M7 16V4m0 0L3 8m4-4l4 4" />
            </svg>
            解码 ← Base64
          </button>
          <button onClick={swap}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-soft hover:border-slate-300 hover:bg-slate-50 transition-all">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            交换
          </button>
          <div className="ml-auto flex items-center gap-3 text-xs text-zinc-400">
            {output && <span>{output.length} 字符</span>}
            <button onClick={clearAll} className="text-zinc-400 hover:text-red-500 transition-colors font-medium">清空</button>
          </div>
        </div>
      </div>
            <ToolUsage tool={getToolById("base64")!} />
</main>
  );
}
