"use client";

import { useState, useRef, useCallback } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

type Step = "upload" | "preview" | "done";

export default function ImageResizePage() {
  const [step, setStep] = useState<Step>("upload");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [targetWidth, setTargetWidth] = useState(0);
  const [targetHeight, setTargetHeight] = useState(0);
  const [maintainRatio, setMaintainRatio] = useState(true);
  const [ratio, setRatio] = useState(1);
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError(t("img_resize.error_format"));
      return;
    }
    setError("");
    setOriginalFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const img = new Image();
    img.onload = () => {
      setWidth(img.naturalWidth);
      setHeight(img.naturalHeight);
      setTargetWidth(img.naturalWidth);
      setTargetHeight(img.naturalHeight);
      setRatio(img.naturalWidth / img.naturalHeight);
      setStep("preview");
    };
    img.src = url;
  }, []);

  const resize = useCallback(() => {
    if (!originalFile || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setResultUrl(url);
          setStep("done");
        }
      }, originalFile.type || "image/jpeg");
    };
    img.src = previewUrl;
  }, [originalFile, targetWidth, targetHeight, previewUrl]);

  const handleWidthChange = (val: number) => {
    setTargetWidth(val);
    if (maintainRatio) {
      setTargetHeight(Math.round(val / ratio));
    }
  };

  const handleHeightChange = (val: number) => {
    setTargetHeight(val);
    if (maintainRatio) {
      setTargetWidth(Math.round(val * ratio));
    }
  };

  const download = () => {
    if (!resultUrl || !originalFile) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `${originalFile.name.replace(/\.[^.]+$/, "")}_resized.${originalFile.name.split(".").pop()}`;
    a.click();
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setStep("upload");
    setOriginalFile(null);
    setPreviewUrl("");
    setResultUrl("");
    setError("");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      reset();
      setTimeout(() => handleFile(file), 0);
    }
  };

  const tool = getToolById("image-resize")!;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      {step === "upload" && (
        <div
          className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
            dragOver ? "border-brand-400 bg-brand-50" : "border-slate-300 bg-white/60"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <div className="mb-4 text-5xl">&#128248;</div>
          <p className="mb-2 text-sm font-medium text-zinc-700">{t("img_resize.drag_hint")}</p>
          <p className="mb-6 text-xs text-zinc-400">{t("img_resize.drag_hint2")}</p>
          <button onClick={() => inputRef.current?.click()} className="btn-primary">{t("img_resize.select_image")}</button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </div>
      )}

      {(step === "preview" || step === "done") && (
        <div className="space-y-6"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
    {dragOver && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-50/80 border-4 border-dashed border-brand-400 rounded-2xl pointer-events-none">
        <p className="text-lg font-medium text-brand-700">{t("common.drag_replace")}</p>
      </div>
    )}
          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="ratio"
                checked={maintainRatio}
                onChange={(e) => setMaintainRatio(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor="ratio" className="text-sm text-zinc-600">{t("img_resize.lock_ratio")}</label>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  {t("img_resize.width_orig")}: {width}px
                </label>
                <input
                  type="number"
                  value={targetWidth}
                  onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  {t("img_resize.height_orig")}: {height}px
                </label>
                <input
                  type="number"
                  value={targetHeight}
                  onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={resize} className="btn-primary">{t("img_resize.btn_resize")}</button>
              <button onClick={reset} className="btn-secondary">{t("common.reupload")}</button>
            </div>
          </div>

          {step === "done" && resultUrl && (
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-zinc-700">{t("img_resize.result_title")}</h3>
                <p className="text-xs text-zinc-500">{targetWidth} x {targetHeight} px</p>
              </div>
              <img src={resultUrl} alt="resized" className="max-h-64 w-auto rounded-lg mb-4" />
              <button onClick={download} className="btn-primary">{t("img_resize.download")}</button>
            </div>
          )}

          {previewUrl && (
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
              <p className="text-xs text-zinc-500 mb-2">{t("img_resize.preview_dims")} ({width} x {height})</p>
              <img src={previewUrl} alt="preview" className="max-h-48 w-auto rounded-lg" />
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
