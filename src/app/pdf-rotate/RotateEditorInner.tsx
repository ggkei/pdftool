"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import "@/lib/pdf/polyfill";
import * as pdfjsLib from "pdfjs-dist";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { rotateAndReorderPdf, type PageTransform } from "@/lib/pdf/rotatePdf";
import { useFileGuard } from "@/hooks/useFileGuard";
import { FileGuardModal } from "@/components/FileGuardModal";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PageItem {
  originalIndex: number;
  rotation: number;
  thumbnailUrl: string;
  width: number;
  height: number;
}

type Step = "upload" | "editing" | "processing" | "done";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

export default function RotateEditorInner() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<{ name: string; size: number; bytes: Uint8Array } | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [loadingThumbs, setLoadingThumbs] = useState(false);
  const [result, setResult] = useState<{ bytes: Uint8Array; pageCount: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const guard = useFileGuard("rotate");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingMb, setPendingMb] = useState(0);

  const renderThumbnails = useCallback(async (bytes: Uint8Array): Promise<PageItem[]> => {
    const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
    const pdf = await loadingTask.promise;
    const results: PageItem[] = [];
    const scale = 0.2;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const url = canvas.toDataURL("image/png");
      results.push({
        originalIndex: i - 1,
        rotation: 0,
        thumbnailUrl: url,
        width: viewport.width,
        height: viewport.height,
      });
    }

    return results;
  }, []);

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

    let numPages = 0;
    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(bytes);
      numPages = doc.getPageCount();
    } catch {
      setError("无法解析该 PDF，文件可能已损坏");
      return;
    }
    if (numPages === 0) {
      setError("PDF 没有页面");
      return;
    }

    setFile({ name: f.name, size: f.size, bytes });
    setLoadingThumbs(true);
    try {
      const rendered = await renderThumbnails(bytes);
      setPages(rendered);
      setStep("editing");
    } catch (err: any) {
      setError("渲染缩略图失败: " + (err?.message || "未知错误"));
    } finally {
      setLoadingThumbs(false);
    }
  }, [renderThumbnails]);

  const retryHandleRef = useRef<typeof handleFile | null>(null);
  retryHandleRef.current = handleFile;

  useEffect(() => {
    if (!guard.level && pendingFile && retryHandleRef.current) {
      const f = pendingFile;
      setPendingFile(null);
      retryHandleRef.current(f);
    }
  }, [guard.level, pendingFile]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const rotatePage = useCallback((idx: number, delta: number) => {
    setPages((prev) => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], rotation: (arr[idx].rotation + delta + 360) % 360 };
      return arr;
    });
  }, []);

  const resetPage = useCallback((idx: number) => {
    setPages((prev) => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], rotation: 0 };
      return arr;
    });
  }, []);

  const rotateAll = useCallback((delta: number) => {
    setPages((prev) =>
      prev.map((p) => ({ ...p, rotation: (p.rotation + delta + 360) % 360 }))
    );
  }, []);

  const resetAll = useCallback(() => {
    setPages((prev) => prev.map((p) => ({ ...p, rotation: 0 })));
  }, []);

  const reverseOrder = useCallback(() => {
    setPages((prev) => [...prev].reverse());
  }, []);

  const movePage = useCallback((from: number, to: number) => {
    setPages((prev) => {
      if (from === to) return prev;
      const arr = [...prev];
      const [m] = arr.splice(from, 1);
      arr.splice(to, 0, m);
      return arr;
    });
  }, []);

  const handleReorderDrop = useCallback(
    (targetIdx: number) => {
      if (draggingIdx === null) return;
      movePage(draggingIdx, targetIdx);
      setDraggingIdx(null);
    },
    [draggingIdx, movePage]
  );

  const handleProcess = useCallback(async () => {
    if (!file) return;
    setError("");
    setStep("processing");
    try {
      const transforms: PageTransform[] = pages.map((p) => ({
        originalIndex: p.originalIndex,
        rotation: p.rotation,
      }));
      const res = await rotateAndReorderPdf(file.bytes, transforms);
      setResult({ bytes: res.outputBytes, pageCount: res.outputPages });
      setStep("done");
    } catch (err: any) {
      setError(err?.message || "处理失败");
      setStep("editing");
    }
  }, [file, pages]);

  const handleDownload = useCallback(() => {
    if (!result || !file) return;
    const url = URL.createObjectURL(new Blob([result.bytes as any], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    const base = file.name.replace(/\.pdf$/i, "");
    a.download = `${base}_rotated.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result, file]);

  const handleReset = useCallback(() => {
    for (const p of pages) URL.revokeObjectURL(p.thumbnailUrl);
    setPages([]);
    setFile(null);
    setResult(null);
    setError("");
    setStep("upload");
  }, [pages]);

  const hasChanges = pages.some((p) => p.rotation !== 0) || pages.some((p, i) => p.originalIndex !== i);
  const hasRotations = pages.some((p) => p.rotation !== 0);

  if (loadingThumbs) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <ToolHeader title="PDF 旋转 / 排序" description="正在渲染缩略图..." />
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
          <p className="text-slate-600">正在解析 PDF 页面...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <ToolHeader
        title="PDF 旋转 / 排序"
        description="可视化旋转页面方向，拖拽调整页面顺序"
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

      {step === "editing" && file && (
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
              <div className="text-xs text-slate-400">{formatSize(file.size)} · {pages.length} 页</div>
            </div>
            <button onClick={handleReset} className="text-xs text-slate-400 hover:text-red-500">更换文件</button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <span className="text-xs font-medium text-slate-500 mr-1">批量操作:</span>
            <button onClick={() => rotateAll(-90)} className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-primary-50 hover:border-primary-300">
              ⟲ 全部左转 90°
            </button>
            <button onClick={() => rotateAll(90)} className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-primary-50 hover:border-primary-300">
              ⟳ 全部右转 90°
            </button>
            <button onClick={reverseOrder} className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-primary-50 hover:border-primary-300">
              ⇅ 反序排列
            </button>
            <button onClick={resetAll} className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">
              ↺ 全部重置
            </button>
            <div className="ml-auto">
              <button
                onClick={handleProcess}
                disabled={!hasChanges}
                className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                应用更改 →
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {pages.map((page, idx) => (
              <div
                key={`${page.originalIndex}-${idx}`}
                draggable
                onDragStart={() => setDraggingIdx(idx)}
                onDragEnd={() => setDraggingIdx(null)}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={() => handleReorderDrop(idx)}
                className={`group relative rounded-xl border bg-white p-2 shadow-sm transition-all ${
                  draggingIdx === idx ? "opacity-40" : "hover:border-primary-300 hover:shadow-md"
                } ${draggingIdx !== null && draggingIdx !== idx ? "cursor-grab" : "cursor-default"}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    #{idx + 1}
                    {page.originalIndex !== idx && (
                      <span className="ml-1 text-primary-500">←p{page.originalIndex + 1}</span>
                    )}
                  </span>
                  {page.rotation !== 0 && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      {page.rotation}°
                    </span>
                  )}
                </div>

                <div className="relative flex items-center justify-center overflow-hidden rounded bg-slate-50" style={{ minHeight: 120 }}>
                  <img
                    src={page.thumbnailUrl}
                    alt={`Page ${page.originalIndex + 1}`}
                    className="max-w-full transition-transform duration-200"
                    style={{
                      transform: `rotate(${page.rotation}deg)`,
                      maxHeight: 160,
                    }}
                    draggable={false}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between gap-1">
                  <div className="flex gap-1">
                    <button
                      onClick={() => rotatePage(idx, -90)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-primary-600"
                      title="左转 90°"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => rotatePage(idx, 90)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-primary-600"
                      title="右转 90°"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      disabled={idx === 0}
                      onClick={() => movePage(idx, idx - 1)}
                      className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-20"
                      title="上移"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      disabled={idx === pages.length - 1}
                      onClick={() => movePage(idx, idx + 1)}
                      className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-20"
                      title="下移"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {page.rotation !== 0 && (
                    <button
                      onClick={() => resetPage(idx)}
                      className="rounded p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                      title="重置旋转"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {step === "processing" && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
          <p className="text-slate-600">正在处理 PDF...</p>
          <p className="mt-1 text-xs text-slate-400">文件仅在浏览器本地处理</p>
        </div>
      )}

      {step === "done" && result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-7 w-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-emerald-800">处理完成！</h2>
          <p className="mb-6 text-sm text-emerald-700">
            {result.pageCount} 页已应用更改
            {hasRotations && <span className="ml-1">(含旋转)</span>}
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={handleDownload} className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
              下载 PDF
            </button>
            <button onClick={handleReset} className="rounded-lg border border-emerald-300 bg-white px-6 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
              继续处理
            </button>
          </div>
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
      <ToolUsage tool={getToolById("rotate")!} />
    </main>
  );
}
