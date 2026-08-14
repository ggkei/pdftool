"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { useFileGuard } from "@/hooks/useFileGuard";
import { FileGuardModal } from "@/components/FileGuardModal";
import { addWatermarkToPdf, type WatermarkOptions } from "@/lib/pdf/addWatermark";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

type Step = "config" | "processing" | "done";

export default function PdfWatermarkPage() {
  const [step, setStep] = useState<Step>("config");
  const guard = useFileGuard("watermark");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingMb, setPendingMb] = useState(0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [inputBytes, setInputBytes] = useState<Uint8Array | null>(null);
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null);
  const [totalPages, setTotalPages] = useState(0);

  const [type, setType] = useState<"text" | "image">("text");
  const [text, setText] = useState("机密文件");
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState("#c00000");
  const [opacity, setOpacity] = useState(30);
  const [rotation, setRotation] = useState(-30);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgBytes, setImgBytes] = useState<Uint8Array | null>(null);
  const [imgScale, setImgScale] = useState(50);

  const inputRef = useRef<HTMLInputElement>(null);

  const handlePdfFile = useCallback(async (f: File) => {
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
    setOutputBytes(null);
    setStep("config");
  }, []);

  const handleImgFile = useCallback(async (f: File | null) => {
    if (!f) { setImgFile(null); setImgBytes(null); return; }
    if (!/\.(png|jpe?g)$/i.test(f.name)) { setError("图片水印仅支持 PNG 或 JPG"); return; }
    setImgFile(f);
    setImgBytes(new Uint8Array(await f.arrayBuffer()));
    setError("");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handlePdfFile(f);
  }, [handlePdfFile]);

  const handleApply = useCallback(async () => {
    if (!inputBytes) return;
    if (type === "image" && !imgBytes) { setError("请先上传水印图片"); return; }
    setError(""); setStep("processing");
    const opts: WatermarkOptions = {
      type, text: type === "text" ? text : undefined,
      fontSize, color, opacity: opacity / 100, rotation,
      scale: imgScale / 100, imageBytes: imgBytes ?? undefined,
    };
    try {
      const { pageCount, outputBytes } = await addWatermarkToPdf(inputBytes, opts);
      setTotalPages(pageCount);
      setOutputBytes(outputBytes);
      setStep("done");
    } catch (err: any) {
      setError(err?.message || "添加水印失败");
      setStep("config");
    }
  }, [inputBytes, type, text, fontSize, color, opacity, rotation, imgScale, imgBytes]);

  const handleDownload = useCallback(() => {
    if (!outputBytes) return;
    const url = URL.createObjectURL(new Blob([outputBytes as any], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/\.pdf$/i, "") + "_watermarked.pdf";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [outputBytes, fileName]);

  const handleReset = useCallback(() => {
    setStep("config"); setOutputBytes(null); setError("");
  }, []);

  const handleNew = useCallback(() => {
    setInputBytes(null); setOutputBytes(null); setFileName(""); setError("");
    setImgFile(null); setImgBytes(null); setStep("config");
  }, []);

  const retryHandleRef = useRef<typeof handlePdfFile | null>(null);
  retryHandleRef.current = handlePdfFile;

  useEffect(() => {
    if (!guard.level && pendingFile && retryHandleRef.current) {
      const f = pendingFile;
      setPendingFile(null);
      retryHandleRef.current(f);
    }
  }, [guard.level, pendingFile]);

  // Upload screen
  if (!inputBytes) {
    return (
      <>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ToolHeader title="PDF 加水印" description="在每页添加文字或图片水印" />
        <div onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-all ${
            dragOver ? "border-primary-500 bg-primary-50" : "border-slate-300 bg-white hover:border-primary-400 hover:bg-slate-50"
          }`}>
          <input ref={inputRef} type="file" accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfFile(f); e.target.value = ""; }} className="hidden" />
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
            <svg className="h-8 w-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="mb-1 text-lg font-medium text-slate-700">点击上传 PDF，或拖到此处</p>
          <p className="text-sm text-slate-500">支持 .pdf 格式</p>
        </div>
        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                <ToolUsage tool={getToolById("watermark")!} />
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

  // Processing
  if (step === "processing") {
    return (
      <>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ToolHeader title="PDF 加水印" description={fileName} />
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
          <p className="text-slate-600">正在添加水印...</p>
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

  // Done
  if (step === "done" && outputBytes) {
    return (
      <>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ToolHeader title="PDF 加水印" description="已完成！" />
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="mb-2 text-xl font-semibold text-slate-800">水印已添加成功</h3>
          <p className="mb-6 text-sm text-slate-500">共处理 {totalPages} 页</p>
          <div className="flex justify-center gap-3">
            <button onClick={handleDownload} className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700">
              💾 下载加水印后的 PDF
            </button>
            <button onClick={handleReset} className="rounded-lg border border-slate-300 bg-white px-6 py-2 text-sm text-slate-600 hover:bg-slate-50">
              重新设置
            </button>
            <button onClick={handleNew} className="rounded-lg border border-slate-300 bg-white px-6 py-2 text-sm text-slate-600 hover:bg-slate-50">
              处理其他文件
            </button>
          </div>
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

  // Config
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ToolHeader title="PDF 加水印" description={fileName} />
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
            <button onClick={() => setType("text")} className={`flex-1 rounded-md px-3 py-1.5 ${type === "text" ? "bg-white text-primary-600 shadow-sm font-medium" : "text-slate-500"}`}>文字水印</button>
            <button onClick={() => setType("image")} className={`flex-1 rounded-md px-3 py-1.5 ${type === "image" ? "bg-white text-primary-600 shadow-sm font-medium" : "text-slate-500"}`}>图片水印</button>
          </div>

          {type === "text" ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">水印文字</label>
                <input type="text" value={text} onChange={(e) => setText(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="例如：机密文件" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">字号：{fontSize}px</label>
                <input type="range" min={12} max={120} value={fontSize} onChange={(e) => setFontSize(+e.target.value)} className="w-full" />
              </div>
              <div className="flex items-center gap-2">
                <label className="mb-1 block text-xs font-medium text-slate-600 w-14">颜色</label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 rounded border border-slate-300" />
                <span className="text-xs text-slate-500">{color}</span>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">水印图片（PNG/JPG）</label>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center hover:border-primary-400">
                  <input type="file" accept="image/png,image/jpeg" className="hidden"
                    onChange={(e) => handleImgFile(e.target.files?.[0] ?? null)} />
                  {imgFile ? (
                    <>
                      <div className="mb-2 text-xs text-slate-500 truncate w-full">{imgFile.name}</div>
                      <div className="text-[11px] text-primary-600">点击更换</div>
                    </>
                  ) : (
                    <>
                      <div className="mb-1 text-slate-500">📷</div>
                      <div className="text-xs text-slate-500">点击上传水印图</div>
                    </>
                  )}
                </label>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">缩放：{imgScale}%</label>
                <input type="range" min={10} max={200} value={imgScale} onChange={(e) => setImgScale(+e.target.value)} className="w-full" />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">不透明度：{opacity}%</label>
            <input type="range" min={5} max={100} value={opacity} onChange={(e) => setOpacity(+e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">旋转角度：{rotation}°</label>
            <input type="range" min={-90} max={90} value={rotation} onChange={(e) => setRotation(+e.target.value)} className="w-full" />
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

          <button onClick={handleApply}
            className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
            ✓ 应用水印
          </button>
          <button onClick={handleNew} className="w-full text-xs text-slate-400 hover:text-slate-600">处理其他文件</button>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-slate-600">预览效果</h3>
          <div className="mx-auto flex h-64 w-full items-center justify-center overflow-hidden rounded-lg bg-slate-100">
            <div className="relative" style={{ width: 200, height: 280, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
              <div className="p-2 text-[8px] text-slate-300">PDF 页面占位</div>
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  opacity: opacity / 100,
                  color,
                  fontSize: type === "text" ? fontSize / 2.5 : 14,
                  fontWeight: 700,
                  letterSpacing: 2,
                  userSelect: "none",
                }}
              >
                {type === "text" ? (
                  text || "水印文字"
                ) : imgFile ? (
                  <img src={URL.createObjectURL(imgFile)} style={{ maxWidth: "80%", opacity: 0.8 }} alt="" />
                ) : (
                  <span className="text-slate-400 text-xs">图片预览</span>
                )}
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-400">⚠️ 仅为近似效果预览，实际以生成 PDF 为准</p>
        </div>
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
