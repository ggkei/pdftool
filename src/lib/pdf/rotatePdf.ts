import { PDFDocument, degrees } from "pdf-lib";

export interface PageTransform {
  originalIndex: number;
  rotation: number; // 0, 90, 180, 270
}

export interface RotateResult {
  originalPages: number;
  outputPages: number;
  outputBytes: Uint8Array;
}

export async function rotateAndReorderPdf(
  bytes: Uint8Array,
  transforms: PageTransform[]
): Promise<RotateResult> {
  const src = await PDFDocument.load(bytes);
  const totalPages = src.getPageCount();

  if (totalPages === 0) throw new Error("PDF 没有页面");

  // Validate transforms
  if (transforms.length !== totalPages) {
    throw new Error(`期望 ${totalPages} 个页面变换，收到 ${transforms.length} 个`);
  }

  // Build reordered list
  const indices = new Set<number>();
  for (const t of transforms) {
    if (t.originalIndex < 0 || t.originalIndex >= totalPages) {
      throw new Error(`无效的页面索引: ${t.originalIndex}`);
    }
    if (indices.has(t.originalIndex)) {
      throw new Error(`页面 ${t.originalIndex + 1} 被重复引用`);
    }
    indices.add(t.originalIndex);
  }
  if (indices.size !== totalPages) {
    throw new Error("页面列表不完整");
  }

  const dst = await PDFDocument.create();
  const ordered = transforms.map((t) => t.originalIndex);
  const copied = await dst.copyPages(src, ordered);

  for (let i = 0; i < copied.length; i++) {
    const page = copied[i];
    const rot = ((transforms[i].rotation % 360) + 360) % 360;
    page.setRotation(degrees(rot));
    dst.addPage(page);
  }

  const outputBytes = await dst.save({ useObjectStreams: false });

  return {
    originalPages: totalPages,
    outputPages: totalPages,
    outputBytes,
  };
}
