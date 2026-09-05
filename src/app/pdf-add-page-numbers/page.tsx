"use client";

import { useState, useRef, useCallback } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { t } from "@/i18n/dictionary";

type Step = "upload" | "config" | "done";

type Position = "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

export default function PdfAddPageNumbersPage() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [position, setPosition] = useState<Position>("bottom-center");
  const [fontSize, setFontSize] = useState(12);
  const [startNum, setStartNum] = useState(1);
  const [format, setFormat] = useState("page");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setError(t("common.upload_pdf"));
      return;
    }
    setError("");
    setFileName(file.name);
    setFileSize(file.size);
    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      setPdfBytes(new Uint8Array(bytes));
      setPageCount(pdfDoc.getPageCount());
      setStep("config");
    } catch {
      setError(t("pdf_addnum.error_read"));
    }
  }, []);

  const addPageNumbers = async () => {
    if (!pdfBytes) return;
    setProcessing(true);
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();

      pages.forEach((page, index) => {
        const pageNum = startNum + index;
        let text: string;
        switch (format) {
          case "page": text = String(pageNum); break;
          case "page-of": text = `${pageNum} / ${pages.length}`; break;
          case "page-n": text = `- ${pageNum} -`; break;
          default: text = String(pageNum);
        }

        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const { width, height } = page.getSize();
        const margin = 20;

        let x: number, y: number;
        const isBottom = position.startsWith("bottom");
        y = isBottom ? margin : height - margin - fontSize;

        if (position.endsWith("center")) x = (width - textWidth) / 2;
        else if (position.endsWith("right")) x = width - textWidth - margin;
        else x = margin;

        page.drawText(text, {
          x, y, size: fontSize, font,
          color: rgb(0.2, 0.2, 0.2),
        });
      });

      const newBytes = await pdfDoc.save();
      const blob = new Blob([newBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setStep("done");
    } catch {
      setError(t("pdf_addnum.add_failed"));
    } finally {
      setProcessing(false);
    }
  };

  const download = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `${fileName.replace(/\.pdf$/i, "")}_numbered.pdf`;
    a.click();
  };

  const reset = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setStep("upload");
    setPdfBytes(null);
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

  const tool = getToolById("add-page-numbers")!;

  const positions: { id: Position; label: string }[] = [
    { id: "bottom-center", label: t("pdf_addnum.pos_bottom_center") },
    { id: "bottom-right", label: t("pdf_addnum.pos_bottom_right") },
    { id: "bottom-left", label: t("pdf_addnum.pos_bottom_left") },
    { id: "top-center", label: t("pdf_addnum.pos_top_center") },
    { id: "top-right", label: t("pdf_addnum.pos_top_right") },
    { id: "top-left", label: t("pdf_addnum.pos_top_left") },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
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
          <p className="mb-2 text-sm font-medium text-zinc-700">{t("pdf_addnum.drag_hint")}</p>
          <p className="mb-6 text-xs text-zinc-400">{t("pdf_addnum.upload_subhint")}</p>
          <button onClick={() => inputRef.current?.click()} className="btn-primary">{t("pdf_addnum.select_pdf")}</button>
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </div>
      )}

      {step === "config" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
            <p className="text-sm text-zinc-500 mb-4">{fileName} | {formatSize(fileSize)} | {pageCount} {t("pdf_addnum.pages_unit")}</p>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500">{t("pdf_addnum.position_label")}</label>
                <div className="grid grid-cols-3 gap-2">
                  {positions.map((p) => (
                    <button key={p.id} onClick={() => setPosition(p.id)}
                      className={`rounded-lg border-2 py-2 text-xs font-medium transition-all ${
                        position === p.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-zinc-600"
                      }`}>{p.label}</button>
                  ))}
                </div>
                {/* 位置预览示意图 */}
                <div className="mt-3 flex justify-center">
                  <div className="relative w-28 h-40 border-2 border-slate-300 rounded bg-slate-50">
                    <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] text-zinc-300">Aa</span>
                    <div className={`absolute text-xs font-bold text-brand-600 ${
                      position === "bottom-center" ? "bottom-1 left-1/2 -translate-x-1/2" :
                      position === "bottom-right" ? "bottom-1 right-1.5" :
                      position === "bottom-left" ? "bottom-1 left-1.5" :
                      position === "top-center" ? "top-1 left-1/2 -translate-x-1/2" :
                      position === "top-right" ? "top-1 right-1.5" :
                      "top-1 left-1.5"
                    }`}>{startNum}</div>
                    {/* 高亮当前选中的边 */}
                    <div className={`absolute ${position.includes("bottom") ? "bottom-0" : "top-0"} left-0 right-0 h-0.5 bg-brand-400`} />
                  </div>
                </div>
                <p className="text-center text-xs text-zinc-400 mt-1">{t("pdf_addnum.position_preview")}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">{t("pdf_addnum.start_number")}</label>
                  <input type="number" min="0" value={startNum}
                    onChange={(e) => setStartNum(parseInt(e.target.value) || 1)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">{t("pdf_addnum.font_size")}: {fontSize}pt</label>
                  <input type="range" min="8" max="24" value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-full mt-3" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("pdf_addnum.format_label")}</label>
                <select value={format} onChange={(e) => setFormat(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="page">1, 2, 3...</option>
                  <option value="page-of">1 / 10, 2 / 10...</option>
                  <option value="page-n">- 1 -, - 2 -...</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={addPageNumbers} className="btn-primary" disabled={processing}>
                {processing ? t("pdf_addnum.adding") : t("pdf_addnum.add_page_numbers")}
              </button>
              <button onClick={reset} className="btn-secondary">{t("pdf_addnum.re_upload")}</button>
            </div>
          </div>
        </div>
      )}

      {step === "done" && resultUrl && (
        <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
          <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("pdf_addnum.done_title")}</h3>
          <div className="mb-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-50" style={{ height: 560 }}>
            <iframe src={resultUrl} className="w-full h-full" title={t("pdf_addnum.preview_iframe")} />
          </div>
          <p className="text-xs text-zinc-400 mb-4">{t("pdf_addnum.done_hint")}</p>
          <div className="flex gap-3">
            <button onClick={download} className="btn-primary">{t("pdf_addnum.download_pdf")}</button>
            <button onClick={reset} className="btn-secondary">{t("pdf_addnum.re_upload")}</button>
          </div>
        </div>
      )}
    </main>
  );
}
