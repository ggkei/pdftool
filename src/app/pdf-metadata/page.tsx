"use client";

import { useState, useRef, useCallback } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { PDFDocument } from "pdf-lib";
import { t, getDateTimeLocale } from "@/i18n/dictionary";

interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate: string;
  modificationDate: string;
  pageCount: number;
  fileSize: string;
  fileName: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function formatDate(date: Date | undefined): string {
  if (!date) return t("pdf_metadata.unknown");
  return date.toLocaleString(getDateTimeLocale());
}

export default function PdfMetadataPage() {
  const [meta, setMeta] = useState<PdfMetadata | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setError(t("common.upload_pdf"));
      return;
    }
    setError("");
    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);

      setMeta({
        title: pdfDoc.getTitle() || t("pdf_metadata.not_set"),
        author: pdfDoc.getAuthor() || t("pdf_metadata.not_set"),
        subject: pdfDoc.getSubject() || t("pdf_metadata.not_set"),
        keywords: pdfDoc.getKeywords() || t("pdf_metadata.not_set"),
        creator: pdfDoc.getCreator() || t("pdf_metadata.not_set"),
        producer: pdfDoc.getProducer() || t("pdf_metadata.not_set"),
        creationDate: formatDate(pdfDoc.getCreationDate()),
        modificationDate: formatDate(pdfDoc.getModificationDate()),
        pageCount: pdfDoc.getPageCount(),
        fileSize: formatSize(file.size),
        fileName: file.name,
      });
    } catch {
      setError(t("pdf_metadata.error_read"));
    }
  }, []);

  const reset = () => {
    setMeta(null);
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

  const tool = getToolById("metadata")!;

  const rows = meta ? [
    { label: t("pdf_metadata.file_name"), value: meta.fileName },
    { label: t("pdf_metadata.file_size"), value: meta.fileSize },
    { label: t("pdf_metadata.page_count"), value: `${meta.pageCount} ${t("pdf_metadata.pages_unit_short")}` },
    { label: t("pdf_metadata.title"), value: meta.title },
    { label: t("pdf_metadata.author"), value: meta.author },
    { label: t("pdf_metadata.subject"), value: meta.subject },
    { label: t("pdf_metadata.keywords"), value: meta.keywords },
    { label: t("pdf_metadata.creator_tool"), value: meta.creator },
    { label: t("pdf_metadata.producer"), value: meta.producer },
    { label: t("pdf_metadata.creation_date"), value: meta.creationDate },
    { label: t("pdf_metadata.modification_date"), value: meta.modificationDate },
  ] : [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      <div className="mt-8 space-y-4">
        {!meta && (
          <div className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
            dragOver ? "border-brand-400 bg-brand-50" : "border-slate-300 bg-white/60"
          }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}>
            <div className="mb-4 text-5xl">&#128269;</div>
            <p className="mb-2 text-sm font-medium text-zinc-700">{t("pdf_metadata.drag_hint")}</p>
            <p className="mb-6 text-xs text-zinc-400">{t("pdf_metadata.upload_subhint")}</p>
            <button onClick={() => inputRef.current?.click()} className="btn-primary">{t("pdf_metadata.select_pdf")}</button>
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          </div>
        )}

        {meta && (
          <>
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("pdf_metadata.info_title")}</h3>
              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.label} className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-sm text-zinc-500">{row.label}</span>
                    <span className="text-sm font-medium text-zinc-800 max-w-[60%] text-right break-all">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={reset} className="btn-secondary">{t("pdf_metadata.re_upload")}</button>
          </>
        )}
      </div>
    </main>
  );
}
