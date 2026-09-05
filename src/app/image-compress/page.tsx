"use client";

import { useState, useRef, useCallback } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

type Step = "upload" | "preview" | "done";

export default function ImageCompressPage() {
  const [step, setStep] = useState<Step>("upload");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalSize, setOriginalSize] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [quality, setQuality] = useState(0.8);
  const [format, setFormat] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");
  const [compressedUrl, setCompressedUrl] = useState("");
  const [compressedSize, setCompressedSize] = useState(0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formatExt = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError(t("img_compress.error_format"));
      return;
    }
    setError("");
    setOriginalFile(file);
    setOriginalSize(file.size);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStep("preview");
    setCompressedUrl("");
  }, []);

  const compress = useCallback(() => {
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
            setCompressedUrl(url);
            setCompressedSize(blob.size);
            setStep("done");
          }
        },
        format,
        quality
      );
    };
    img.src = previewUrl;
  }, [originalFile, format, quality, previewUrl]);

  const download = () => {
    if (!compressedUrl || !originalFile) return;
    const a = document.createElement("a");
    a.href = compressedUrl;
    const ext = formatExt[format];
    a.download = `${originalFile.name.replace(/\.[^.]+$/, "")}_compressed.${ext}`;
    a.click();
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (compressedUrl) URL.revokeObjectURL(compressedUrl);
    setStep("upload");
    setOriginalFile(null);
    setPreviewUrl("");
    setCompressedUrl("");
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

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  };

  const savedPercent = originalSize > 0 && compressedSize > 0
    ? Math.round(((originalSize - compressedSize) / originalSize) * 100)
    : 0;

  const tool = getToolById("image-compress")!;

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
          <div className="mb-4 text-5xl">&#128247;</div>
          <p className="mb-2 text-sm font-medium text-zinc-700">{t("img_compress.drag_hint")}</p>
          <p className="mb-6 text-xs text-zinc-400">{t("img_compress.drag_hint2")}</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="btn-primary"
          >
            {t("img_compress.select_image")}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
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
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("img_compress.output_format")}</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="image/jpeg">{t("img_compress.format_jpeg")}</option>
                  <option value="image/png">{t("img_compress.format_png")}</option>
                  <option value="image/webp">{t("img_compress.format_webp")}</option>
                </select>
              </div>
              {format !== "image/png" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">
                    {t("img_compress.quality_value")}: <span className="text-brand-600 font-semibold">{Math.round(quality * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={quality}
                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                    <span>{t("img_compress.quality_small")}</span>
                    <span>{t("img_compress.quality_high")}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={compress} className="btn-primary" disabled={!originalFile}>
                {t("img_compress.btn_compress")}
              </button>
              <button onClick={reset} className="btn-secondary">{t("common.reupload")}</button>
            </div>
          </div>

          {step === "done" && compressedUrl && (
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <div className="grid md:grid-cols-2 gap-6 items-center">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-700 mb-2">{t("img_compress.result_title")}</h3>
                  <div className="space-y-1 text-sm text-zinc-500">
                    <p>{t("img_compress.original_size")}<span className="text-zinc-800 font-medium">{formatSize(originalSize)}</span></p>
                    <p>{t("img_compress.compressed_size")}<span className="text-brand-600 font-medium">{formatSize(compressedSize)}</span></p>
                    <p>{t("img_compress.saved_space")}<span className="text-emerald-600 font-medium">{savedPercent}%</span></p>
                  </div>
                  <button onClick={download} className="btn-primary mt-4">
                    {t("img_compress.download")}
                  </button>
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <img src={compressedUrl} alt="compressed" className="w-full h-auto max-h-64 object-contain" />
                </div>
              </div>
            </div>
          )}

          {previewUrl && (
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
              <p className="text-xs text-zinc-500 mb-2">{t("img_compress.preview_original")}</p>
              <img src={previewUrl} alt="preview" className="max-h-48 w-auto rounded-lg" />
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
