"use client";

import { useState, useRef, useCallback } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

type Step = "upload" | "edit" | "done";
type FilterType = "grayscale" | "sepia" | "invert" | "blur" | "brightness" | "contrast" | "saturate" | "hue";

export default function ImageFilterPage() {
  const [step, setStep] = useState<Step>("upload");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState<FilterType>("grayscale");
  const [intensity, setIntensity] = useState(100);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError(t("img_filter.error_format"));
      return;
    }
    setError("");
    setOriginalFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStep("edit");
    setResultUrl("");
  }, []);

  const getFilterString = (f: FilterType, val: number) => {
    switch (f) {
      case "grayscale": return `grayscale(${val}%)`;
      case "sepia": return `sepia(${val}%)`;
      case "invert": return `invert(${val}%)`;
      case "blur": return `blur(${val / 10}px)`;
      case "brightness": return `brightness(${val}%)`;
      case "contrast": return `contrast(${val}%)`;
      case "saturate": return `saturate(${val}%)`;
      case "hue": return `hue-rotate(${val * 3.6}deg)`;
    }
  };

  const applyFilter = useCallback(() => {
    if (!originalFile || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.filter = getFilterString(filter, intensity);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setResultUrl(url);
          setStep("done");
        }
      }, originalFile.type || "image/jpeg");
    };
    img.src = previewUrl;
  }, [originalFile, filter, intensity, previewUrl]);

  const download = () => {
    if (!resultUrl || !originalFile) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `${originalFile.name.replace(/\.[^.]+$/, "")}_filter.${originalFile.name.split(".").pop()}`;
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

  const filters: { id: FilterType; label: string; icon: string }[] = [
    { id: "grayscale", label: t("img_filter.filter_grayscale"), icon: "&#9681;" },
    { id: "sepia", label: t("img_filter.filter_sepia"), icon: "&#128247;" },
    { id: "invert", label: t("img_filter.filter_invert"), icon: "&#9682;" },
    { id: "blur", label: t("img_filter.filter_blur"), icon: "&#128173;" },
    { id: "brightness", label: t("img_filter.brightness"), icon: "&#9728;" },
    { id: "contrast", label: t("img_filter.contrast"), icon: "&#9851;" },
    { id: "saturate", label: t("img_filter.saturation"), icon: "&#127752;" },
    { id: "hue", label: t("img_filter.filter_hue"), icon: "&#127749;" },
  ];

  const tool = getToolById("image-filter")!;

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
          <div className="mb-4 text-5xl">&#127748;</div>
          <p className="mb-2 text-sm font-medium text-zinc-700">{t("img_filter.drag_hint")}</p>
          <p className="mb-6 text-xs text-zinc-400">{t("img_filter.drag_hint2")}</p>
          <button onClick={() => inputRef.current?.click()} className="btn-primary">{t("img_filter.select_image")}</button>
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
            <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("img_filter.select_filter")}</h3>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {filters.map((f) => (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  className={`rounded-xl border-2 py-4 text-center transition-all ${
                    filter === f.id
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 bg-white text-zinc-600 hover:border-slate-300"
                  }`}>
                  <span className="block text-xl mb-1" dangerouslySetInnerHTML={{ __html: f.icon }} />
                  <span className="text-xs font-medium">{f.label}</span>
                </button>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                {t("img_filter.intensity_value")}: {intensity}%
              </label>
              <input type="range" min="0" max="100" value={intensity}
                onChange={(e) => setIntensity(parseInt(e.target.value))}
                className="w-full" />
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={applyFilter} className="btn-primary">{t("img_filter.btn_apply")}</button>
              <button onClick={reset} className="btn-secondary">{t("common.reupload")}</button>
            </div>
          </div>

          {step === "edit" && previewUrl && (
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
              <p className="text-xs text-zinc-500 mb-2">{t("img_filter.preview")}</p>
              <img src={previewUrl} alt="preview"
                style={{ filter: getFilterString(filter, intensity) }}
                className="max-h-64 w-auto rounded-lg" />
            </div>
          )}

          {step === "done" && resultUrl && (
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("img_filter.result_title")}</h3>
              <img src={resultUrl} alt="filtered" className="max-h-64 w-auto rounded-lg mb-4" />
              <button onClick={download} className="btn-primary">{t("img_filter.download")}</button>
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
