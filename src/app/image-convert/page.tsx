"use client";

import { useState, useRef, useCallback } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

type Step = "upload" | "preview" | "done";
type TargetFormat = "image/jpeg" | "image/png" | "image/webp";

export default function ImageConvertPage() {
  const [step, setStep] = useState<Step>("upload");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [targetFormat, setTargetFormat] = useState<TargetFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formatLabels: Record<TargetFormat, string> = {
    "image/jpeg": "JPG",
    "image/png": "PNG",
    "image/webp": "WebP",
  };

  const formatExts: Record<TargetFormat, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError(t("img_convert.error_format"));
      return;
    }
    setError("");
    setOriginalFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStep("preview");
    setResultUrl("");
  }, []);

  const convert = useCallback(() => {
    if (!originalFile || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setResultUrl(url);
            setStep("done");
          }
        },
        targetFormat,
        targetFormat === "image/png" ? undefined : quality
      );
    };
    img.src = previewUrl;
  }, [originalFile, targetFormat, quality, previewUrl]);

  const download = () => {
    if (!resultUrl || !originalFile) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    const ext = formatExts[targetFormat];
    a.download = `${originalFile.name.replace(/\.[^.]+$/, "")}_converted.${ext}`;
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

  const tool = getToolById("image-convert")!;

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
          <div className="mb-4 text-5xl">&#128260;</div>
          <p className="mb-2 text-sm font-medium text-zinc-700">{t("img_convert.drag_hint")}</p>
          <p className="mb-6 text-xs text-zinc-400">{t("img_convert.drag_hint2")}</p>
          <button onClick={() => inputRef.current?.click()} className="btn-primary">{t("img_convert.select_image")}</button>
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
            <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("img_convert.target_format")}</h3>
            <div className="grid grid-cols-3 gap-3">
              {(["image/jpeg", "image/png", "image/webp"] as TargetFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setTargetFormat(fmt)}
                  className={`rounded-xl border-2 py-4 text-sm font-medium transition-all ${
                    targetFormat === fmt
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 bg-white text-zinc-600 hover:border-slate-300"
                  }`}
                >
                  {formatLabels[fmt]}
                </button>
              ))}
            </div>

            {targetFormat !== "image/png" && (
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  {t("img_convert.quality_value")}: {Math.round(quality * 100)}%
                </label>
                <input
                  type="range" min="0.1" max="1" step="0.05"
                  value={quality} onChange={(e) => setQuality(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button onClick={convert} className="btn-primary">{t("img_convert.btn_convert")}</button>
              <button onClick={reset} className="btn-secondary">{t("common.reupload")}</button>
            </div>
          </div>

          {step === "done" && resultUrl && (
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-4">
                {t("img_convert.result_title")} → {formatLabels[targetFormat]}
              </h3>
              <img src={resultUrl} alt="converted" className="max-h-64 w-auto rounded-lg mb-4" />
              <button onClick={download} className="btn-primary">
                {t("img_convert.download_btn")} {formatLabels[targetFormat]} {t("img_convert.file_suffix")}
              </button>
            </div>
          )}

          {previewUrl && (
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
              <p className="text-xs text-zinc-500 mb-2">{t("img_convert.preview_original")}</p>
              <img src={previewUrl} alt="preview" className="max-h-48 w-auto rounded-lg" />
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
