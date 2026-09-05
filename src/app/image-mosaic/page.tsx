"use client";

import { useState, useRef, useCallback } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

type Step = "upload" | "edit" | "done";

export default function ImageMosaicPage() {
  const [step, setStep] = useState<Step>("upload");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [blockSize, setBlockSize] = useState(15);
  const [isDrawing, setIsDrawing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const displayScaleRef = useRef(1);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError(t("img_mosaic.error_format"));
      return;
    }
    setError("");
    setOriginalFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setResultUrl("");

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;

      /* 内部以原图尺寸绘制，但CSS限制显示宽度 */
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      ctxRef.current = ctx;

      /* 计算CSS显示缩放 */
      const maxDisplay = Math.min(600, window.innerWidth - 64);
      const scale = Math.min(1, maxDisplay / img.naturalWidth);
      displayScaleRef.current = scale;

      setStep("edit");
    };
    img.src = url;
  }, []);

  /* 鼠标坐标 → Canvas像素坐标 */
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.floor(cssX * scaleX),
      y: Math.floor(cssY * scaleY),
    };
  };

  const applyMosaic = (cx: number, cy: number) => {
    const ctx = ctxRef.current;
    if (!ctx || !imgRef.current) return;
    const img = imgRef.current;
    const bs = blockSize;

    const startX = Math.floor(cx / bs) * bs;
    const startY = Math.floor(cy / bs) * bs;

    for (let dy = 0; dy < bs && startY + dy < img.naturalHeight; dy++) {
      for (let dx = 0; dx < bs && startX + dx < img.naturalWidth; dx++) {
        /* 取块中心像素颜色 */
        const px = Math.min(startX + Math.floor(bs / 2), img.naturalWidth - 1);
        const py = Math.min(startY + Math.floor(bs / 2), img.naturalHeight - 1);
        const pixel = ctx.getImageData(px, py, 1, 1).data;
        ctx.fillStyle = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
        ctx.fillRect(startX + dx, startY + dy, 1, 1);
      }
    }
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);
    applyMosaic(x, y);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const { x, y } = getCanvasCoords(e);
    applyMosaic(x, y);
  };

  const onMouseUp = () => setIsDrawing(false);

  const saveResult = () => {
    const canvas = canvasRef.current;
    if (!canvas || !originalFile) return;
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        setResultUrl(url);
        setStep("done");
      }
    }, originalFile.type || "image/jpeg");
  };

  const download = () => {
    if (!resultUrl || !originalFile) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `${originalFile.name.replace(/\.[^.]+$/, "")}_mosaic.${originalFile.name.split(".").pop()}`;
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
    setIsDrawing(false);
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

  const tool = getToolById("image-mosaic")!;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      {step === "upload" && (
        <div className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
          dragOver ? "border-brand-400 bg-brand-50" : "border-slate-300 bg-white/60"
        }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}>
          <div className="mb-4 text-5xl">&#128065;</div>
          <p className="mb-2 text-sm font-medium text-zinc-700">{t("img_mosaic.drag_hint")}</p>
          <p className="mb-6 text-xs text-zinc-400">{t("img_mosaic.drag_hint2")}</p>
          <button onClick={() => inputRef.current?.click()} className="btn-primary">{t("img_mosaic.select_image")}</button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </div>
      )}

      {step === "edit" && (
        <div className="space-y-4"
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
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-zinc-500">{t("img_mosaic.block_size_label")}: {blockSize}px</label>
              <input type="range" min="5" max="50" value={blockSize}
                onChange={(e) => setBlockSize(parseInt(e.target.value))} className="w-full" />
            </div>
            <p className="text-xs text-zinc-500 mb-4">{t("img_mosaic.draw_hint")}</p>

            <div className="overflow-auto rounded-lg border border-slate-200">
              <canvas
                ref={canvasRef}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                style={{ maxWidth: "100%", cursor: "crosshair", display: "block" }}
              />
            </div>

            <div className="mt-4 flex gap-3">
              <button onClick={saveResult} className="btn-primary">{t("img_mosaic.btn_done")}</button>
              <button onClick={reset} className="btn-secondary">{t("common.reupload")}</button>
            </div>
          </div>
        </div>
      )}

      {step === "done" && resultUrl && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
            <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("img_mosaic.result_title")}</h3>
            <img src={resultUrl} alt="mosaic" className="max-h-64 w-auto rounded-lg mb-4" />
            <div className="flex gap-3">
              <button onClick={download} className="btn-primary">{t("img_mosaic.download")}</button>
              <button onClick={reset} className="btn-secondary">{t("common.reupload")}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
