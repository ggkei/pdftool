"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { ToolHeader } from "@/components/ToolHeader";
import { extractImagesFromPdf, type ExtractedImage } from "@/lib/pdf/extractImages";
import { useFileGuard } from "@/hooks/useFileGuard";
import { FileGuardModal } from "@/components/FileGuardModal";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

type Step = "upload" | "extracting" | "done";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

export default function PdfExtractImagePage() {
  const [step, setStep] = useState<Step>("upload");
  const guard = useFileGuard("extract-image");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingMb, setPendingMb] = useState(0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [images, setImages] = useState<(ExtractedImage & { previewUrl: string })[]>([]);
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
    setFileName(f.name);
    setStep("extracting");
    try {
      const extracted = await extractImagesFromPdf(bytes);
      const withUrls = extracted.map((img) => ({
        ...img,
        previewUrl: URL.createObjectURL(new Blob([img.bytes as any], { type: img.mime })),
      }));
      setImages(withUrls);
      setStep("done");
      if (extracted.length === 0) {
        setError("未在 PDF 中检测到可提取的图片对象");
      }
    } catch (err: any) {
      setError(err?.message || "提取失败");
      setStep("upload");
    }
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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleDownloadAll = useCallback(async () => {
    if (images.length === 0) return;
    const zip = new JSZip();
    for (const img of images) {
      zip.file(`${img.name}_p${img.page}.png`, img.bytes);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const base = fileName.replace(/\.pdf$/i, "");
    a.download = `${base}_images.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [images, fileName]);

  const handleDownloadOne = useCallback((img: ExtractedImage) => {
    const url = URL.createObjectURL(new Blob([img.bytes as any], { type: img.mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${img.name}_p${img.page}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleReset = useCallback(() => {
    for (const img of images) URL.revokeObjectURL(img.previewUrl);
    setImages([]);
    setFileName("");
    setError("");
    setStep("upload");
  }, [images]);

  if (step === "upload") {
    return (
      <>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ToolHeader
          title="PDF 提取图片"
          description="从 PDF 中批量提取所有原始图片，支持各种颜色空间"
        />
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-all ${
            dragOver ? "border-primary-500 bg-primary-50" : "border-slate-300 bg-white hover:border-primary-400 hover:bg-slate-50"
          }`}
        >
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
                <ToolUsage tool={getToolById("extract-image")!} />
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

  if (step === "extracting") {
    return (
      <>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ToolHeader title="PDF 提取图片" description="正在解析..." />
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
          <p className="text-slate-600">正在提取图片...</p>
        </div>
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <ToolHeader title="PDF 提取图片" description={`从 ${fileName} 中提取了 ${images.length} 张图片`} />

      <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex-1 text-sm text-slate-600">
          共 <span className="font-semibold text-primary-600">{images.length}</span> 张图片
          · 合计 <span className="font-semibold">{formatSize(images.reduce((s, i) => s + i.size, 0))}</span>
        </div>
        <button onClick={handleDownloadAll} disabled={images.length === 0}
          className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:bg-slate-300">
          📦 全部下载 (ZIP)
        </button>
        <button onClick={handleReset} className="text-xs text-slate-400 hover:text-red-500">处理其他文件</button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {images.map((img, idx) => (
          <div key={idx} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm hover:border-primary-300 hover:shadow-md transition-all group">
            <div className="mb-1 flex items-center justify-between">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{img.name}</span>
              <span className="text-[10px] text-slate-400">p{img.page}</span>
            </div>
            <div className="flex items-center justify-center overflow-hidden rounded bg-slate-50" style={{ minHeight: 100 }}>
              <img src={img.previewUrl} alt={img.name} className="max-h-28 max-w-full object-contain" style={{ imageRendering: "pixelated" }} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-[10px] text-slate-400">
                {img.width}×{img.height} · {formatSize(img.size)}
              </div>
              <button onClick={() => handleDownloadOne(img)}
                className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-primary-100 hover:text-primary-600">
                下载
              </button>
            </div>
          </div>
        ))}
      </div>
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
