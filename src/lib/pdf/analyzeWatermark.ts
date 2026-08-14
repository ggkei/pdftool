import type { PdfXObjectInfo, PageAnalysis, WatermarkCandidate, RemoveOptions } from "./types";

export function analyzeWatermarks(
  pages: PageAnalysis[],
  options: RemoveOptions = {}
): PageAnalysis[] {
  const allImages = pages.flatMap((p) => p.images);
  const imageRefCount = new Map<string, number>();
  for (const img of allImages) {
    imageRefCount.set(img.ref, (imageRefCount.get(img.ref) || 0) + 1);
  }

  const minSize = options.minImageSize ?? 50;
  const maxSize = options.maxImageSize ?? 800;
  const preferAlpha = options.preferAlphaChannel ?? true;

  return pages.map((page) => {
    const pageRatio = Math.min(
      page.mediaBox.width || 612,
      page.mediaBox.height || 792
    );

    const candidates: WatermarkCandidate[] = [];

    for (const img of page.images) {
      const score = computeWatermarkScore(img, pageRatio, imageRefCount, pages.length, {
        minSize,
        maxSize,
        preferAlpha,
      });

      if (score > 0.3) {
        const reasons: string[] = [];
        if (img.hasAlpha) reasons.push("有 Alpha 通道");

        const smallerDim = Math.min(img.width, img.height);
        const largerDim = Math.max(img.width, img.height);
        if (img.kind === "image" && smallerDim > 0 && smallerDim < pageRatio * 0.15 && largerDim < pageRatio * 0.4) {
          reasons.push("尺寸较小");
        }
        if (img.kind === "form" && img.transform && isShearedTransform(img.transform)) {
          reasons.push("变换含倾斜");
        }
        if (img.kind === "form" && img.transform && isScaledTransform(img.transform)) {
          reasons.push("变换含拉伸");
        }

        const refCount = imageRefCount.get(img.ref) || 0;
        if (refCount >= Math.max(2, pages.length * 0.5)) {
          reasons.push("多页重复出现");
        }
        if (img.size > 0 && img.size < 50000) reasons.push("文件体积小");
        if (img.kind === "form") reasons.push("Form 类型");

        candidates.push({
          image: img,
          reason: reasons.join("、") || "疑似水印",
          score,
        });
      }
    }

    // De-duplicate: if Form and its nested Image are both candidates, prefer the Form
    // (removing Form Do removes everything inside it)
    candidates.sort((a, b) => {
      // Form first, then by score
      if (a.image.kind !== b.image.kind) return a.image.kind === "form" ? -1 : 1;
      return b.score - a.score;
    });

    // Keep only top N or let user select all reasonable candidates
    const filtered = candidates.filter((c) => c.score >= 0.5);

    return {
      ...page,
      watermarkCandidates: filtered,
    };
  });
}

function isShearedTransform(t: number[]): boolean {
  // [a b c d e f] - if b or c is non-trivial (not 0 and not close to 0)
  const b = Math.abs(t[1]);
  const c = Math.abs(t[2]);
  return (b > 0.01 && b < 1000) || (c > 0.01 && c < 1000);
}

function isScaledTransform(t: number[]): boolean {
  // a and d are the scale factors; if they differ significantly, it's stretched
  const a = Math.abs(t[0]);
  const d = Math.abs(t[3]);
  if (a === 0 || d === 0) return false;
  const ratio = Math.max(a, d) / Math.min(a, d);
  return ratio > 1.5;
}

function computeWatermarkScore(
  img: PdfXObjectInfo,
  pageRatio: number,
  refCount: Map<string, number>,
  totalPages: number,
  options: { minSize: number; maxSize: number; preferAlpha: boolean }
): number {
  let score = 0;

  if (img.kind === "form") {
    // Form XObject scoring
    score += 0.3; // Forms are more likely watermarks than content images

    if (img.transform) {
      if (isShearedTransform(img.transform)) {
        score += 0.35; // Shear = classic watermark pattern
      }
      if (isScaledTransform(img.transform)) {
        score += 0.15;
      }

      // Check if transform values are unusual for regular content
      const [a, b, c, d] = img.transform;
      if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01) {
        score += 0.1;
      }
    }

    if (img.size > 0 && img.size < 50000) {
      score += 0.15;
    } else if (img.size > 0 && img.size < 200000) {
      score += 0.08;
    }

    const count = refCount.get(img.ref) || 0;
    if (count >= Math.max(2, totalPages * 0.5)) {
      score += 0.15;
    }
    if (count >= 3) score += 0.05;

    return Math.max(0, Math.min(1, score));
  }

  // Image XObject scoring
  if (img.hasAlpha && options.preferAlpha) {
    score += 0.4;
  }

  const smallerDim = Math.min(img.width, img.height);
  const largerDim = Math.max(img.width, img.height);

  if (smallerDim > 0 && smallerDim < pageRatio * 0.15 && largerDim > 0 && largerDim < pageRatio * 0.4) {
    score += 0.3;
  } else if (smallerDim > 0 && smallerDim < pageRatio * 0.3 && largerDim > 0 && largerDim < pageRatio * 0.6) {
    score += 0.15;
  }

  if (img.size > 0 && img.size < 100000) {
    score += 0.15;
  } else if (img.size > 0 && img.size < 300000) {
    score += 0.08;
  }

  const count = refCount.get(img.ref) || 0;
  if (count >= 3) {
    score += 0.15;
  }

  if (
    img.colorSpace === "DeviceGray" ||
    img.colorSpace === "CalGray" ||
    img.colorSpace === "DeviceCMYK"
  ) {
    score += 0.05;
  }

  if (img.width > 0 && (img.width < options.minSize || img.width > options.maxSize)) {
    score -= 0.5;
  }

  if (largerDim > 0 && largerDim > pageRatio * 0.8) {
    score -= 0.6;
  }

  return Math.max(0, Math.min(1, score));
}
