import JSZip from "jszip";

export interface PdfToImageOptions {
  scale?: number; // 1.0 = 72dpi, 2.0 = 144dpi, 3.0 = 216dpi
  format?: "png" | "jpeg";
  quality?: number; // 0.1 - 1.0 for JPEG
}

export interface RenderedPage {
  pageIndex: number;
  pageNumber: number;
  width: number;
  height: number;
  blob: Blob;
  bytes: Uint8Array;
  size: number;
}

function waitForFonts(pdf: any) {
  return new Promise<void>((resolve) => {
    if (pdf.fontsReady || pdf.numPages === 0) { resolve(); return; }
    const check = () => { if (pdf.fontsReady) resolve(); else setTimeout(check, 50); };
    check();
  });
}

function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

export async function renderPdfToImages(
  bytes: Uint8Array,
  opts: PdfToImageOptions = {}
): Promise<RenderedPage[]> {
  if (typeof window === "undefined") {
    throw new Error("renderPdfToImages 仅能在浏览器中运行");
  }

  await import("./polyfill");
  const pdfjsMod = await import("pdfjs-dist");
  const pdfjsLib = (pdfjsMod as any).default ?? pdfjsMod;
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const { scale = 2.0, format = "png", quality = 0.92 } = opts;

  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const pdf = await loadingTask.promise;
  await waitForFonts(pdf);

  const results: RenderedPage[] = [];

  for (let pi = 1; pi <= pdf.numPages; pi++) {
    const page = await pdf.getPage(pi);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
    const blob: Blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b!), mimeType, quality);
    });

    const imgBytes = await blobToUint8Array(blob);
    results.push({
      pageIndex: pi - 1,
      pageNumber: pi,
      width: canvas.width,
      height: canvas.height,
      blob,
      bytes: imgBytes,
      size: imgBytes.length,
    });
  }

  return results;
}

export async function packImagesAsZip(
  pages: RenderedPage[],
  prefix: string = "page",
  ext: string = "png"
): Promise<Uint8Array> {
  const zip = new JSZip();
  const pad = String(pages.length).length;
  for (const p of pages) {
    const name = `${prefix}_${String(p.pageNumber).padStart(pad, "0")}.${ext}`;
    zip.file(name, p.bytes);
  }
  return zip.generateAsync({ type: "uint8array" });
}
