"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import "@/lib/pdf/polyfill";
import { useFileGuard } from "@/hooks/useFileGuard";
import { FileGuardModal } from "@/components/FileGuardModal";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

type Step = "upload" | "rendering" | "done";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

export default function PdfToImagePage() {
  const [step, setStep] = useState<Step>("upload");
  const guard = useFileGuard("to-image");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingMb, setPendingMb] = useState(0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [inputBytes, setInputBytes] = useState<Uint8Array | null>(null);

  const [scale, setScale] = useState(2.0);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [quality, setQuality] = useState(92);

  const [pages, setPages] = useState<{
    pageNumber: number; width: number; height: number; size: number;
    previewUrl: string; bytes: Uint8Array;
  }[]>([]);
  const [progress, setProgress] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { pages.forEach(p => URL.revokeObjectURL(p.previewUrl)); };
  }, [pages]);

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

  const handleRender = useCallback(async () => {
    if (!inputBytes) return;
    setError(""); setStep("rendering"); setRunning(true); setProgress(0); setPages([]);
    let pdf: any = null;
    let loadingTask: any = null;
    try {
      const pdfjsMod = await import("pdfjs-dist");
      const pdfjsLib = (pdfjsMod as any).default ?? pdfjsMod;
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      loadingTask = pdfjsLib.getDocument({ data: inputBytes.slice() });
      pdf = await loadingTask.promise;

      const waitFonts = () => new Promise<void>((resolve) => {
        if (pdf.fontsReady || pdf.numPages === 0) { resolve(); return; }
        const started = Date.now();
        const check = () => {
          if (pdf.fontsReady || Date.now() - started > 5000) resolve();
          else setTimeout(check, 50);
        };
        check();
      });
      await waitFonts();

      const totalPages = pdf.numPages;
      setTotalPages(totalPages);
      const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
      const results: typeof pages = [];

      for (let pi = 1; pi <= totalPages; pi++) {
        const page = await pdf.getPage(pi);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvas, canvasContext: ctx, viewport }).promise;

        const blob: Blob = await new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b!), mimeType, quality / 100);
        });

        const reader = new FileReader();
        const bytes: Uint8Array = await new Promise((res) => {
          reader.onload = () => res(new Uint8Array(reader.result as ArrayBuffer));
          reader.readAsArrayBuffer(blob);
        });

        results.push({
          pageNumber: pi,
          width: canvas.width,
          height: canvas.height,
          size: bytes.length,
          previewUrl: URL.createObjectURL(blob),
          bytes,
        });
        setProgress(pi);
        setPages([...results]);
      }

      setStep("done");
    } catch (err: any) {
      console.error("PDF render error:", err);
      setError(err?.message || "渲染失败");
      setStep("upload");
    } finally {
      setRunning(false);
      if (loadingTask) { try { loadingTask.destroy(); } catch {} }
    }
  }, [inputBytes, scale, format, quality]);

  const handleDownloadOne = useCallback((p: typeof pages[0]) => {
    const url = URL.createObjectURL(new Blob([p.bytes as any], { type: format === "jpeg" ? "image/jpeg" : "image/png" }));
    const a = document.createElement("a");
    a.href = url;
    const ext = format === "jpeg" ? "jpg" : "png";
    const base = fileName.replace(/\.pdf$/i, "");
    a.download = `${base}_page_${p.pageNumber}.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [fileName, format]);

  const handleDownloadAll = useCallback(async () => {
    if (pages.length === 0) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const ext = format === "jpeg" ? "jpg" : "png";
    const pad = String(pages.length).length;
    const base = fileName.replace(/\.pdf$/i, "");
    for (const p of pages) {
      zip.file(`${base}_${String(p.pageNumber).padStart(pad, "0")}.${ext}`, p.bytes);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}_images.zip`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [pages, fileName, format]);

  const handleReset = useCallback(() => {
    for (const p of pages) URL.revokeObjectURL(p.previewUrl);
    setPages([]); setStep("upload"); setError("");
  }, [pages]);

  const handleNew = useCallback(() => {
    for (const p of pages) URL.revokeObjectURL(p.previewUrl);
    setInputBytes(null); setPages([]); setFileName(""); setError(""); setStep("upload");
  }, [pages]);

  // Upload screen
  if (!inputBytes) {
    return (
      <>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ToolHeader title="PDF 转图片" description="将每页 PDF 渲染为高清 PNG/JPEG 图片" />
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="mb-1 text-lg font-medium text-slate-700">点击上传 PDF，或拖到此处</p>
          <p className="text-sm text-slate-500">支持 .pdf 格式</p>
        </div>
        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                <ToolUsage tool={getToolById("to-image")!} />
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

  // Config + results combined (single flow: upload → render → show)
  const totalSize = pages.reduce((s, p) => s + p.size, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <ToolHeader title="PDF 转图片" description={fileName} />

      {/* Config bar */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">格式</label>
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
              <button disabled={running} onClick={() => setFormat("png")} className={`rounded-md px-3 py-1 ${format === "png" ? "bg-white text-primary-600 shadow-sm font-medium" : "text-slate-500"}`}>PNG</button>
              <button disabled={running} onClick={() => setFormat("jpeg")} className={`rounded-md px-3 py-1 ${format === "jpeg" ? "bg-white text-primary-600 shadow-sm font-medium" : "text-slate-500"}`}>JPEG</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">DPI 倍率</label>
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
              {[1, 2, 3, 4].map((s) => (
                <button key={s} disabled={running} onClick={() => setScale(s)} className={`rounded-md px-2.5 py-1 ${scale === s ? "bg-white text-primary-600 shadow-sm font-medium" : "text-slate-500"}`}>
                  {s}× ({s * 72}dpi)
                </button>
              ))}
            </div>
          </div>
          {format === "jpeg" && (
            <div className="flex items-center gap-2 min-w-[160px]">
              <label className="text-xs font-medium text-slate-600 whitespace-nowrap">质量 {quality}%</label>
              <input type="range" min={10} max={100} value={quality} disabled={running} onChange={(e) => setQuality(+e.target.value)} className="flex-1" />
            </div>
          )}
          <div className="ml-auto flex gap-2">
            {step !== "rendering" && (
              <button onClick={handleRender} disabled={running}
                className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-slate-300">
                {pages.length > 0 ? "🔄 重新渲染" : "🎨 开始渲染"}
              </button>
            )}
            <button onClick={handleNew} disabled={running} className="rounded-lg border border-slate-300 bg-white px-4 text-xs text-slate-500 hover:bg-slate-50">
              换文件
            </button>
          </div>
        </div>

        {step === "rendering" && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>渲染中... {progress} / {totalPages || "?"}</span>
              <span>{totalPages > 0 ? `${Math.round((progress / totalPages) * 100)}%` : "准备中..."}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-primary-600 transition-all" style={{ width: `${totalPages > 0 ? Math.min(100, (progress / totalPages) * 100) : 5}%` }}></div>
            </div>
          </div>
        )}

        {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      </div>

      {/* Results */}
      {pages.length > 0 && (
        <>
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex-1 text-sm text-slate-600">
              共 <span className="font-semibold text-primary-600">{pages.length}</span> 张图片
              · 合计 <span className="font-semibold">{formatSize(totalSize)}</span>
              · {format.toUpperCase()} · {scale}× ({scale * 72}dpi)
            </div>
            <button onClick={handleDownloadAll}
              className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700">
              📦 全部下载 (ZIP)
            </button>
            {!running && (
              <button onClick={handleReset} className="text-xs text-slate-400 hover:text-red-500">清除结果</button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {pages.map((p) => (
              <div key={p.pageNumber} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm hover:border-primary-300 hover:shadow-md transition-all group">
                <div className="mb-1 flex items-center justify-between">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">P{p.pageNumber}</span>
                  <span className="text-[10px] text-slate-400">{p.width}×{p.height}</span>
                </div>
                <div className="flex items-center justify-center overflow-hidden rounded bg-slate-50" style={{ minHeight: 120 }}>
                  <img src={p.previewUrl} alt={`page ${p.pageNumber}`} className="max-h-40 max-w-full object-contain" />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[10px] text-slate-400">{formatSize(p.size)}</div>
                  <button onClick={() => handleDownloadOne(p)}
                    className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-primary-100 hover:text-primary-600">
                    下载
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {pages.length === 0 && step !== "rendering" && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="mb-2 text-slate-400">点击上方「开始渲染」按钮将 PDF 转换为图片</p>
          <p className="text-xs text-slate-400">提示：2× 分辨率（144dpi）适合大多数场景，4× 适合打印</p>
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
