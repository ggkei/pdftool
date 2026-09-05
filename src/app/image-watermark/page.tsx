"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

type Step = "upload" | "edit" | "done";

export default function ImageWatermarkPage() {
  const [step, setStep] = useState<Step>("upload");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [watermarkText, setWatermarkText] = useState("atoolx.cn");
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(0.3);
  const [rotation, setRotation] = useState(-30);
  const [color, setColor] = useState("#ffffff");
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgDimensions, setImgDimensions] = useState({ w: 0, h: 0 });

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError(t("img_watermark.error_format"));
      return;
    }
    setError("");
    setOriginalFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const img = new Image();
    img.onload = () => {
      setImgDimensions({ w: img.naturalWidth, h: img.naturalHeight });
      setStep("edit");
    };
    img.src = url;
  }, []);

  const applyWatermark = useCallback(() => {
    if (!originalFile || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const rad = (rotation * Math.PI) / 180;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);

      const spacingX = 300;
      const spacingY = 200;
      const cols = Math.ceil(canvas.width / spacingX) + 4;
      const rows = Math.ceil(canvas.height / spacingY) + 4;

      for (let i = -cols / 2; i <= cols / 2; i++) {
        for (let j = -rows / 2; j <= rows / 2; j++) {
          ctx.fillText(watermarkText, i * spacingX, j * spacingY);
        }
      }
      ctx.restore();

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setResultUrl(url);
          setStep("done");
        }
      }, originalFile.type || "image/jpeg");
    };
    img.src = previewUrl;
  }, [originalFile, watermarkText, fontSize, opacity, rotation, color, previewUrl]);

  const download = () => {
    if (!resultUrl || !originalFile) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `${originalFile.name.replace(/\.[^.]+$/, "")}_watermarked.${originalFile.name.split(".").pop()}`;
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

  const tool = getToolById("image-watermark")!;

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
          <div className="mb-4 text-5xl">&#128208;</div>
          <p className="mb-2 text-sm font-medium text-zinc-700">{t("img_watermark.drag_hint")}</p>
          <p className="mb-6 text-xs text-zinc-400">{t("common.privacy_badge")}</p>
          <button onClick={() => inputRef.current?.click()} className="btn-primary">{t("img_watermark.select_image")}</button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </div>
      )}

      {(step === "edit" || step === "done") && (
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
            <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("img_watermark.settings")}</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("img_watermark.text_label")}</label>
                <input type="text" value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("img_watermark.font_size")}: {fontSize}px</label>
                <input type="range" min="16" max="120" value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-full" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("img_watermark.opacity")}: {Math.round(opacity * 100)}%</label>
                <input type="range" min="0.05" max="1" step="0.05" value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("img_watermark.rotation")}: {rotation}°</label>
                <input type="range" min="-90" max="90" value={rotation}
                  onChange={(e) => setRotation(parseInt(e.target.value))}
                  className="w-full" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("img_watermark.color")}</label>
                <input type="color" value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200" />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={applyWatermark} className="btn-primary">{t("img_watermark.btn_apply")}</button>
              <button onClick={reset} className="btn-secondary">{t("common.reupload")}</button>
            </div>
          </div>

          {step === "done" && resultUrl && (
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("img_watermark.result_title")}</h3>
              <img src={resultUrl} alt="watermarked" className="max-h-64 w-auto rounded-lg mb-4" />
              <button onClick={download} className="btn-primary">{t("util_common.download")}</button>
            </div>
          )}

          {previewUrl && (
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
              <p className="text-xs text-zinc-500 mb-2">{t("img_watermark.preview_dims")} ({imgDimensions.w}x{imgDimensions.h})</p>
              <img src={previewUrl} alt="preview" className="max-h-48 w-auto rounded-lg" />
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
