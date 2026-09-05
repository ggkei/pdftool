"use client";

import { useState, useCallback, useRef } from "react";
import { createWorker, type Worker } from "tesseract.js";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/gif"];
const SUPPORTED_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"];

interface LangOption {
  value: string;
  label: string;
}

const LANG_OPTIONS: LangOption[] = [
  { value: "chi_sim+eng", label: t("img_ocr.lang_eng") },
  { value: "chi_sim", label: t("img_ocr.lang_chs") },
  { value: "chi_tra", label: t("img_ocr.lang_cht") },
  { value: "eng", label: "English" },
  { value: "jpn", label: t("img_ocr.lang_jpn_native") },
  { value: "kor", label: "한국어" },
  { value: "fra", label: "Français" },
  { value: "deu", label: "Deutsch" },
  { value: "rus", label: "Русский" },
  { value: "spa", label: "Español" },
  { value: "por", label: "Português" },
  { value: "ita", label: "Italiano" },
  { value: "ara", label: "العربية" },
];

function isSupportedImage(file: File): boolean {
  if (SUPPORTED_TYPES.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return SUPPORTED_EXTS.some((ext) => name.endsWith(ext));
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageOcrPage() {
  const tool = getToolById("image-ocr")!;
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "recognizing" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [lang, setLang] = useState("chi_sim+eng");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
    setResult("");
    setStatus("idle");
    setProgress(0);
    setProgressMsg("");
    setError("");
    setSearch("");
    setCopied(false);
    abortRef.current = false;
  }, [previewUrl]);

  const handleFile = useCallback(async (selected: File) => {
    if (!isSupportedImage(selected)) {
      setError(t("img_ocr.error_format_detail").replace("{name}", selected.name));
      return;
    }
    reset();
    setFile(selected);
    const url = URL.createObjectURL(selected);
    setPreviewUrl(url);
    setStatus("idle");
    setError("");
  }, [reset]);

  const startOcr = useCallback(async () => {
    if (!file || !previewUrl) return;
    setStatus("loading");
    setProgress(0);
    setProgressMsg(t("img_ocr.loading_engine"));
    setError("");
    abortRef.current = false;

    try {
      const worker = await createWorker(lang, 1, {
        logger: (m) => {
          if (abortRef.current) return;
          if (m.status === "loading") {
            setProgressMsg((m as any).message || "");
            setProgress(0);
          } else if (m.status === "loaded") {
            setProgressMsg((m as any).message || "");
            setProgress(50);
          } else if (m.status === "recognizing text") {
            setStatus("recognizing");
            setProgressMsg(t("img_ocr.processing"));
            if (typeof m.progress === "number") {
              setProgress(50 + Math.round(m.progress * 50));
            }
          }
        },
      });

      if (abortRef.current) {
        await worker.terminate();
        return;
      }

      workerRef.current = worker;
      setProgressMsg(t("img_ocr.processing"));
      setProgress(60);

      const ret = await worker.recognize(previewUrl);

      if (abortRef.current) {
        await worker.terminate();
        return;
      }

      setResult(ret.data.text);
      setStatus("done");
      setProgress(100);
      setProgressMsg(t("img_ocr.done"));

      await worker.terminate();
      workerRef.current = null;
    } catch (err: any) {
      if (!abortRef.current) {
        setStatus("error");
        setError(err?.message || t("img_ocr.error_failed"));
        setProgress(0);
        setProgressMsg("");
      }
    }
  }, [file, previewUrl, lang]);

  const cancelOcr = useCallback(() => {
    abortRef.current = true;
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setStatus("idle");
    setProgress(0);
    setProgressMsg(t("img_ocr.cancelled"));
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(null);
      setPreviewUrl("");
      setResult("");
      setStatus("idle");
      setProgress(0);
      setProgressMsg("");
      setError("");
      setTimeout(() => handleFile(f), 0);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = result;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadTxt = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file ? `${file.name.replace(/\.[^/.]+$/, "")}_ocr.txt` : "ocr_result.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredLines = result
    .split("\n")
    .map((line, idx) => ({ line, idx }))
    .filter(({ line }) => {
      if (!search.trim()) return true;
      return line.toLowerCase().includes(search.trim().toLowerCase());
    });

  const isBusy = status === "loading" || status === "recognizing";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />

      <div className="mt-8 space-y-6">
        {/* Upload area */}
        {!file && (
          <div
            className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
              dragOver ? "border-brand-400 bg-brand-50" : "border-slate-300 bg-white/60"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="mb-4 text-5xl">&#128247;</div>
            <p className="mb-2 text-sm font-medium text-zinc-700">
              {t("img_ocr.drag_hint")}
            </p>
            <p className="mb-6 text-xs text-zinc-400">
              {t("util_timestamp.label_local")}
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/bmp,image/gif"
              className="hidden"
              id="image-ocr-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.currentTarget.value = "";
              }}
            />
            <button
              onClick={() => document.getElementById("image-ocr-input")?.click()}
              className="btn-primary"
            >
              {t("img_ocr.select_image")}
            </button>
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          </div>
        )}

        {/* Preview + Controls */}
        {file && (
          <>
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <img
                  src={previewUrl}
                  alt="preview"
                  className="max-h-48 w-auto rounded-lg object-contain"
                />
                <div className="flex-1 space-y-1 text-sm">
                  <p className="font-medium text-zinc-800">{file.name}</p>
                  <p className="text-zinc-500">
                    {formatSize(file.size)} · {file.type || t("pdf_addnum.format_label")}
                  </p>
                </div>
                <button onClick={reset} className="btn-secondary text-xs px-3 py-1.5">
                  {t("common.reupload")}
                </button>
              </div>
            </div>

            {/* Language selector */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-zinc-700">{t("img_ocr.lang_label")}</label>
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                disabled={isBusy}
              >
                {LANG_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              {!isBusy && status !== "done" && (
                <button onClick={startOcr} className="btn-primary">
                  {t("img_ocr.btn_recognize")}
                </button>
              )}
              {isBusy && (
                <button onClick={cancelOcr} className="btn-secondary">
                  {t("img_ocr.btn_cancel")}
                </button>
              )}
              {status === "done" && (
                <button onClick={startOcr} className="btn-secondary">
                  {t("img_ocr.btn_retry")}
                </button>
              )}
            </div>

            {/* Progress */}
            {isBusy && (
              <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-zinc-600">{progressMsg || t("img_ocr.processing")}</span>
                  <span className="font-medium text-brand-600">{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-zinc-400">
                  {t("util_common.download")}
                </p>
              </div>
            )}

            {/* Error */}
            {status === "error" && error && (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Results */}
            {status === "done" && result && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={copyResult}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {copied ? t("img_ocr.copied") : t("util_color.copy")}
                  </button>
                  <button
                    onClick={downloadTxt}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-slate-200"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {t("util_common.download")}
                  </button>
                  <span className="ml-auto text-xs text-zinc-400">
                    {t("img_ocr.result_stats").replace("{chars}", String(result.length)).replace("{lines}", String(filteredLines.length))}
                  </span>
                </div>

                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder={t("img_ocr.search_placeholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  />
                  <svg
                    className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Result text area */}
                <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
                  <div className="max-h-[480px] overflow-auto rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-zinc-800 whitespace-pre-wrap">
                    {filteredLines.length > 0 ? (
                      filteredLines.map(({ line, idx }) => (
                        <div
                          key={idx}
                          className={
                            search.trim() && line.toLowerCase().includes(search.trim().toLowerCase())
                              ? "bg-amber-100/50 rounded px-1 -mx-1"
                              : ""
                          }
                        >
                          {line || "\u00A0"}
                        </div>
                      ))
                    ) : (
                      <p className="text-zinc-400">{t("util_regex.no_match")}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {status === "done" && !result.trim() && (
              <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
                {t("img_ocr.no_text")}
              </div>
            )}
          </>
        )}
      </div>

      <ToolUsage tool={tool} />
    </main>
  );
}
