"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import type { OcrPageResult } from "@/lib/pdf/ocr";
import { useFileGuard } from "@/hooks/useFileGuard";
import { FileGuardModal } from "@/components/FileGuardModal";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

type Step = "upload" | "processing" | "done";

const LANG_OPTIONS: any[] = [];

export default function PdfOcrPage() {
  const [step, setStep] = useState<Step>("upload");
  const guard = useFileGuard("ocr");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingMb, setPendingMb] = useState(0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [inputBytes, setInputBytes] = useState<Uint8Array | null>(null);
  const [language, setLanguage] = useState("chi_sim+eng");
  void language; void setLanguage;

  const [progressPage, setProgressPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stage, setStage] = useState("");
  const [pages, setPages] = useState<OcrPageResult[]>([]);
  const [method, setMethod] = useState<"text-extraction" | "ocr" | "mixed">("text-extraction");
  const [activePage, setActivePage] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    const level = guard.check(f.size);
    if (level !== "free") {
      setPendingFile(f);
      setPendingMb(f.size / 1024 / 1024);
      if (level === "verify") guard.requestVerify();
      else guard.requestMembership();
      return;
    }
    setError("");
    if (!f.name.toLowerCase().endsWith(".pdf")) { setError("请上传 PDF 文件"); return; }
    setFileName(f.name);
    setInputBytes(new Uint8Array(await f.arrayBuffer()));
    setPages([]);
    setStep("upload");
  }, []);

  const retryHandleRef = useRef<typeof handleFile | null>(null);
  retryHandleRef.current = handleFile;

  useEffect(() => {
    if (!guard.level && pendingFile && retryHandleRef.current) {
      const f = pendingFile;
      setPendingFile(null);
      retryHandleRef.current(f);
    }
  }, [guard.level, pendingFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleExtract = useCallback(async () => {
    if (!inputBytes) return;
    setError(""); setStep("processing"); setProgressPage(0); setPages([]);
    try {
      const { ocrPdf } = await import("@/lib/pdf/ocr");
      const result = await ocrPdf(inputBytes, {
        languages: language,
        onProgress: (pg, total, stageName) => {
          setProgressPage(pg);
          setTotalPages(total);
          setStage(stageName || "处理中");
        },
      });
      setPages(result.pages);
      setMethod(result.method);
      setTotalPages(result.totalPages);
      setStep("done");
      if (result.pages.length > 0) setActivePage(result.pages[0].pageNumber);
    } catch (err: any) {
      console.error("OCR error:", err);
      setError(err?.message || "识别失败，请重试");
      setStep("upload");
    }
  }, [inputBytes, language]);

  const handleDownloadAll = useCallback(() => {
    if (pages.length === 0 || !fileName) return;
    const base = fileName.replace(/\.pdf$/i, "");
    const allText = pages.map((p) => `=== 第 ${p.pageNumber} 页 ===\n${p.text}`).join("\n\n");
    const url = URL.createObjectURL(new Blob([allText], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}_ocr.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [pages, fileName]);

  const handleCopyPage = useCallback(async (text: string) => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); } catch {}
  }, []);

  const handleReset = useCallback(() => {
    setPages([]); setInputBytes(null); setFileName(""); setError(""); setStep("upload");
  }, []);

  if (!inputBytes) {
    return (
      <>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ToolHeader title="OCR 文字识别" description="从 PDF 中提取文字内容" />
        <div onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-all ${
            dragOver ? "border-primary-500 bg-primary-50" : "border-slate-300 bg-white hover:border-primary-400 hover:bg-slate-50"
          }`}>
          <input ref={inputRef} type="file" accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} className="hidden" />
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
            <svg className="h-8 w-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="mb-1 text-lg font-medium text-slate-700">点击上传 PDF，或拖到此处</p>
          <p className="text-sm text-slate-500">支持 .pdf 格式 · 自动检测扫描件</p>
        </div>
        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                <ToolUsage tool={getToolById("ocr")!} />
</main>
      {guard.level && (
        <FileGuardModal
          mode={guard.level as "verify" | "membership"}
          fileSizeMB={pendingMb}
          verifyMb={guard.toolThresholds?.verifyMb ?? guard.config?.verify.mb ?? 8}
          membershipMb={guard.toolThresholds?.membershipMb ?? guard.config?.membership.mb ?? 20}
          onClose={() => { setPendingFile(null); setPendingMb(0); guard.clearModal(); }}
          onVerified={(k) => guard.onVerified(k)}
        />
      )}
      </>
    );
  }

  const activePageData = pages.find((p) => p.pageNumber === activePage);
  const totalChars = pages.reduce((s, p) => s + p.text.length, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <ToolHeader title="OCR 文字识别" description={fileName} />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-xs text-slate-500">从 PDF 中提取文字内容</div>
          <div className="ml-auto flex gap-2">
            {step !== "processing" && (
              <button onClick={handleExtract}
                className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                {pages.length > 0 ? "🔄 重新提取" : "🔍 开始提取"}
              </button>
            )}
            <button onClick={handleReset} disabled={step === "processing"}
              className="rounded-lg border border-slate-300 bg-white px-4 text-xs text-slate-500 hover:bg-slate-50">
              换文件
            </button>
          </div>
        </div>

        {step === "processing" && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>{stage}...</span>
              <span>{totalPages > 0 ? `${progressPage} / ${totalPages}` : `${Math.round(progressPage * 100)}%`}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-primary-600 transition-all"
                style={{ width: totalPages > 0 ? `${Math.min(100, (progressPage / totalPages) * 100)}%` : `${Math.min(100, progressPage * 100)}%` }} />
            </div>
          </div>
        )}

        {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      </div>

      {step === "done" && pages.length > 0 && (
        <>
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex-1 text-sm text-slate-600">
              共 <span className="font-semibold text-primary-600">{pages.length}</span> 页
              · <span className="font-semibold">{totalChars.toLocaleString()}</span> 字符
            </div>
            <button onClick={handleDownloadAll}
              className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700">
              📄 下载 TXT
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              <div className="mb-2 px-2 text-xs font-medium text-slate-500">页面列表</div>
              <div className="space-y-1 max-h-[480px] overflow-y-auto">
                {pages.map((p) => (
                  <button key={p.pageNumber} onClick={() => setActivePage(p.pageNumber)}
                    className={`w-full rounded px-2 py-1.5 text-left text-xs transition ${
                      activePage === p.pageNumber
                        ? "bg-primary-100 text-primary-700 font-medium"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}>
                    第 {p.pageNumber} 页
                    <span className="float-right text-slate-400">{p.text.length}字</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
                <span className="text-sm font-medium text-slate-700">
                  第 {activePage} 页
                </span>
                <button onClick={() => handleCopyPage(activePageData?.text || "")}
                  className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">
                  📋 复制
                </button>
              </div>
              <div className="p-4">
                {activePageData?.text ? (
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-700">{activePageData.text}</pre>
                ) : (
                  <p className="text-center text-sm text-slate-400 py-8">本页未检测到文字</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {pages.length === 0 && step !== "processing" && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="mb-2 text-slate-400">点击上方「开始识别」按钮提取 PDF 文字</p>
          <p className="text-xs text-slate-400">提示：仅对文字型 PDF 有效，扫描件不会有文字输出</p>
        </div>
      )}
      {guard.level && (
        <FileGuardModal
          mode={guard.level as "verify" | "membership"}
          fileSizeMB={pendingMb}
          verifyMb={guard.toolThresholds?.verifyMb ?? guard.config?.verify.mb ?? 8}
          membershipMb={guard.toolThresholds?.membershipMb ?? guard.config?.membership.mb ?? 20}
          onClose={() => { setPendingFile(null); setPendingMb(0); guard.clearModal(); }}
          onVerified={(k) => guard.onVerified(k)}
        />
      )}
    </main>
  );
}
