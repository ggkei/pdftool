"use client";

import { useState, useRef, useCallback } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

type Step = "upload" | "edit" | "done";

export default function ImageBeautifyPage() {
  const [step, setStep] = useState<Step>("upload");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [smooth, setSmooth] = useState(40);
  const [whiten, setWhiten] = useState(30);
  const [rosy, setRosy] = useState(25);
  const [sharp, setSharp] = useState(20);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError(t("img_beautify.error_format"));
      return;
    }
    setError("");
    setOriginalFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStep("edit");
    setResultUrl("");
  }, []);

  /* Separable box blur (fast) */
  const boxBlur = (src: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray => {
    if (radius <= 0) return new Uint8ClampedArray(src);
    const temp = new Uint8ClampedArray(src.length);
    const dst = new Uint8ClampedArray(src.length);

    /* Horizontal */
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.max(0, Math.min(w - 1, x + dx));
          const idx = (y * w + nx) * 4;
          r += src[idx]; g += src[idx + 1]; b += src[idx + 2];
          count++;
        }
        const idx = (y * w + x) * 4;
        temp[idx] = r / count; temp[idx + 1] = g / count; temp[idx + 2] = b / count;
        temp[idx + 3] = src[idx + 3];
      }
    }

    /* Vertical */
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = Math.max(0, Math.min(h - 1, y + dy));
          const idx = (ny * w + x) * 4;
          r += temp[idx]; g += temp[idx + 1]; b += temp[idx + 2];
          count++;
        }
        const idx = (y * w + x) * 4;
        dst[idx] = r / count; dst[idx + 1] = g / count; dst[idx + 2] = b / count;
        dst[idx + 3] = temp[idx + 3];
      }
    }
    return dst;
  };

  const applyBeautify = useCallback(() => {
    if (!originalFile || !canvasRef.current) return;
    setProcessing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setProcessing(false); return; }

    const img = new Image();
    img.onload = () => {
      /* Limit processing size for performance */
      const maxDim = 2000;
      let cw = img.naturalWidth;
      let ch = img.naturalHeight;
      if (cw > maxDim || ch > maxDim) {
        const s = maxDim / Math.max(cw, ch);
        cw = Math.round(cw * s);
        ch = Math.round(ch * s);
      }
      canvas.width = cw;
      canvas.height = ch;
      ctx.drawImage(img, 0, 0, cw, ch);

      const imageData = ctx.getImageData(0, 0, cw, ch);
      const data = imageData.data;

      /* 1. Skin smoothing: blur then blend (high-frequency detail保留) */
      if (smooth > 0) {
        const radius = Math.max(1, Math.floor(smooth / 6));
        const blurred = boxBlur(data, cw, ch, radius);
        const blend = (smooth / 100) * 0.85;
        for (let i = 0; i < data.length; i += 4) {
          /* Only blend where edge is low (skin areas) - approximate */
          const orig = data[i] + data[i + 1] + data[i + 2];
          const blur = blurred[i] + blurred[i + 1] + blurred[i + 2];
          const diff = Math.abs(orig - blur) / 3;
          /* If diff is small (smooth area = skin), blend more */
          const skinMask = Math.max(0, 1 - diff / 30);
          const k = blend * skinMask;
          data[i] = data[i] * (1 - k) + blurred[i] * k;
          data[i + 1] = data[i + 1] * (1 - k) + blurred[i + 1] * k;
          data[i + 2] = data[i + 2] * (1 - k) + blurred[i + 2] * k;
        }
      }

      /* 2. Whiten: brightness + gamma */
      if (whiten > 0) {
        const factor = 1 + whiten / 60;
        const gamma = 0.8 + (1 - whiten / 100) * 0.2;
        for (let i = 0; i < data.length; i += 4) {
          for (let c = 0; c < 3; c++) {
            let v = data[i + c] / 255;
            v = Math.pow(v, gamma);
            v = v * factor;
            data[i + c] = Math.min(255, Math.max(0, v * 255));
          }
        }
      }

      /* 3. Rosy: increase red, decrease blue slightly */
      if (rosy > 0) {
        const addR = rosy * 1.2;
        const subB = rosy * 0.4;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] + addR);
          data[i + 2] = Math.max(0, data[i + 2] - subB);
        }
      }

      /* 4. Sharpen: unsharp mask */
      if (sharp > 0) {
        const blurred = boxBlur(data, cw, ch, 1);
        const amount = sharp / 100;
        for (let i = 0; i < data.length; i += 4) {
          for (let c = 0; c < 3; c++) {
            const orig = data[i + c];
            const blur = blurred[i + c];
            data[i + c] = Math.min(255, Math.max(0, orig + (orig - blur) * amount));
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          if (resultUrl) URL.revokeObjectURL(resultUrl);
          const url = URL.createObjectURL(blob);
          setResultUrl(url);
          setStep("done");
        }
        setProcessing(false);
      }, originalFile.type || "image/jpeg");
    };
    img.onerror = () => { setError(t("common.error_file_read")); setProcessing(false); };
    img.src = previewUrl;
  }, [originalFile, smooth, whiten, rosy, sharp, previewUrl, resultUrl]);

  const download = () => {
    if (!resultUrl || !originalFile) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `${originalFile.name.replace(/\.[^.]+$/, "")}_beautified.${originalFile.name.split(".").pop()}`;
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

  const continueEdit = () => {
    if (resultUrl) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(resultUrl);
      setResultUrl("");
      setStep("edit");
    }
  };

  const tool = getToolById("image-beautify")!;

  const presets = [
    { label: t("img_beautify.preset_natural"), vals: { s: 30, w: 20, r: 15, sh: 10 } },
    { label: t("img_beautify.preset_whiten"), vals: { s: 35, w: 50, r: 20, sh: 15 } },
    { label: t("img_beautify.preset_pink"), vals: { s: 40, w: 25, r: 45, sh: 10 } },
    { label: t("img_beautify.preset_refine"), vals: { s: 50, w: 35, r: 30, sh: 25 } },
  ];

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
          <div className="mb-4 text-5xl">&#10024;</div>
          <p className="mb-2 text-sm font-medium text-zinc-700">{t("img_beautify.drag_hint")}</p>
          <p className="mb-6 text-xs text-zinc-400">{t("img_beautify.drag_hint2")}</p>
          <button onClick={() => inputRef.current?.click()} className="btn-primary">{t("img_beautify.select_image")}</button>
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-700">{t("img_beautify.preset_label")}</h3>
              <div className="flex gap-2">
                {presets.map((p) => (
                  <button key={p.label} onClick={() => {
                    setSmooth(p.vals.s); setWhiten(p.vals.w);
                    setRosy(p.vals.r); setSharp(p.vals.sh);
                  }} className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-zinc-600 hover:bg-brand-50 hover:text-brand-700 transition-colors">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("img_beautify.smooth_label")}: {smooth}%</label>
                <input type="range" min="0" max="100" value={smooth}
                  onChange={(e) => setSmooth(parseInt(e.target.value))} className="w-full accent-brand-600" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("img_beautify.whiten_label")}: {whiten}%</label>
                <input type="range" min="0" max="100" value={whiten}
                  onChange={(e) => setWhiten(parseInt(e.target.value))} className="w-full accent-brand-600" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("img_beautify.rosy_label")}: {rosy}%</label>
                <input type="range" min="0" max="100" value={rosy}
                  onChange={(e) => setRosy(parseInt(e.target.value))} className="w-full accent-brand-600" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("img_beautify.sharp_label")}: {sharp}%</label>
                <input type="range" min="0" max="100" value={sharp}
                  onChange={(e) => setSharp(parseInt(e.target.value))} className="w-full accent-brand-600" />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={applyBeautify} className="btn-primary" disabled={processing}>
                {processing ? t("img_beautify.processing") : t("img_beautify.btn_apply")}
              </button>
              <button onClick={reset} className="btn-secondary">{t("common.reupload")}</button>
            </div>
          </div>

          {/* 编辑阶段显示原图预览 */}
          {step === "edit" && previewUrl && (
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("img_beautify.original_preview_title")}</h3>
              <img src={previewUrl} alt="original" className="max-h-80 w-auto rounded-lg mx-auto" />
              <p className="mt-2 text-center text-xs text-zinc-400">{t("img_beautify.params_hint")}{t("img_beautify.btn_apply")}</p>
            </div>
          )}

          {step === "done" && resultUrl && (
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("img_beautify.result_title")}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-400 mb-2">{t("img_beautify.original_preview_title")}</p>
                  <img src={previewUrl} alt="original" className="max-h-64 w-auto rounded-lg" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400 mb-2">{t("img_beautify.result_title")}</p>
                  <img src={resultUrl} alt="beautified" className="max-h-64 w-auto rounded-lg" />
                </div>
              </div>
              <div className="mt-4">
                <button onClick={download} className="btn-primary">{t("img_beautify.download")}</button>
                <button onClick={continueEdit} className="btn-secondary ml-3">{t("img_beautify.btn_continue")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
