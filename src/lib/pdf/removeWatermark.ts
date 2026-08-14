import pako from "pako";
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFNumber,
  PDFRef,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
import { enumerateImages, InternalImageRef } from "./enumerateImages";
import { analyzeWatermarks } from "./analyzeWatermark";
import {
  parseContentStream,
  serializeOps,
  filterOutImageOps,
} from "./contentStreamOps";
import type { PageAnalysis, RemoveOptions, RemoveResult } from "./types";

export async function analyzePdf(
  pdfBytes: Uint8Array,
  options: RemoveOptions = {}
): Promise<PageAnalysis[]> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const { pages } = enumerateImages(pdfDoc);
  return analyzeWatermarks(pages, options);
}

export async function removeWatermark(
  pdfBytes: Uint8Array,
  options: RemoveOptions = {}
): Promise<RemoveResult> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const context = pdfDoc.context;
  const { images, pages } = enumerateImages(pdfDoc);
  const analyzedPages = analyzeWatermarks(pages, options);

  let totalRemoved = 0;

  const NAME_CONTENTS = PDFName.of("Contents");
  const NAME_FILTER = PDFName.of("Filter");
  const NAME_LENGTH = PDFName.of("Length");
  const NAME_FLATE_DECODE = PDFName.of("FlateDecode");

  for (let pageIdx = 0; pageIdx < analyzedPages.length; pageIdx++) {
    const page = pdfDoc.getPage(pageIdx);
    const pageAnalysis = analyzedPages[pageIdx];

    let targetNames = new Set<string>();

    if (options.selectedImageRefs && options.selectedImageRefs.length > 0) {
      for (const ref of options.selectedImageRefs) {
        const name = ref.split(":").pop();
        if (name) targetNames.add(name);
      }
    } else if (options.autoSelect !== false) {
      for (const candidate of pageAnalysis.watermarkCandidates) {
        if (candidate.score >= 0.5) {
          targetNames.add(candidate.image.name);
        }
      }
    }

    if (targetNames.size === 0) continue;

    const node = (page as any).node;
    const contentsRef = node.get(NAME_CONTENTS);
    if (!contentsRef) continue;

    const contentsObj = context.lookup(contentsRef);

    if (contentsObj instanceof PDFArray) {
      for (let i = 0; i < contentsObj.size(); i++) {
        const contentRef = contentsObj.get(i);
        if (contentRef instanceof PDFRef) {
          try {
            totalRemoved += processContentStream(
              context, contentRef, targetNames,
              NAME_FILTER, NAME_LENGTH, NAME_FLATE_DECODE
            );
          } catch {
            // skip unprocessable stream
          }
        }
      }
    } else if (contentsRef instanceof PDFRef) {
      try {
        totalRemoved += processContentStream(
          context, contentsRef, targetNames,
          NAME_FILTER, NAME_LENGTH, NAME_FLATE_DECODE
        );
      } catch {
        // skip unprocessable stream
      }
    }
  }

  await removeUnusedImageResources(pdfDoc, images, analyzedPages, context);

  const outputBytes = await pdfDoc.save({
    useObjectStreams: false,
    addDefaultPage: false,
  });

  return {
    pageCount: analyzedPages.length,
    removedCount: totalRemoved,
    outputBytes,
  };
}

function processContentStream(
  context: PDFDocument["context"],
  contentRef: PDFRef,
  targetNames: Set<string>,
  NAME_FILTER: PDFName,
  NAME_LENGTH: PDFName,
  NAME_FLATE_DECODE: PDFName
): number {
  const streamObj = context.lookup(contentRef);
  if (!streamObj || !(streamObj instanceof PDFRawStream)) return 0;

  let rawContents: Uint8Array | undefined;
  try {
    const decoded = decodePDFRawStream(streamObj);
    rawContents = decoded.decode();
  } catch {
    // decodePDFRawStream threw; try fallback
  }

  if (!rawContents || rawContents.length === 0) {
    rawContents = (streamObj as any).contents;
  }

  if (!rawContents || rawContents.length === 0) return 0;

  let decompressed: Uint8Array;
  try {
    decompressed = pako.inflate(rawContents);
  } catch {
    decompressed = rawContents;
  }

  let ops;
  try {
    ops = parseContentStream(decompressed);
  } catch {
    return 0;
  }

  const originalCount = ops.length;
  const filteredOps = filterOutImageOps(ops, targetNames);
  const removed = originalCount - filteredOps.length;

  if (removed > 0) {
    const newDecompressed = serializeOps(filteredOps, false);

    const hasFlate = streamObj.dict.get(NAME_FILTER);
    let newContents: Uint8Array;

    if (hasFlate && isFlateFilter(hasFlate)) {
      newContents = pako.deflate(newDecompressed);
    } else {
      newContents = newDecompressed;
    }

    const newDict = streamObj.dict.clone(context);
    newDict.set(NAME_LENGTH, PDFNumber.of(newContents.length));

    const newStream = PDFRawStream.of(newDict, newContents);
    context.assign(contentRef, newStream);
  }

  return removed;
}

