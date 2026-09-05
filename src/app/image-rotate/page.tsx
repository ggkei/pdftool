"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

type Step = "upload" | "preview";

type RotateOp = {
  type: "rotate" | "flipH" | "flipV";
  value: number;
};

export default function ImageRotatePage() {
  const [step, setStep] = useState<Step>("upload");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [ops, setOps] = useState<RotateOp[]>([]);
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [customAngle, setCustomAngle] = useState(90);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError(t("img_rotate.error_format"));
      return;
    }
    setError("");
    setOriginalFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setOps([]);
    setResultUrl("");
    setStep("preview");
  }, []);

  const applyOps = useCallback((imageUrl: string, operations: RotateOp[]): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let srcCanvas = document.createElement("canvas");
        srcCanvas.width = img.naturalWidth;
        srcCanvas.height = img.naturalHeight;
        const srcCtx = srcCanvas.getContext("2d")!;
        srcCtx.drawImage(img, 0, 0);

        for (const op of operations) {
          const tempCanvas = document.createElement("canvas");
          const tempCtx = tempCanvas.getContext("2d")!;

          if (op.type === "rotate") {
            const deg = op.value % 360;
            const rad = (deg * Math.PI) / 180;
            const absCos = Math.abs(Math.cos(rad));
            const absSin = Math.abs(Math.sin(rad));
            const newW = Math.round(srcCanvas.width * absCos + srcCanvas.height * absSin);
            const newH = Math.round(srcCanvas.width * absSin + srcCanvas.height * absCos);
            tempCanvas.width = newW;
            tempCanvas.height = newH;
            tempCtx.save();
            tempCtx.translate(newW / 2, newH / 2);
            tempCtx.rotate(rad);
            tempCtx.drawImage(srcCanvas, -srcCanvas.width / 2, -srcCanvas.height / 2);
            tempCtx.restore();
          } else if (op.type === "flipH") {
            tempCanvas.width = srcCanvas.width;
            tempCanvas.height = srcCanvas.height;
            tempCtx.translate(tempCanvas.width, 0);
            tempCtx.scale(-1, 1);
            tempCtx.drawImage(srcCanvas, 0, 0);
          } else if (op.type === "flipV") {
            tempCanvas.width = srcCanvas.width;
            tempCanvas.height = srcCanvas.height;
            tempCtx.translate(0, tempCanvas.height);
            tempCtx.scale(1, -1);
            tempCtx.drawImage(srcCanvas, 0, 0);
          }
          srcCanvas = tempCanvas;
        }

        const outCanvas = document.createElement("canvas");
        outCanvas.width = srcCanvas.width;
        outCanvas.height = srcCanvas.height;
        const outCtx = outCanvas.getContext("2d")!;
        outCtx.drawImage(srcCanvas, 0, 0);
        outCanvas.toBlob((blob) => {
          if (blob) resolve(URL.createObjectURL(blob));
        }, originalFile?.type || "image/jpeg");
      };
      img.src = imageUrl;
    });
  }, [originalFile]);

  useEffect(() => {
    if (!previewUrl || ops.length === 0) {
      if (ops.length === 0) setResultUrl("");
      return;
    }
    let cancelled = false;
    applyOps(previewUrl, ops).then((url) => {
      if (!cancelled) setResultUrl(url);
    });
    return () => { cancelled = true; };
  }, [ops, previewUrl, applyOps]);

  const addOp = (op: RotateOp) => {
    setOps((prev) => [...prev, op]);
  };

  const undo = () => {
    setOps((prev) => prev.slice(0, -1));
  };

  const resetOps = () => {
    setOps([]);
  };

  const download = () => {
    if (!resultUrl || !originalFile) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `${originalFile.name.replace(/\.[^.]+$/, "")}_rotated.${originalFile.name.split(".").pop()}`;
    a.click();
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setStep("upload");
    setOriginalFile(null);
    setPreviewUrl("");
    setResultUrl("");
    setOps([]);
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

  const tool = getToolById("image-rotate")!;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
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
          <p className="mb-2 text-sm font-medium text-zinc-700">{t("img_rotate.drag_hint")}</p>
          <p className="mb-6 text-xs text-zinc-400">{t("img_rotate.preview_hint")}</p>
          <button onClick={() => inputRef.current?.click()} className="btn-primary">{t("img_rotate.select_image")}</button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
            <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("img_rotate.operations")}</h3>
            <p className="text-xs text-zinc-500 mb-4">{t("img_rotate.preview")}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <button onClick={() => addOp({ type: "rotate", value: 90 })}
                className="rounded-xl border-2 border-slate-200 bg-white py-3 px-2 text-sm font-medium text-zinc-600 hover:border-brand-400 hover:bg-brand-50 transition-all active:scale-[0.97]">
                <span className="block text-lg mb-1">&#8635;</span>
                {t("img_rotate.rotate_cw_90")}
              </button>
              <button onClick={() => addOp({ type: "rotate", value: -90 })}
                className="rounded-xl border-2 border-slate-200 bg-white py-3 px-2 text-sm font-medium text-zinc-600 hover:border-brand-400 hover:bg-brand-50 transition-all active:scale-[0.97]">
                <span className="block text-lg mb-1">&#8634;</span>
                {t("img_rotate.rotate_ccw_90")}
              </button>
              <button onClick={() => addOp({ type: "rotate", value: 180 })}
                className="rounded-xl border-2 border-slate-200 bg-white py-3 px-2 text-sm font-medium text-zinc-600 hover:border-brand-400 hover:bg-brand-50 transition-all active:scale-[0.97]">
                <span className="block text-lg mb-1">&#8597;</span>
                {t("img_rotate.rotate_180")}
              </button>
              <button onClick={() => addOp({ type: "flipH", value: 0 })}
                className="rounded-xl border-2 border-slate-200 bg-white py-3 px-2 text-sm font-medium text-zinc-600 hover:border-brand-400 hover:bg-brand-50 transition-all active:scale-[0.97]">
                <span className="block text-lg mb-1">&#8596;</span>
                {t("img_rotate.flip_h")}
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-zinc-600">{t("img_rotate.custom_angle")}:</span>
              <input type="number" value={customAngle} onChange={(e) => setCustomAngle(parseInt(e.target.value) || 0)}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm text-center" />
              <span className="text-sm text-zinc-400">{t("img_rotate.degrees")}</span>
              <button onClick={() => addOp({ type: "rotate", value: customAngle })}
                className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-brand-700 transition-colors">
                {t("img_rotate.apply")}
              </button>
            </div>

            <div className="mb-4">
              <button onClick={() => addOp({ type: "flipV", value: 0 })}
                className="rounded-xl border-2 border-slate-200 bg-white py-3 px-6 text-sm font-medium text-zinc-600 hover:border-brand-400 hover:bg-brand-50 transition-all active:scale-[0.97]">
                <span className="text-lg mr-2">&#8597;</span>
                {t("img_rotate.flip_v")}
              </button>
            </div>

            {ops.length > 0 && (
              <div className="mb-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-zinc-500">{t("img_rotate.ops_history")} ({ops.length} {t("img_rotate.steps")})</span>
                  <div className="flex gap-2">
                    <button onClick={undo} disabled={ops.length === 0}
                      className="text-xs text-brand-600 hover:text-brand-700 disabled:text-zinc-300 font-medium">{t("img_rotate.undo")}</button>
                    <button onClick={resetOps}
                      className="text-xs text-red-500 hover:text-red-600 font-medium">{t("img_rotate.reset")}</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ops.map((op, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] text-zinc-600">
                      {i + 1}. {op.type === "rotate" ? t("img_rotate.rotate_label").replace("{n}", String(op.value)) : op.type === "flipH" ? t("img_rotate.flip_h") : t("img_rotate.flip_v")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={download} disabled={!resultUrl}
                className="btn-primary disabled:opacity-40">{t("util_common.download")}</button>
              <button onClick={reset} className="btn-secondary">{t("common.reupload")}</button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
              <p className="text-xs text-zinc-500 mb-2">{t("img_rotate.preview_original")}</p>
              <img src={previewUrl} alt="preview" className="max-h-48 w-auto rounded-lg mx-auto" />
            </div>

            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
              <p className="text-xs text-zinc-500 mb-2">{t("img_rotate.live_preview")} {ops.length > 0 ? t("img_rotate.applied_ops").replace("{n}", String(ops.length)) : t("img_rotate.no_ops")}</p>
              {resultUrl ? (
                <img src={resultUrl} alt="result" className="max-h-48 w-auto rounded-lg mx-auto" />
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-zinc-300">
                  {t("img_rotate.preview")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
