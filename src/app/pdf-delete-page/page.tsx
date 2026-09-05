"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { PDFDocument } from "pdf-lib";
import { t } from "@/i18n/dictionary";

type Step = "upload" | "preview" | "done";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

interface PageThumb {
  pageNum: number;
  dataUrl: string;
  width: number;
  height: number;
}

async function renderPdfThumbs(bytes: Uint8Array): Promise<PageThumb[]> {
  const pdfjsMod = await import("pdfjs-dist");
  const pdfjs = (pdfjsMod as any).default ?? pdfjsMod;
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const loadingTask = pdfjs.getDocument({ data: bytes.slice() });
  const pdf = await loadingTask.promise;
  const thumbs: PageThumb[] = [];
  const scale = 0.3;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    thumbs.push({
      pageNum: i,
      dataUrl: canvas.toDataURL("image/png"),
      width: viewport.width,
      height: viewport.height,
    });
  }
  return thumbs;
}

export default function PdfDeletePagePage() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [zoomPage, setZoomPage] = useState<PageThumb | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError(t("pdf_delete.error_upload"));
      return;
    }
    setError("");
    setFileName(file.name);
    setFileSize(file.size);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdfDoc = await PDFDocument.load(bytes);
      setPdfBytes(bytes);
      setPageCount(pdfDoc.getPageCount());
      setSelectedPages(new Set());
      setThumbs([]);
      setStep("preview");
      setRendering(true);
      const thumbsData = await renderPdfThumbs(bytes);
      setThumbs(thumbsData);
    } catch {
      setError(t("pdf_delete.error_read"));
    } finally {
      setRendering(false);
    }
  }, []);

  const togglePage = (pageNum: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
      return next;
    });
  };

  const deletePages = async () => {
    if (!pdfBytes || selectedPages.size === 0) return;
    setProcessing(true);
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pagesToDelete = Array.from(selectedPages).sort((a, b) => b - a);
      for (const pageNum of pagesToDelete) {
        pdfDoc.removePage(pageNum - 1);
      }
      const newBytes = await pdfDoc.save();
      const blob = new Blob([newBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setStep("done");
    } catch {
      setError("Delete failed");
    } finally {
      setProcessing(false);
    }
  };

  const download = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `${fileName.replace(/\.pdf$/i, "")}_deleted.pdf`;
    a.click();
  };

  const reset = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setStep("upload");
    setPdfBytes(null);
    setResultUrl("");
    setError("");
    setSelectedPages(new Set());
    setThumbs([]);
    setPageCount(0);
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

  const tool = getToolById("delete-page")!;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      <div className="mt-8 space-y-4">
        {step === "upload" && (
          <div className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
            dragOver ? "border-brand-400 bg-brand-50" : "border-slate-300 bg-white/60"
          }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}>
            <div className="mb-4 text-5xl">&#128196;</div>
            <p className="mb-2 text-sm font-medium text-zinc-700">{t("pdf_delete.upload_hint")}</p>
            <p className="mb-6 text-xs text-zinc-400">{t("pdf_delete.upload_subhint")}</p>
            <button onClick={() => inputRef.current?.click()} className="btn-primary">{t("pdf_delete.select_pdf")}</button>
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            {dragOver && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-50/80 border-4 border-dashed border-brand-400 rounded-2xl pointer-events-none">
                <p className="text-lg font-medium text-brand-700">{t("pdf_delete.drag_replace")}</p>
              </div>
            )}
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                <div>
                  <p className="text-sm font-medium text-zinc-700">{fileName}</p>
                  <p className="text-xs text-zinc-400">{formatSize(fileSize)} | {pageCount} {t("pdf_delete.pages_word")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-red-500 font-medium">{selectedPages.size} {t("pdf_delete.selected_count")}</p>
                  {rendering && (
                    <span className="text-xs text-zinc-400 animate-pulse">{t("pdf_delete.rendering_previews")}</span>
                  )}
                </div>
              </div>

              {thumbs.length === 0 && rendering && (
                <div className="py-20 text-center">
                  <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
                  <p className="text-sm text-zinc-500">{t("pdf_delete.generating_previews")}</p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {thumbs.map((thumb) => {
                  const selected = selectedPages.has(thumb.pageNum);
                  return (
                    <div key={thumb.pageNum} className={`relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
                      selected ? "border-red-500 ring-2 ring-red-200" : "border-slate-200 hover:border-slate-300"
                    }`}>
                      <div onClick={() => togglePage(thumb.pageNum)} className="relative">
                        <img
                          src={thumb.dataUrl}
                          alt={`Page ${thumb.pageNum}`}
                          className={`w-full h-auto ${selected ? "opacity-50" : "opacity-100"}`}
                          loading="lazy"
                        />
                        <div className={`absolute inset-0 flex items-center justify-center ${selected ? "block" : "hidden"}`}>
                          <span className="bg-red-500 text-white rounded-full h-10 w-10 flex items-center justify-center font-bold text-lg shadow-lg">&#10007;</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1.5 bg-white border-t border-slate-100">
                        <span className="text-xs font-medium text-zinc-500">P{thumb.pageNum}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setZoomPage(thumb); }}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                        >
                          &#128269; {t("pdf_delete.view")}
                        </button>
                      </div>
                      <button
                        onClick={() => togglePage(thumb.pageNum)}
                        className={`absolute top-2 right-2 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          selected
                            ? "bg-red-500 border-red-500 text-white"
                            : "bg-white/80 border-slate-300 text-slate-400 hover:border-slate-400"
                        }`}
                      >
                        {selected && <span>&#10003;</span>}
                      </button>
                    </div>
                  );
                })}
              </div>

              {thumbs.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={deletePages}
                    className="btn-primary"
                    disabled={processing || selectedPages.size === 0 || selectedPages.size === pageCount}
                  >
                    {processing ? t("pdf_delete.processing") : t("pdf_delete.delete_selected").replace("{n}", String(selectedPages.size))}
                  </button>
                  <button onClick={() => setSelectedPages(new Set())} className="btn-secondary">
                    {t("pdf_delete.clear_selection")}
                  </button>
                  <button onClick={reset} className="btn-secondary">{t("pdf_delete.re_upload")}</button>
                </div>
              )}

              {selectedPages.size === pageCount && (
                <p className="mt-3 text-sm text-red-500">{t("pdf_delete.keep_at_least_one")}</p>
              )}
            </div>
          </div>
        )}

        {step === "done" && resultUrl && (
          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
            <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("pdf_delete.delete_done")}</h3>
            <p className="text-sm text-zinc-500 mb-4">{t("pdf_delete.deleted_result").replace("{deleted}", String(selectedPages.size)).replace("{remaining}", String(pageCount - selectedPages.size))}</p>
            <div className="flex gap-3">
              <button onClick={download} className="btn-primary">{t("pdf_delete.download_pdf")}</button>
              <button onClick={reset} className="btn-secondary">{t("pdf_delete.re_upload")}</button>
            </div>
          </div>
        )}
      </div>

      {/* Zoom modal */}
      {zoomPage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setZoomPage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
            <button
              onClick={() => setZoomPage(null)}
              className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300"
            >
              &#10005;
            </button>
            <p className="text-white text-sm mb-2">Page {zoomPage.pageNum}</p>
            <img
              src={zoomPage.dataUrl}
              alt={`Page ${zoomPage.pageNum}`}
              className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-gray-400 text-xs mt-2">{zoomPage.width}x{zoomPage.height}px</p>
          </div>
        </div>
      )}
    </main>
  );
}