function isFlateFilter(filterObj: unknown): boolean {
  const getName = (n: PDFName) => n.asString().replace(/^\//, "");
  if (filterObj instanceof PDFName) {
    return getName(filterObj) === "FlateDecode";
  }
  if (filterObj instanceof PDFArray) {
    for (let i = 0; i < filterObj.size(); i++) {
      const item = filterObj.get(i);
      if (item instanceof PDFName && getName(item) === "FlateDecode") {
        return true;
      }
    }
  }
  return false;
}

async function removeUnusedImageResources(
  pdfDoc: PDFDocument,
  allImages: InternalImageRef[],
  analyzedPages: PageAnalysis[],
  context: PDFDocument["context"]
): Promise<void> {
  const usedNamesByPage = new Map<number, Set<string>>();
  const context2 = context as any;

  for (let pageIdx = 0; pageIdx < analyzedPages.length; pageIdx++) {
    const page = pdfDoc.getPage(pageIdx);
    const node = (page as any).node;
    const contentsRef = node.get(PDFName.of("Contents"));
    if (!contentsRef) continue;

    const used = new Set<string>();
    const collectFromContent = (contentRef: PDFRef) => {
      const streamObj = context2.lookup(contentRef);
      if (!streamObj || !(streamObj instanceof PDFRawStream)) return;

      let rawContents: Uint8Array | undefined;
      try {
        const decoded = decodePDFRawStream(streamObj);
        rawContents = decoded.decode();
      } catch {
        // decodePDFRawStream threw; try fallback
      }

      if (!rawContents || rawContents.length === 0) {
        rawContents = (streamObj as any).contents;
      }

      if (!rawContents || rawContents.length === 0) return;

      let decompressed: Uint8Array;
      try {
        decompressed = pako.inflate(rawContents);
      } catch {
        decompressed = rawContents;
      }

      const text = new TextDecoder("latin1" as any).decode(decompressed);
      const matches = text.matchAll(/\/([^\s\/]+)\s+Do/g);
      for (const m of matches) {
        used.add(m[1]);
      }
    };

    const contentsObj = context2.lookup(contentsRef);
    if (contentsObj instanceof PDFArray) {
      for (let i = 0; i < contentsObj.size(); i++) {
        const item = contentsObj.get(i);
        if (item instanceof PDFRef) {
          collectFromContent(item);
        }
      }
    } else if (contentsRef instanceof PDFRef) {
      collectFromContent(contentsRef);
    }

    usedNamesByPage.set(pageIdx, used);
  }

  const NAME_XOBJECT = PDFName.of("XObject");
  const NAME_RESOURCES = PDFName.of("Resources");

  for (const img of allImages) {
    const used = usedNamesByPage.get(img.pageIndex);
    if (used && !used.has(img.name) && img.ref && img.ref.objectNumber !== 0) {
      if (img.isFormImage && img.formRef) {
        try {
          const formStream = context2.lookup(img.formRef);
          if (formStream instanceof PDFRawStream) {
            const formDict = formStream.dict.clone(context2);
            const formResRef = formDict.get(NAME_RESOURCES);
            if (formResRef) {
              const formResources = context2.lookup(formResRef);
              if (formResources instanceof PDFDict) {
                const formXObjRef = formResources.get(NAME_XOBJECT);
                if (formXObjRef) {
                  const formXObj = context2.lookup(formXObjRef);
                  if (formXObj instanceof PDFDict) {
                    const targetRef = formXObj.get(PDFName.of(img.name));
                    if (targetRef) {
                      formXObj.delete(PDFName.of(img.name));
                    }
                  }
                }
              }
            }
            const newFormContents = formStream.contents;
            const newFormDict = formDict.clone(context2);
            newFormDict.set(PDFName.of("Length"), PDFNumber.of(newFormContents.length));
            context2.assign(img.formRef, PDFRawStream.of(newFormDict, newFormContents));
          }
        } catch {
          // skip
        }
      }
    }
  }
}
