import { PDFDocument } from "pdf-lib";

// NOTE: pdfjs-dist and other browser-only deps are imported lazily inside functions
// to avoid SSR crashes in Node (no DOMMatrix, no window, etc.)

export interface CompressOptions {
  quality?: number; // 0.1 - 1.0 (for JPEG output)
  maxWidth?: number; // optional max page width in px
  outputFormat?: "jpeg" | "png";
}

export interface CompressResult {
  originalSize: number;
  outputSize: number;
  savedBytes: number;
  pageCount: number;
  outputBytes: Uint8Array;
}

function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

export async function compressPdfClientSide(
  bytes: Uint8Array,
  opts: CompressOptions = {}
): Promise<CompressResult> {
  if (typeof window === "undefined") {
    throw new Error("compressPdfClientSide 仅能在浏览器中运行");
  }

  await import("./polyfill");
  const pdfjsMod = await import("pdfjs-dist");
  const pdfjsLib = (pdfjsMod as any).default ?? pdfjsMod;
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const { quality = 0.7, maxWidth, outputFormat = "jpeg" } = opts;

  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const pdf = await loadingTask.promise;

  const outDoc = await PDFDocument.create();

  for (let pi = 1; pi <= pdf.numPages; pi++) {
    const page = await pdf.getPage(pi);
    const viewport = page.getViewport({ scale: 1.0 });

    let scale = 2.0;
    if (maxWidth && viewport.width * scale > maxWidth) {
      scale = maxWidth / viewport.width;
    }

    const scaledViewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(scaledViewport.width);
    canvas.height = Math.ceil(scaledViewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: ctx, viewport: scaledViewport }).promise;

    const blob: Blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b!), outputFormat === "jpeg" ? "image/jpeg" : "image/png", quality);
    });
    const imgBytes = await blobToUint8Array(blob);

    let embedded;
    if (outputFormat === "jpeg") embedded = await outDoc.embedJpg(imgBytes);
    else embedded = await outDoc.embedPng(imgBytes);

    const outPage = outDoc.addPage([scaledViewport.width, scaledViewport.height]);
    outPage.drawImage(embedded, { x: 0, y: 0, width: scaledViewport.width, height: scaledViewport.height });
  }

  const outputBytes = await outDoc.save({ useObjectStreams: false });
  return {
    originalSize: bytes.length,
    outputSize: outputBytes.length,
    savedBytes: bytes.length - outputBytes.length,
    pageCount: pdf.numPages,
    outputBytes,
  };
}


