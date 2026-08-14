"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { ToolHeader } from "@/components/ToolHeader";
import { useFileGuard } from "@/hooks/useFileGuard";
import { FileGuardModal } from "@/components/FileGuardModal";
import { splitPdf, parseRangeString, splitEachPage, splitEveryN, type SplitRange } from "@/lib/pdf/splitPdf";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

interface FileItem {
  name: string;
  size: number;
  totalPages: number;
  bytes: Uint8Array;
}

interface SplitOutputItem {
  name: string;
  pages: string;
  pageCount: number;
  bytes: Uint8Array;
}

type Mode = "range" | "each" | "everyN";
type Step = "upload" | "configure" | "processing" | "done";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

export default function PdfSplitPage() {
  const [file, setFile] = useState<FileItem | null>(null);
  const guard = useFileGuard("split");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingMb, setPendingMb] = useState(0);
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState<Mode>("each");
  const [rangeInput, setRangeInput] = useState("");
  const [everyN, setEveryN] = useState(2);
  const [outputs, setOutputs] = useState<SplitOutputItem[]>([]);
  const [loading, setLoading] = useState(false);
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
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("请上传 PDF 文件");
      return;
    }
    const buf = await f.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let totalPages = 0;
    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(bytes);
      totalPages = doc.getPageCount();
    } catch {
      setError("无法解析该 PDF，文件可能已损坏");
      return;
    }
    if (totalPages === 0) {
      setError("PDF 没有页面");
      return;
    }
    setFile({ name: f.name, size: f.size, totalPages, bytes });
    setStep("configure");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const computeRanges = useCallback((): SplitRange[] => {
    if (!file) return [];
    switch (mode) {
      case "each":
        return splitEachPage(file.totalPages);
      case "everyN":
        return splitEveryN(file.totalPages, Math.max(1, everyN));
      case "range":
        return parseRangeString(rangeInput, file.totalPages);
    }
  }, [file, mode, everyN, rangeInput]);

  const handleSplit = useCallback(async () => {
    if (!file) return;
    setError("");

    let ranges: SplitRange[] = [];
    try {
      ranges = computeRanges();
    } catch (err: any) {
      setError(err.message);
      return;
    }

    if (ranges.length === 0) {
      setError("请配置拆分方式");
      return;
    }

    setStep("processing");
    setLoading(true);
    try {
      const res = await splitPdf(file.bytes, ranges);
      setOutputs(
        res.items.map((it) => ({
          name: it.name,
          pages: it.startPage === it.endPage
            ? `第 ${it.startPage} 页`
            : `第 ${it.startPage}-${it.endPage} 页`,
          pageCount: it.pageCount,
          bytes: it.bytes,
        }))
      );
      setStep("done");
    } catch (err: any) {
      setError(err?.message || "拆分失败");
      setStep("configure");
    } finally {
      setLoading(false);
    }
  }, [file, computeRanges]);

  const handleDownloadAll = useCallback(async () => {
    if (outputs.length === 0) return;
    const zip = new JSZip();
    const base = file?.name.replace(/\.pdf$/i, "") || "split";
    for (const o of outputs) {
      zip.file(`${base}_${o.name}`, o.bytes);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}_split.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [outputs, file]);

  const handleDownloadOne = useCallback((item: SplitOutputItem) => {
    const url = URL.createObjectURL(new Blob([item.bytes as any], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleReset = useCallback(() => {
    setFile(null);
    setOutputs([]);
    setRangeInput("");
    setError("");
    setStep("upload");
  }, []);

  const previewRanges = (() => {
    if (!file) return [];
    try {
      return computeRanges();
    } catch {
      return [];
    }
  })();

  const retryHandleRef = useRef<typeof handleFile | null>(null);
  retryHandleRef.current = handleFile;

  useEffect(() => {
    if (!guard.level && pendingFile && retryHandleRef.current) {
      const f = pendingFile;
      setPendingFile(null);
      retryHandleRef.current(f);
    }
  }, [guard.level, pendingFile]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ToolHeader
        title="PDF 拆分"
        description="按页码范围将一个 PDF 拆分成多个文件"
      />

      {step === "upload" && (
        <>
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-all ${
              dragOver ? "border-primary-500 bg-primary-50" : "border-slate-300 bg-white hover:border-primary-400 hover:bg-slate-50"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
              className="hidden"
            />
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
              <svg className="h-8 w-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="mb-1 text-lg font-medium text-slate-700">点击上传 PDF，或拖到此处</p>
            <p className="text-sm text-slate-500">支持 .pdf 格式，文件不会上传到服务器</p>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
        </>
      )}

      {(step === "configure" || step === "processing" || step === "done") && file && (
        <>
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium text-slate-800">{file.name}</div>
              <div className="text-xs text-slate-400">{formatSize(file.size)} · {file.totalPages} 页</div>
            </div>
            <button onClick={handleReset} className="text-xs text-slate-400 hover:text-red-500">更换文件</button>
          </div>

          {step === "configure" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">选择拆分方式</h2>

              <div className="space-y-4">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-slate-50 has-[:checked]:border-primary-400 has-[:checked]:bg-primary-50/50">
                  <input type="radio" name="mode" checked={mode === "each"} onChange={() => setMode("each")}
                    className="mt-0.5 h-4 w-4 accent-primary-600" />
                  <div>
                    <div className="text-sm font-medium text-slate-800">每页拆成单独文件</div>
                    <div className="text-xs text-slate-500">共 {file.totalPages} 页 → 生成 {file.totalPages} 个 PDF</div>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-slate-50 has-[:checked]:border-primary-400 has-[:checked]:bg-primary-50/50">
                  <input type="radio" name="mode" checked={mode === "everyN"} onChange={() => setMode("everyN")}
                    className="mt-0.5 h-4 w-4 accent-primary-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800">每 N 页一组</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      每
                      <input
                        type="number"
                        min={1}
                        max={file.totalPages}
                        value={everyN}
                        onChange={(e) => setEveryN(Math.max(1, parseInt(e.target.value) || 1))}
                        onClick={(e) => e.stopPropagation()}
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-center text-sm"
                      />
                      页一组
                      {mode === "everyN" && (
                        <span className="ml-2 text-slate-400">
                          → 生成 {Math.ceil(file.totalPages / everyN)} 个文件
                        </span>
                      )}
                    </div>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-slate-50 has-[:checked]:border-primary-400 has-[:checked]:bg-primary-50/50">
                  <input type="radio" name="mode" checked={mode === "range"} onChange={() => setMode("range")}
                    className="mt-0.5 h-4 w-4 accent-primary-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800">自定义页码范围</div>
                    <input
                      type="text"
                      value={rangeInput}
                      onChange={(e) => setRangeInput(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={`例如: 1-3, 5, 7-${file.totalPages}`}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      支持格式：单页 "3"、范围 "1-5"、多个用逗号或空格分隔
                    </div>
                  </div>
                </label>
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
              )}

              {previewRanges.length > 0 && mode !== "each" && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <div className="mb-1 font-medium text-slate-700">预览（{previewRanges.length} 个文件）：</div>
                  <div className="flex flex-wrap gap-1.5">
                    {previewRanges.slice(0, 20).map((r, i) => (
                      <span key={i} className="rounded bg-white px-2 py-0.5 font-mono text-[11px] text-slate-600 border border-slate-200">
                        {r.start === r.end ? `p${r.start}` : `p${r.start}-${r.end}`}
                      </span>
                    ))}
                    {previewRanges.length > 20 && (
                      <span className="text-slate-400">...等 {previewRanges.length} 个</span>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleSplit}
                disabled={loading}
                className="mt-5 w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                开始拆分
              </button>
            </div>
          )}

          {step === "processing" && (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
              <p className="text-slate-600">正在拆分 PDF...</p>
              <p className="mt-1 text-xs text-slate-400">文件仅在浏览器本地处理</p>
            </div>
          )}

          {step === "done" && outputs.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <span className="text-sm font-semibold text-slate-800">拆分完成！</span>
                  <span className="ml-2 text-xs text-slate-500">共生成 {outputs.length} 个文件</span>
                </div>
                <button
                  onClick={handleDownloadAll}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                >
                  📦 全部下载 (ZIP)
                </button>
              </div>

              <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {outputs.map((o, idx) => (
                  <li key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-xs font-semibold text-slate-400">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium text-slate-800">{o.name}</div>
                      <div className="text-xs text-slate-400">{o.pages} · {formatSize(o.bytes.length)}</div>
                    </div>
                    <button
                      onClick={() => handleDownloadOne(o)}
                      className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-primary-50 hover:text-primary-600"
                    >
                      下载
                    </button>
                  </li>
                ))}
              </ul>

              <div className="border-t border-slate-200 px-4 py-3 text-center">
                <button onClick={handleReset} className="text-xs text-slate-500 hover:text-primary-600">
                  继续拆分其他文件
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {guard.level && (
        <FileGuardModal
          mode={guard.level as "verify" | "membership"}
          fileSizeMB={pendingMb}
          verifyMb={guard.config?.verify.mb ?? 8}
          membershipMb={guard.toolThresholds?.membershipMb ?? guard.config?.membership.mb ?? 20}
          onClose={() => { setPendingFile(null); setPendingMb(0); guard.clearModal(); }}
          onVerified={(k) => guard.onVerified(k)}
        />
      )}
            <ToolUsage tool={getToolById("split")!} />
</main>
  );
}
