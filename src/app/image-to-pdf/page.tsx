"use client";

import { useState, useRef, useCallback } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { PDFDocument } from "pdf-lib";
import { t } from "@/i18n/dictionary";

type Step = "upload" | "preview" | "done";

interface ImageItem {
  file: File;
  url: string;
}

export default function ImageToPdfPage() {
  const [step, setStep] = useState<Step>("upload");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [margin, setMargin] = useState(20);
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList) => {
    const validFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (validFiles.length === 0) {
      setError(t("img_to_pdf.error_format"));
      return;
    }
    setError("");
    const newImages = validFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...newImages]);
    setStep("preview");
  }, []);

  const removeImage = (index: number) => {
    setImages((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].url);
      updated.splice(index, 1);
      if (updated.length === 0) setStep("upload");
      return updated;
    });
  };

  const moveImage = (index: number, direction: "up" | "down") => {
    setImages((prev) => {
      const updated = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= updated.length) return prev;
      [updated[index], updated[target]] = [updated[target], updated[index]];
      return updated;
    });
  };

  const generatePdf = async () => {
    if (images.length === 0) return;
    setProcessing(true);
    try {
      const pdfDoc = await PDFDocument.create();

      for (const imgItem of images) {
        const imgBytes = await imgItem.file.arrayBuffer();
        let img;
        if (imgItem.file.type === "image/png") {
          img = await pdfDoc.embedPng(imgBytes);
        } else {
          img = await pdfDoc.embedJpg(imgBytes);
        }

        const isLandscape = orientation === "landscape";
        const pageW = isLandscape ? 842 : 595;
        const pageH = isLandscape ? 595 : 842;

        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;

        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawImage(img, { x, y, width: drawW, height: drawH });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setStep("done");
    } catch (e) {
      setError(t("img_to_pdf.error_failed").replace("{0}", e instanceof Error ? e.message : t("util_json_format.error_prefix")));
    } finally {
      setProcessing(false);
    }
  };

  const download = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `images-to-pdf-${Date.now()}.pdf`;
    a.click();
  };

  const reset = () => {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setImages([]);
    setResultUrl("");
    setError("");
    setStep("upload");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      if (images.length > 0) images.forEach(img => URL.revokeObjectURL(img.url));
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setImages([]);
      setResultUrl("");
      setError("");
      setStep("upload");
      setTimeout(() => handleFiles(e.dataTransfer.files), 0);
    }
  };

  const tool = getToolById("image-to-pdf")!;

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
          <div className="mb-4 text-5xl">&#128196;</div>
          <p className="mb-2 text-sm font-medium text-zinc-700">{t("img_to_pdf.drag_hint")}</p>
          <p className="mb-6 text-xs text-zinc-400">{t("common.privacy_badge")}</p>
          <button onClick={() => inputRef.current?.click()} className="btn-primary">{t("img_to_pdf.select_image")}</button>
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); }} />
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </div>
      )}

      {(step === "preview" || step === "done") && (
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
            <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("img_to_pdf.pdf_settings")}</h3>
            <div className="flex flex-wrap gap-4 mb-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("img_to_pdf.orientation")}</label>
                <select value={orientation} onChange={(e) => setOrientation(e.target.value as "portrait" | "landscape")}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="portrait">{t("img_to_pdf.portrait")}</option>
                  <option value="landscape">{t("img_to_pdf.landscape")}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("img_to_pdf.margin_label")}: {margin}px</label>
                <input type="range" min="0" max="80" value={margin}
                  onChange={(e) => setMargin(parseInt(e.target.value))} className="w-32" />
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-zinc-500">{t("img_to_pdf.image_list")} ({images.length} {t("img_to_pdf.images_count")})</p>
              {images.map((img, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 p-2">
                  <img src={img.url} alt="" className="h-12 w-12 rounded object-cover" />
                  <span className="flex-1 truncate text-sm text-zinc-600">{img.file.name}</span>
                  <button onClick={() => moveImage(i, "up")} disabled={i === 0}
                    className="text-xs text-zinc-400 hover:text-zinc-600 disabled:opacity-30">{t("img_to_pdf.move_up")}</button>
                  <button onClick={() => moveImage(i, "down")} disabled={i === images.length - 1}
                    className="text-xs text-zinc-400 hover:text-zinc-600 disabled:opacity-30">{t("img_to_pdf.move_down")}</button>
                  <button onClick={() => removeImage(i)}
                    className="text-xs text-red-400 hover:text-red-600">{t("util_text_diff.removed")}</button>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={generatePdf} className="btn-primary" disabled={processing || images.length === 0}>
                {processing ? t("img_to_pdf.generating") : t("img_to_pdf.btn_generate")}
              </button>
              <button onClick={() => inputRef.current?.click()} className="btn-secondary">{t("img_to_pdf.add_more")}</button>
              <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { if (e.target.files) handleFiles(e.target.files); }} />
              <button onClick={reset} className="btn-secondary">{t("util_common.clear")}</button>
            </div>
          </div>

          {step === "done" && resultUrl && (
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("img_to_pdf.done_title")}</h3>
              <button onClick={download} className="btn-primary">{t("pdf_unlock.download_btn")}</button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
