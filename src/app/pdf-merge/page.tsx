"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { mergePdfs } from "@/lib/pdf/mergePdf";
import { useFileGuard } from "@/hooks/useFileGuard";
import { FileGuardModal } from "@/components/FileGuardModal";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

interface FileItem {
  id: string;
  name: string;
  size: number;
  pages: number;
  bytes: Uint8Array;
}

type Step = "upload" | "processing" | "done";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

export default function PdfMergePage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; totalPages: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const guard = useFileGuard("merge");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingMb, setPendingMb] = useState(0);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const totalSize = Array.from(fileList).reduce((s, f) => s + f.size, 0);
    const level = guard.check(totalSize);
    if (level !== "free") {
      const list = Array.from(fileList);
      setPendingFiles(list);
      setPendingMb(totalSize / 1024 / 1024);
      if (level === "verify") guard.requestVerify();
      else guard.requestMembership();
      return;
    }
    setError("");
    const newItems: FileItem[] = [];

    for (const f of Array.from(fileList)) {
      if (!f.name.toLowerCase().endsWith(".pdf")) {
        setError(`已跳过非 PDF 文件: ${f.name}`);
        continue;
      }
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);

      let pageCount = 0;
      try {
        const { PDFDocument } = await import("pdf-lib");
        const doc = await PDFDocument.load(bytes);
        pageCount = doc.getPageCount();
      } catch {
        setError(`无法解析 ${f.name}，可能已损坏`);
        continue;
      }

      newItems.push({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        size: f.size,
        pages: pageCount,
        bytes,
      });
    }

    setFiles((prev) => [...prev, ...newItems]);
  }, []);

  const retryAddFilesRef = useRef<typeof addFiles | null>(null);
  retryAddFilesRef.current = addFiles;

  useEffect(() => {
    if (!guard.level && pendingFiles.length > 0 && retryAddFilesRef.current) {
      const list = pendingFiles;
      setPendingFiles([]);
      retryAddFilesRef.current(list);
    }
  }, [guard.level, pendingFiles]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleRemove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleMove = useCallback((fromIdx: number, toIdx: number) => {
    setFiles((prev) => {
      if (toIdx < 0 || toIdx >= prev.length || fromIdx === toIdx) return prev;
      const arr = [...prev];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
  }, []);

  const handleMerge = useCallback(async () => {
    if (files.length < 2) {
      setError("请至少上传 2 个 PDF 文件进行合并");
      return;
    }
    setError("");
    setStep("processing");
    try {
      const res = await mergePdfs(
        files.map((f) => ({ name: f.name, bytes: f.bytes }))
      );
      setResult({ bytes: res.outputBytes, totalPages: res.totalPages });
      setStep("done");
    } catch (err: any) {
      setError(err?.message || "合并失败");
      setStep("upload");
    }
  }, [files]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.bytes as any], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `merged_${result.totalPages}pages.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setResult(null);
    setStep("upload");
    setError("");
  }, []);

  const totalPages = files.reduce((sum, f) => sum + f.pages, 0);

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <ToolHeader
        title="PDF 合并"
        description="将多个 PDF 文件按顺序合并成一个文件"
      />

      {step === "upload" && (
        <>
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`group relative mb-6 flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
              dragOver
                ? "border-brand-400 bg-brand-50/60 scale-[1.01]"
                : "border-slate-300 bg-white hover:border-brand-300 hover:bg-brand-50/30"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
            <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 ${
              dragOver ? "bg-brand-600 text-white shadow-glow scale-110" : "bg-brand-50 text-brand-600 group-hover:bg-brand-100"
            }`}>
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className={`mb-1 text-base font-semibold transition-colors ${dragOver ? "text-brand-700" : "text-zinc-800"}`}>
              {dragOver ? "松开鼠标以上传" : "点击或拖拽 PDF 文件到此处"}
            </p>
            <p className="text-xs text-zinc-400">支持多选 · 可随时继续添加 · 纯本地处理</p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {files.length > 0 && (
            <div className="card animate-slide-up">
              <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-3.5">
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                    {files.length} 个文件
                  </span>
                  <span className="text-zinc-400">·</span>
                  <span>{totalPages} 页总计</span>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-zinc-400 transition-colors hover:text-red-500"
                >
                  清空全部
                </button>
              </div>

              <ul className="divide-y divide-slate-100">
                {files.map((f, idx) => (
                  <li
                    key={f.id}
                    draggable
                    onDragStart={() => setDraggingId(f.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIdx = files.findIndex((x) => x.id === draggingId);
                      if (fromIdx >= 0) handleMove(fromIdx, idx);
                    }}
                    className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                      draggingId === f.id ? "opacity-40 bg-brand-50/40" : "hover:bg-zinc-50/80"
                    }`}
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center text-xs font-semibold text-zinc-400 font-mono">
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <div className="shrink-0 text-zinc-300 cursor-grab active:cursor-grabbing">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M7 2a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 2zm0 6a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 8zm0 6a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 14zm6-8a2 2 0 1 1-.001-4.001A2 2 0 0 1 13 6zm0 2a2 2 0 1 1 .001 4.001A2 2 0 0 1 13 8zm0 6a2 2 0 1 1 .001 4.001A2 2 0 0 1 13 14z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-800" title={f.name}>
                        {f.name}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {formatSize(f.size)} · {f.pages} 页
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, idx - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-20 disabled:hover:bg-transparent"
                        title="上移"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <button
                        disabled={idx === files.length - 1}
                        onClick={() => handleMove(idx, idx + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-20 disabled:hover:bg-transparent"
                        title="下移"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      <button
                        onClick={() => handleRemove(f.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-500"
                        title="删除"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="border-t border-slate-200/70 px-5 py-4">
                <button
                  onClick={handleMerge}
                  disabled={files.length < 2}
                  className="btn-primary w-full disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none disabled:hover:bg-zinc-200"
                >
                  开始合并
                  <span className="text-xs opacity-70">
                    → {files.length} 个文件 / {totalPages} 页
                  </span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {step === "processing" && (
        <div className="card flex flex-col items-center justify-center p-16 animate-fade-in">
          <div className="relative mb-5">
            <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand-600" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-brand-600 animate-pulse-soft" />
            </div>
          </div>
          <p className="text-sm font-medium text-zinc-800">正在合并 PDF 文件...</p>
          <p className="mt-1 text-xs text-zinc-400">文件仅在浏览器本地处理</p>
        </div>
      )}

      {step === "done" && result && (
        <div className="card overflow-hidden animate-scale-in">
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mb-1 text-xl font-bold text-zinc-900">合并完成！</h2>
            <p className="mb-6 text-sm text-zinc-500">
              {files.length} 个文件 → 共 {result.totalPages} 页
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={handleDownload} className="btn-primary">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                下载合并后的 PDF
              </button>
              <button onClick={handleReset} className="btn-secondary">
                继续合并
              </button>
            </div>
          </div>
        </div>
      )}

      {guard.level && (
        <FileGuardModal
          mode={guard.level as "verify" | "membership"}
          fileSizeMB={pendingMb}
          verifyMb={guard.config?.verify.mb ?? 8}
          membershipMb={guard.toolThresholds?.membershipMb ?? guard.config?.membership.mb ?? 20}
          onClose={() => { setPendingFiles([]); setPendingMb(0); guard.clearModal(); }}
          onVerified={(k) => guard.onVerified(k)}
        />
      )}
            <ToolUsage tool={getToolById("merge")!} />
</main>
  );
}
