"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { useFileGuard } from "@/hooks/useFileGuard";
import { FileGuardModal } from "@/components/FileGuardModal";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

type Step = "upload" | "processing" | "done";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

export default function PdfCompressPage() {
  const [step, setStep] = useState<Step>("upload");
  const guard = useFileGuard("compress");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingMb, setPendingMb] = useState(0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [inputBytes, setInputBytes] = useState<Uint8Array | null>(null);
  const [originalSize, setOriginalSize] = useState(0);
  const [result, setResult] = useState<{ pageCount: number; savedBytes: number; outputBytes: Uint8Array; } | null>(null);

  const [maxDimension, setMaxDimension] = useState(0); // 0 = keep original
  const [quality, setQuality] = useState(70);
  const [format, setFormat] = useState<"jpeg" | "png">("jpeg");
  const [running, setRunning] = useState(false);
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
    setOriginalSize(f.size);
    setInputBytes(new Uint8Array(await f.arrayBuffer()));
    setResult(null);
    setStep("upload");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleCompress = useCallback(async () => {
    if (!inputBytes) return;
    setError(""); setStep("processing"); setRunning(true);
    try {
      const { compressPdfClientSide } = await import("@/lib/pdf/compressPdf");
      const r = await compressPdfClientSide(inputBytes, {
        quality: quality / 100,
        maxWidth: maxDimension > 0 ? maxDimension : undefined,
        outputFormat: format === "jpeg" ? "jpeg" : "png",
      });
      setResult({ pageCount: r.pageCount, savedBytes: r.savedBytes, outputBytes: r.outputBytes });
      setStep("done");
    } catch (err: any) {
      setError(err?.message || "压缩失败");
      setStep("upload");
    } finally {
      setRunning(false);
    }
  }, [inputBytes, maxDimension]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result.outputBytes as any], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/\.pdf$/i, "") + "_compressed.pdf";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result, fileName]);

  const handleReset = useCallback(() => {
    setResult(null); setStep("upload"); setError("");
  }, []);

  const handleNew = useCallback(() => {
    setInputBytes(null); setResult(null); setFileName(""); setOriginalSize(0); setError(""); setStep("upload");
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

  if (step === "processing") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ToolHeader title="PDF 压缩" description={fileName} />
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
          <p className="text-slate-600">正在分析和压缩图片资源...</p>
        </div>
                <ToolUsage tool={getToolById("compress")!} />
</main>
    );
  }

  if (step === "done" && result) {
    const ratio = originalSize > 0 ? ((1 - result.outputBytes.length / originalSize) * 100) : 0;
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ToolHeader title="PDF 压缩" description={fileName} />
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-800">压缩完成！</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-slate-50 p-4 text-center">
              <div className="text-xs text-slate-500">原始大小</div>
              <div className="mt-1 text-xl font-semibold text-slate-700">{formatSize(originalSize)}</div>
            </div>
            <div className="rounded-lg bg-primary-50 p-4 text-center">
              <div className="text-xs text-primary-600">压缩后</div>
              <div className="mt-1 text-xl font-semibold text-primary-700">{formatSize(result.outputBytes.length)}</div>
            </div>
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <div className="text-xs text-green-600">节省</div>
              <div className="mt-1 text-xl font-semibold text-green-700">
                {result.savedBytes > 0 ? `-${formatSize(result.savedBytes)}` : "+" + formatSize(-result.savedBytes)}
              </div>
              <div className="text-[10px] text-green-500">{ratio.toFixed(1)}%</div>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-slate-500">
            共 {result.pageCount} 页
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={handleDownload} className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700">
              💾 下载压缩后的 PDF
            </button>
            <button onClick={handleReset} className="rounded-lg border border-slate-300 bg-white px-6 py-2 text-sm text-slate-600 hover:bg-slate-50">
              继续调参
            </button>
            <button onClick={handleNew} className="rounded-lg border border-slate-300 bg-white px-6 py-2 text-sm text-slate-600 hover:bg-slate-50">
              处理其他文件
            </button>
          </div>
        </div>
      </main>
    );
  }

  // upload + config (first step if no file, or re-upload if reset)
  if (!inputBytes) {
    return (
      <>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ToolHeader title="PDF 压缩" description="智能重编码 PDF 中的图片资源，减小文件体积" />
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
          <p className="mb-1 text-lg font-medium text-slate-700">点击上传 PDF，或拖到此处</p>
          <p className="text-sm text-slate-500">支持 .pdf 格式</p>
        </div>
        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </main>
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
      </>
    );
  }

  // Config page
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ToolHeader title="PDF 压缩" description={fileName} />
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
          <span className="text-slate-600">{fileName}</span>
          <span className="font-medium text-primary-600">{formatSize(originalSize)}</span>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">输出格式</label>
            <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
              <button onClick={() => setFormat("jpeg")} className={`flex-1 rounded-md px-3 py-1.5 ${format === "jpeg" ? "bg-white text-primary-600 shadow-sm font-medium" : "text-slate-500"}`}>JPEG (更小)</button>
              <button onClick={() => setFormat("png")} className={`flex-1 rounded-md px-3 py-1.5 ${format === "png" ? "bg-white text-primary-600 shadow-sm font-medium" : "text-slate-500"}`}>PNG (无损)</button>
            </div>
          </div>
          {format === "jpeg" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">JPEG 质量：{quality}%</label>
              <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(+e.target.value)} className="w-full" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">最大页面宽度</label>
            <select value={maxDimension} onChange={(e) => setMaxDimension(+e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value={0}>保持原始分辨率</option>
              <option value={2048}>2048px (高)</option>
              <option value={1536}>1536px (中)</option>
              <option value={1024}>1024px (低)</option>
              <option value={768}>768px (很低)</option>
            </select>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            💡 压缩原理：将 PDF 每页渲染为图片后重新打包为 PDF。这种通用方法适用于任何 PDF，但会降低文本可选中能力。
          </div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <div className="flex gap-3">
            <button onClick={handleCompress} disabled={running}
              className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-slate-300">
              {running ? "压缩中..." : "🔽 开始压缩"}
            </button>
            <button onClick={handleNew} className="rounded-lg border border-slate-300 px-4 text-xs text-slate-500 hover:bg-slate-50">
              换文件
            </button>
          </div>
        </div>
      </div>
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
    </main>
  );
}
