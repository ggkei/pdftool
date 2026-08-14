export interface PdfXObjectInfo {
  kind: "image" | "form";
  ref: string;
  name: string;
  width: number;
  height: number;
  colorSpace: string;
  bitsPerComponent: number;
  hasAlpha: boolean;
  size: number;
  transform?: number[];
  subtype?: string;
}

export type PdfImageInfo = PdfXObjectInfo;

export interface WatermarkCandidate {
  image: PdfXObjectInfo;
  reason: string;
  score: number;
}

export interface PageAnalysis {
  pageIndex: number;
  pageRef: string;
  mediaBox: { x: number; y: number; width: number; height: number };
  images: PdfXObjectInfo[];
  watermarkCandidates: WatermarkCandidate[];
}

export interface RemoveOptions {
  minImageSize?: number;
  maxImageSize?: number;
  preferAlphaChannel?: boolean;
  autoSelect?: boolean;
  selectedImageRefs?: string[];
}

export interface RemoveResult {
  pageCount: number;
  removedCount: number;
  outputBytes: Uint8Array;
}
