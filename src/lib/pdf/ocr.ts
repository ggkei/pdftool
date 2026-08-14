import type { PDFDocumentProxy } from "pdfjs-dist";

export interface OcrOptions {
  languages?: string;
  onProgress?: (page: number, total: number, stage?: string) => void;
}

export interface OcrPageResult {
  pageNumber: number;
  text: string;
  method: "text-extraction";
}

export interface OcrResult {
  totalPages: number;
  pages: OcrPageResult[];
  method: "text-extraction";
}

async function extractAllText(
  pdf: PDFDocumentProxy,
  onProgress?: (page: number, total: number) => void
): Promise<OcrPageResult[]> {
  const results: OcrPageResult[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(i, pdf.numPages);
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items: string[] = [];
    let lastY: number | null = null;

    for (const item of textContent.items) {
      const it = item as any;
      const str = it?.str ?? "";
      if (!str) continue;
      const y = it.transform?.[5];
      if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2) {
        items.push("\n");
      }
      lastY = y;
      items.push(str);
    }

    results.push({
      pageNumber: i,
      text: items.join("").trim(),
      method: "text-extraction",
    });
  }

  return results;
}

export async function ocrPdf(
  bytes: Uint8Array,
  options: OcrOptions = {}
): Promise<OcrResult> {
  await import("./polyfill");
  const pdfjsMod = await import("pdfjs-dist");
  const pdfjsLib = (pdfjsMod as any).default ?? pdfjsMod;
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const pdf = await loadingTask.promise;

  options.onProgress?.(0, pdf.numPages, "提取文本");
  const textResults = await extractAllText(pdf, (pg, total) =>
    options.onProgress?.(pg, total, "提取文本")
  );

  return {
    totalPages: pdf.numPages,
    pages: textResults,
    method: "text-extraction",
  };
}
