import pako from "pako";
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFStream,
  PDFNumber,
  PDFArray,
  PDFRef,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
import type { PdfXObjectInfo, PageAnalysis } from "./types";

function getName(name: PDFName): string {
  return name.asString().replace(/^\//, "");
}

export interface InternalImageRef {
  name: string;
  ref: PDFRef;
  stream: PDFStream;
  pageIndex: number;
  isFormImage: boolean;
  formRef?: PDFRef;
  kind: "image" | "form";
}

export function enumerateImages(
  pdfDoc: PDFDocument
): { images: InternalImageRef[]; pages: PageAnalysis[] } {
  const images: InternalImageRef[] = [];
  const pageAnalyses: PageAnalysis[] = [];
  const context = pdfDoc.context;

  const NAME_XOBJECT = PDFName.of("XObject");
  const NAME_RESOURCES = PDFName.of("Resources");
  const NAME_SUBTYPE = PDFName.of("Subtype");
  const NAME_IMAGE = PDFName.of("Image");
  const NAME_FORM = PDFName.of("Form");

  for (let pageIdx = 0; pageIdx < pdfDoc.getPageCount(); pageIdx++) {
    const page = pdfDoc.getPage(pageIdx);
    const node = page.node as any;

    const mediaBox = node.get(PDFName.of("MediaBox"));
    let pageWidth = 612;
    let pageHeight = 792;
    if (mediaBox instanceof PDFArray) {
      pageWidth = (mediaBox.get(2) as PDFNumber).asNumber();
      pageHeight = (mediaBox.get(3) as PDFNumber).asNumber();
    }

    const pageImages: PdfXObjectInfo[] = [];

    try {
      const resourcesRef = node.get(NAME_RESOURCES);
      if (!resourcesRef) {
        pageAnalyses.push(makeEmptyAnalysis(pageIdx, pageWidth, pageHeight));
        continue;
      }

      const resources = context.lookup(resourcesRef);
      if (!(resources instanceof PDFDict)) {
        pageAnalyses.push(makeEmptyAnalysis(pageIdx, pageWidth, pageHeight));
        continue;
      }

      const xObjectRef = resources.get(NAME_XOBJECT);
      if (!xObjectRef) {
        pageAnalyses.push(makeEmptyAnalysis(pageIdx, pageWidth, pageHeight));
        continue;
      }

      const xObject = context.lookup(xObjectRef);
      if (!(xObject instanceof PDFDict)) {
        pageAnalyses.push(makeEmptyAnalysis(pageIdx, pageWidth, pageHeight));
        continue;
      }

      // First pass: collect Do transform matrices from content stream
      const doTransforms = scanDoTransforms(context, node);

      // Track seen refs to avoid duplicates when same XObject appears in multiple Forms
      const seenRefs = new Set<string>();
      const refKey = (ref: PDFRef) => `ref:${ref.objectNumber}`;

      const keys = xObject.keys();
      for (const key of keys) {
        const name = getName(key);
        const value = xObject.get(key);
        const actualObj = context.lookup(value);

        if (actualObj instanceof PDFStream) {
          const subtype = actualObj.dict.get(NAME_SUBTYPE);
          const subtypeName = subtype instanceof PDFName ? getName(subtype) : "";

          if (subtypeName === "Image") {
            const ref = value instanceof PDFRef ? value : PDFRef.of(0);
            if (!seenRefs.has(refKey(ref))) {
              seenRefs.add(refKey(ref));
              const info = extractImageInfo(actualObj, name, pageIdx, "image", doTransforms.get(name));
              pageImages.push(info);
              images.push({
                name,
                ref,
                stream: actualObj,
                pageIndex: pageIdx,
                isFormImage: false,
                kind: "image",
              });
            }
          } else if (subtypeName === "Form") {
            const ref = value instanceof PDFRef ? value : PDFRef.of(0);
            const formInfo = extractFormInfo(actualObj, name, pageIdx, doTransforms.get(name));
            if (!seenRefs.has(refKey(ref))) {
              seenRefs.add(refKey(ref));
              pageImages.push(formInfo);
              images.push({
                name,
                ref,
                stream: actualObj,
                pageIndex: pageIdx,
                isFormImage: false,
                kind: "form",
              });
            }

            // Recurse into Form's nested Image XObjects
            const formResourcesRef = actualObj.dict.get(NAME_RESOURCES);
            if (formResourcesRef) {
              const formResources = context.lookup(formResourcesRef);
              if (formResources instanceof PDFDict) {
                const formXObjectRef = formResources.get(NAME_XOBJECT);
                if (formXObjectRef) {
                  const formXObject = context.lookup(formXObjectRef);
                  if (formXObject instanceof PDFDict) {
                    for (const fk of formXObject.keys()) {
                      const fv = formXObject.get(fk);
                      const fActual = context.lookup(fv);
                      if (fActual instanceof PDFStream) {
                        const fSubtype = fActual.dict.get(NAME_SUBTYPE);
                        const fSubtypeName = fSubtype instanceof PDFName ? getName(fSubtype) : "";
                        if (fSubtypeName === "Image") {
                          const fRef = fv instanceof PDFRef ? fv : PDFRef.of(0);
                          if (!seenRefs.has(refKey(fRef))) {
                            seenRefs.add(refKey(fRef));
                            const fName = getName(fk);
                            const info = extractImageInfo(fActual, fName, pageIdx, "image", undefined);
                            pageImages.push(info);
                            images.push({
                              name: fName,
                              ref: fRef,
                              stream: fActual,
                              pageIndex: pageIdx,
                              isFormImage: true,
                              formRef: ref,
                              kind: "image",
                            });
                          }
                        } else if (fSubtypeName === "Form") {
                          const fRef = fv instanceof PDFRef ? fv : PDFRef.of(0);
                          if (!seenRefs.has(refKey(fRef))) {
                            seenRefs.add(refKey(fRef));
                            const fName = getName(fk);
                            const info = extractFormInfo(fActual, fName, pageIdx, undefined);
                            pageImages.push(info);
                            images.push({
                              name: fName,
                              ref: fRef,
                              stream: fActual,
                              pageIndex: pageIdx,
                              isFormImage: true,
                              formRef: ref,
                              kind: "form",
                            });
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } else if (actualObj instanceof PDFDict) {
          const subtype = actualObj.get(NAME_SUBTYPE);
          const subtypeName = subtype instanceof PDFName ? getName(subtype) : "";
          if (subtypeName === "Form") {
            const formRef = value instanceof PDFRef ? value : undefined;
            try {
              const formResourcesRef = actualObj.get(NAME_RESOURCES);
              if (formResourcesRef) {
                const formResources = context.lookup(formResourcesRef);
                if (formResources instanceof PDFDict) {
                  const formXObjectRef = formResources.get(NAME_XOBJECT);
                  if (formXObjectRef) {
                    const formXObject = context.lookup(formXObjectRef);
                    if (formXObject instanceof PDFDict) {
                      for (const fk of formXObject.keys()) {
                        const fv = formXObject.get(fk);
                        const fActual = context.lookup(fv);
                        if (fActual instanceof PDFStream) {
                          const fSubtype = fActual.dict.get(NAME_SUBTYPE);
                          if (fSubtype instanceof PDFName && getName(fSubtype) === "Image") {
                            const fRef = fv instanceof PDFRef ? fv : PDFRef.of(0);
                            const fName = getName(fk);
                            const info = extractImageInfo(fActual, fName, pageIdx, "image", undefined);
                            pageImages.push(info);
                            images.push({
                              name: fName,
                              ref: fRef,
                              stream: fActual,
                              pageIndex: pageIdx,
                              isFormImage: true,
                              formRef,
                              kind: "image",
                            });
                          }
                        }
                      }
                    }
                  }
                }
              }
            } catch {
              // skip errors
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Error enumerating page ${pageIdx} images:`, err);
    }

    pageAnalyses.push({
      pageIndex: pageIdx,
      pageRef: `Page${pageIdx + 1}`,
      mediaBox: { x: 0, y: 0, width: pageWidth, height: pageHeight },
      images: pageImages,
      watermarkCandidates: [],
    });
  }

  return { images, pages: pageAnalyses };
}

function scanDoTransforms(
  context: PDFDocument["context"],
  pageNode: any
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  const NAME_CONTENTS = PDFName.of("Contents");

  const contentsRef = pageNode.get(NAME_CONTENTS);
  if (!contentsRef) return result;

  const decodeAndGetText = (streamObj: PDFRawStream): string => {
    let raw: Uint8Array | undefined;
    try {
      const decoded = decodePDFRawStream(streamObj);
      raw = decoded.decode();
    } catch {
      // ignore
    }
    if (!raw || raw.length === 0) {
      try {
        raw = (streamObj as any).contents;
      } catch {
        // ignore
      }
    }
    if (!raw || raw.length === 0) return "";
    try {
      const dec = pako.inflate(raw);
      return new TextDecoder("latin1" as any).decode(dec);
    } catch {
      return new TextDecoder("latin1" as any).decode(raw);
    }
  };

  const scanOne = (contentRef: PDFRef) => {
    const streamObj = context.lookup(contentRef);
    if (!streamObj || !(streamObj instanceof PDFRawStream)) return;
    const text = decodeAndGetText(streamObj);

    // Match cm (transform) ops: a b c d e f cm
    const cmRe = /([-+]?[\d.]+(?:[eE][-+]?\d+)?)\s+([-+]?[\d.]+(?:[eE][-+]?\d+)?)\s+([-+]?[\d.]+(?:[eE][-+]?\d+)?)\s+([-+]?[\d.]+(?:[eE][-+]?\d+)?)\s+([-+]?[\d.]+(?:[eE][-+]?\d+)?)\s+([-+]?[\d.]+(?:[eE][-+]?\d+)?)\s+cm/g;
    const doRe = /\/([^\s\/]+)\s+Do/g;

    const transforms: number[][] = [];
    let cmM: RegExpExecArray | null;
    while ((cmM = cmRe.exec(text)) !== null) {
      transforms.push(cmM.slice(1, 7).map(Number));
    }

    // Associate each Do with the preceding cm (nearest before it)
    const positions: { name: string; doIdx: number; doPos: number }[] = [];
    let doM: RegExpExecArray | null;
    while ((doM = doRe.exec(text)) !== null) {
      positions.push({ name: doM[1], doIdx: transforms.length - 1, doPos: doM.index });
    }

    // For each position, find the last cm before it
    const cmPositions: { pos: number; idx: number }[] = [];
    cmRe.lastIndex = 0;
    let cmM2: RegExpExecArray | null;
    let idx = 0;
    while ((cmM2 = cmRe.exec(text)) !== null) {
      cmPositions.push({ pos: cmM2.index, idx: idx++ });
    }

    for (const p of positions) {
      let bestCm: number | null = null;
      for (const cp of cmPositions) {
        if (cp.pos < p.doPos) bestCm = cp.idx;
        else break;
      }
      if (bestCm !== null && transforms[bestCm]) {
        if (!result.has(p.name)) {
          result.set(p.name, transforms[bestCm]);
        }
      }
    }
  };

  const contentsObj = context.lookup(contentsRef);
  if (contentsObj instanceof PDFArray) {
    for (let i = 0; i < contentsObj.size(); i++) {
      const item = contentsObj.get(i);
      if (item instanceof PDFRef) scanOne(item);
    }
  } else if (contentsRef instanceof PDFRef) {
    scanOne(contentsRef);
  }

  return result;
}

function makeEmptyAnalysis(
  pageIdx: number,
  pageWidth: number,
  pageHeight: number
): PageAnalysis {
  return {
    pageIndex: pageIdx,
    pageRef: `Page${pageIdx + 1}`,
    mediaBox: { x: 0, y: 0, width: pageWidth, height: pageHeight },
    images: [],
    watermarkCandidates: [],
  };
}

function extractImageInfo(
  stream: PDFStream,
  name: string,
  _pageIdx: number,
  kind: "image" | "form",
  transform?: number[]
): PdfXObjectInfo {
  const dict = stream.dict;

  const widthObj = dict.get(PDFName.of("Width"));
  const heightObj = dict.get(PDFName.of("Height"));
  const width = widthObj instanceof PDFNumber ? widthObj.asNumber() : 0;
  const height = heightObj instanceof PDFNumber ? heightObj.asNumber() : 0;

  let colorSpace = "Unknown";
  const csObj = dict.get(PDFName.of("ColorSpace"));
  if (csObj instanceof PDFName) {
    colorSpace = getName(csObj);
  } else if (csObj instanceof PDFArray && csObj.size() > 0) {
    const first = csObj.get(0);
    if (first instanceof PDFName) {
      colorSpace = getName(first);
    }
  }

  let bitsPerComponent = 0;
  const bpcObj = dict.get(PDFName.of("BitsPerComponent"));
  if (bpcObj instanceof PDFNumber) {
    bitsPerComponent = bpcObj.asNumber();
  }

  const hasAlpha =
    dict.get(PDFName.of("SMask")) !== undefined ||
    dict.get(PDFName.of("Mask")) !== undefined;

  let size = 0;
  if (stream instanceof PDFRawStream) {
    size = stream.contents.length;
  } else {
    try {
      size = stream.sizeInBytes();
    } catch {
      size = 0;
    }
  }

  return {
    kind,
    ref: name,
    name,
    width,
    height,
    colorSpace,
    bitsPerComponent,
    hasAlpha,
    size,
    transform,
    subtype: kind === "form" ? "Form" : "Image",
  };
}

function extractFormInfo(
  stream: PDFStream,
  name: string,
  _pageIdx: number,
  transform?: number[]
): PdfXObjectInfo {
  const dict = stream.dict;

  let widthObj = dict.get(PDFName.of("Width"));
  let heightObj = dict.get(PDFName.of("Height"));
  let width = widthObj instanceof PDFNumber ? widthObj.asNumber() : 0;
  let height = heightObj instanceof PDFNumber ? heightObj.asNumber() : 0;

  if (width === 0 || height === 0) {
    const bboxObj = dict.get(PDFName.of("BBox"));
    if (bboxObj instanceof PDFArray && bboxObj.size() >= 4) {
      const x2 = bboxObj.get(2) as PDFNumber;
      const y2 = bboxObj.get(3) as PDFNumber;
      const x1 = bboxObj.get(0) as PDFNumber;
      const y1 = bboxObj.get(1) as PDFNumber;
      const bw = (x2 as any)?.asNumber ? x2.asNumber() - (x1 as any)?.asNumber : 0;
      const bh = (y2 as any)?.asNumber ? y2.asNumber() - (y1 as any)?.asNumber : 0;
      if (bw > 0 && width === 0) width = bw;
      if (bh > 0 && height === 0) height = bh;
    }
  }

  let size = 0;
  if (stream instanceof PDFRawStream) {
    size = stream.contents.length;
  } else {
    try {
      size = stream.sizeInBytes();
    } catch {
      size = 0;
    }
  }

  let colorSpace = "Unknown";
  const csObj = dict.get(PDFName.of("ColorSpace"));
  if (csObj instanceof PDFName) {
    colorSpace = getName(csObj);
  }

  return {
    kind: "form",
    ref: name,
    name,
    width,
    height,
    colorSpace,
    bitsPerComponent: 0,
    hasAlpha: false,
    size,
    transform,
    subtype: "Form",
  };
}
