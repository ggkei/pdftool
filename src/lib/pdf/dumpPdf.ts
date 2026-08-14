import pako from "pako";
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRef,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";

export interface ContentStreamInfo {
  ref: string;
  rawLen: number;
  decompressedPreview: string;
  doOps: { name: string; before: string; after: string }[];
  filter: string | null;
  extractedTexts?: string[];
}

export interface XObjectInfo {
  ref: string;
  name: string;
  subtype: string;
  width: number | null;
  height: number | null;
  colorSpace: string | null;
  bitsPerComponent: number | null;
  filter: string | null;
  isImage: boolean;
  imageBytes?: Uint8Array;
  imageMime?: string;
  formContent?: ContentStreamInfo;
  formNestedXObjects?: XObjectInfo[];
  formTextPreview?: string;
}

export interface PageDump {
  pageIndex: number;
  mediaBox: { width: number; height: number };
  contentsType: "PDFArray" | "PDFRef" | "other";
  streams: ContentStreamInfo[];
  xobjects: XObjectInfo[];
  doOps: { name: string; streamIdx: number }[];
}

export interface PdfDump {
  pageCount: number;
  pages: PageDump[];
}

function readStreamBytes(streamObj: PDFRawStream): { raw: Uint8Array; decompressed: Uint8Array } {
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
  if (!raw || raw.length === 0) {
    raw = new Uint8Array(0);
  }
  let decompressed: Uint8Array;
  try {
    decompressed = pako.inflate(raw);
  } catch {
    decompressed = raw;
  }
  return { raw, decompressed };
}

function getFilterName(filter: unknown): string | null {
  const getName = (n: PDFName) => n.asString().replace(/^\//, "");
  if (filter instanceof PDFName) return getName(filter);
  if (filter instanceof PDFArray) {
    const names: string[] = [];
    for (let i = 0; i < filter.size(); i++) {
      const item = filter.get(i);
      if (item instanceof PDFName) names.push(getName(item));
    }
    return names.join(",");
  }
  return null;
}

export async function dumpPdf(pdfBytes: Uint8Array): Promise<PdfDump> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const context = pdfDoc.context;
  const NAME_CONTENTS = PDFName.of("Contents");
  const NAME_XOBJECT = PDFName.of("XObject");
  const NAME_RESOURCES = PDFName.of("Resources");

  const pages: PageDump[] = [];

  for (let pageIdx = 0; pageIdx < pdfDoc.getPageCount(); pageIdx++) {
    const page = pdfDoc.getPage(pageIdx);
    const node = (page as any).node;
    const mb = page.getMediaBox();

    const pageDump: PageDump = {
      pageIndex: pageIdx,
      mediaBox: { width: mb.width, height: mb.height },
      contentsType: "other",
      streams: [],
      xobjects: [],
      doOps: [],
    };

    // Contents
    const contentsRef = node.get(NAME_CONTENTS);
    if (contentsRef) {
      const contentsObj = context.lookup(contentsRef);
      if (contentsObj instanceof PDFArray) {
        pageDump.contentsType = "PDFArray";
        for (let i = 0; i < contentsObj.size(); i++) {
          const item = contentsObj.get(i);
          if (item instanceof PDFRef) {
            const streamInfo = dumpContentStream(context, item, i);
            pageDump.streams.push(streamInfo);
          }
        }
      } else if (contentsRef instanceof PDFRef) {
        pageDump.contentsType = "PDFRef";
        const streamInfo = dumpContentStream(context, contentsRef, 0);
        pageDump.streams.push(streamInfo);
      } else {
        pageDump.contentsType = "other";
      }
    }

    // Collect all Do ops across streams
    for (let i = 0; i < pageDump.streams.length; i++) {
      for (const op of pageDump.streams[i].doOps) {
        pageDump.doOps.push({ name: op.name, streamIdx: i });
      }
    }

    // XObjects from page Resources
    const resourcesRef = node.get(NAME_RESOURCES);
    if (resourcesRef) {
      const resources = context.lookup(resourcesRef);
      if (resources instanceof PDFDict) {
        const xobjRef = resources.get(NAME_XOBJECT);
        if (xobjRef) {
          const xobjDict = context.lookup(xobjRef);
          if (xobjDict instanceof PDFDict) {
            const keys = xobjDict.keys();
            for (const key of keys) {
              const xobjEntry = xobjDict.get(key);
              const name = key instanceof PDFName ? key.asString().replace(/^\//, "") : String(key);
              if (xobjEntry instanceof PDFRef) {
                const info = dumpXObject(context, xobjEntry, name);
                pageDump.xobjects.push(info);
              } else if (xobjEntry instanceof PDFDict) {
                const info = dumpXObjectInline(context, xobjEntry, name);
                pageDump.xobjects.push(info);
              }
            }
          }
        }
      }
    }

    pages.push(pageDump);
  }

  return {
    pageCount: pdfDoc.getPageCount(),
    pages,
  };
}

function dumpContentStream(
  context: PDFDocument["context"],
  ref: PDFRef,
  streamIdx: number
): ContentStreamInfo {
  const streamObj = context.lookup(ref);
  const base: ContentStreamInfo = {
    ref: `ref:${ref.objectNumber}`,
    rawLen: 0,
    decompressedPreview: "",
    doOps: [],
    filter: null,
  };

  if (!streamObj || !(streamObj instanceof PDFRawStream)) {
    return base;
  }

  const filterVal = streamObj.dict.get(PDFName.of("Filter"));
  base.filter = getFilterName(filterVal);

  const { raw, decompressed } = readStreamBytes(streamObj);
  base.rawLen = raw.length;

  const text = new TextDecoder("latin1" as any).decode(decompressed);
  base.decompressedPreview = text.substring(0, 500);

  // Find all Do ops with context
  const doRegex = /([^\s\/]+)\s+Do/g;
  let m: RegExpExecArray | null;
  while ((m = doRegex.exec(text)) !== null) {
    const start = Math.max(0, m.index - 40);
    const end = Math.min(text.length, m.index + m[0].length + 40);
    base.doOps.push({
      name: m[1],
      before: text.substring(start, m.index),
      after: text.substring(m.index + m[0].length, end),
    });
  }

  return base;
}

function dumpXObject(
  context: PDFDocument["context"],
  ref: PDFRef,
  name: string
): XObjectInfo {
  const obj = context.lookup(ref);
  const base: XObjectInfo = {
    ref: `ref:${ref.objectNumber}`,
    name,
    subtype: "",
    width: null,
    height: null,
    colorSpace: null,
    bitsPerComponent: null,
    filter: null,
    isImage: false,
  };

  if (!obj) return base;

  if (obj instanceof PDFRawStream) {
    base.subtype = getName(obj.dict.get(PDFName.of("Subtype")));
    base.width = getNum(obj.dict.get(PDFName.of("Width")));
    base.height = getNum(obj.dict.get(PDFName.of("Height")));
    const cs = obj.dict.get(PDFName.of("ColorSpace"));
    if (cs instanceof PDFName) base.colorSpace = getName(cs);
    else if (cs instanceof PDFArray) {
      const arr: string[] = [];
      for (let i = 0; i < cs.size(); i++) {
        const item = cs.get(i);
        if (item instanceof PDFName) arr.push(getName(item));
        else arr.push(String(item));
      }
      base.colorSpace = arr.join(" ");
    }
    base.bitsPerComponent = getNum(obj.dict.get(PDFName.of("BitsPerComponent")));
    const filterVal = obj.dict.get(PDFName.of("Filter"));
    base.filter = getFilterName(filterVal);
    base.isImage = base.subtype === "Image";

    // Attempt to extract PNG bytes for preview
    if (base.isImage) {
      const png = extractPngBytes(obj);
      if (png) {
        base.imageBytes = png.bytes;
        base.imageMime = png.mime;
      }
    }

    // Recurse into Form XObject
    if (base.subtype === "Form") {
      const filterV = obj.dict.get(PDFName.of("Filter"));
      const filterStr = getFilterName(filterV);
      const { raw, decompressed } = readStreamBytes(obj);
      const text = new TextDecoder("latin1" as any).decode(decompressed);
      const formContent: ContentStreamInfo = {
        ref: `ref:${ref.objectNumber}`,
        rawLen: raw.length,
        decompressedPreview: text.substring(0, 800),
        doOps: [],
        filter: filterStr,
      };
      const doRegex = /([^\s\/]+)\s+Do/g;
      let m: RegExpExecArray | null;
      while ((m = doRegex.exec(text)) !== null) {
        const start = Math.max(0, m.index - 40);
        const end = Math.min(text.length, m.index + m[0].length + 40);
        formContent.doOps.push({
          name: m[1],
          before: text.substring(start, m.index),
          after: text.substring(m.index + m[0].length, end),
        });
      }
      base.formContent = formContent;

      // Extract text from Tj/TJ operations
      const extractedTexts: string[] = [];
      const tjRe = /\(([^)]*)\)\s*Tj/g;
      let tm: RegExpExecArray | null;
      while ((tm = tjRe.exec(text)) !== null) extractedTexts.push(tm[1]);
      const tjRe2 = /\[([^\]]*)\]\s*TJ/g;
      while ((tm = tjRe2.exec(text)) !== null) {
        const inner = tm[1];
        const innerRe = /\(([^)]*)\)/g;
        let im: RegExpExecArray | null;
        while ((im = innerRe.exec(inner)) !== null) extractedTexts.push(im[1]);
      }
      formContent.extractedTexts = extractedTexts;

      // Set BBox dimensions as width/height for Form rendering
      const bbox = obj.dict.get(PDFName.of("BBox"));
      if (bbox instanceof PDFArray) {
        base.width = getNum(bbox.get(2));
        base.height = getNum(bbox.get(3));
      }

      // Compute text preview string
      if (extractedTexts.length > 0) {
        base.formTextPreview = extractedTexts.join(" ");
      }

      // Look for nested XObjects in the Form's Resources
      const formResourcesRef = obj.dict.get(PDFName.of("Resources"));
      if (formResourcesRef) {
        const formResources = context.lookup(formResourcesRef);
        if (formResources instanceof PDFDict) {
          const fxobjRef = formResources.get(PDFName.of("XObject"));
          if (fxobjRef) {
            const fxobjDict = context.lookup(fxobjRef);
            if (fxobjDict instanceof PDFDict) {
              const nested: XObjectInfo[] = [];
              const fkeys = fxobjDict.keys();
              for (const fkey of fkeys) {
                const fentry = fxobjDict.get(fkey);
                const fname = fkey instanceof PDFName ? fkey.asString().replace(/^\//, "") : String(fkey);
                if (fentry instanceof PDFRef) {
                  nested.push(dumpXObject(context, fentry, fname));
                }
              }
              if (nested.length > 0) base.formNestedXObjects = nested;
            }
          }
        }
      }
    }
  } else if (obj instanceof PDFDict) {
    base.subtype = getName(obj.get(PDFName.of("Subtype")));
  }

  return base;
}

function dumpXObjectInline(
  _context: PDFDocument["context"],
  dict: PDFDict,
  name: string
): XObjectInfo {
  return {
    ref: "inline",
    name,
    subtype: getName(dict.get(PDFName.of("Subtype"))),
    width: getNum(dict.get(PDFName.of("Width"))),
    height: getNum(dict.get(PDFName.of("Height"))),
    colorSpace: getName(dict.get(PDFName.of("ColorSpace"))),
    bitsPerComponent: getNum(dict.get(PDFName.of("BitsPerComponent"))),
    filter: getFilterName(dict.get(PDFName.of("Filter"))),
    isImage: getName(dict.get(PDFName.of("Subtype"))) === "Image",
  };
}

function getName(v: unknown): string {
  if (v instanceof PDFName) return v.asString().replace(/^\//, "");
  return "";
}

function getNum(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const any = v as any;
    if (typeof any.asNumber === "function") return any.asNumber();
    if (typeof any.value === "number") return any.value;
    if ("value" in any) return Number(any.value);
  }
  return null;
}

function extractPngBytes(streamObj: PDFRawStream): { bytes: Uint8Array; mime: string } | null {
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
  if (!raw || raw.length === 0) return null;

  let decompressed: Uint8Array;
  try {
    decompressed = pako.inflate(raw);
  } catch {
    decompressed = raw;
  }

  if (raw.length >= 8 && raw[0] === 0x89 && raw[1] === 0x50 && raw[2] === 0x4e && raw[3] === 0x47) {
    return { bytes: raw, mime: "image/png" };
  }
  if (raw.length >= 3 && raw[0] === 0xff && raw[1] === 0xd8 && raw[2] === 0xff) {
    return { bytes: raw, mime: "image/jpeg" };
  }

  const filterVal = streamObj.dict.get(PDFName.of("Filter"));
  const filterName = getFilterName(filterVal);

  if (filterName === "DCTDecode") {
    return { bytes: raw, mime: "image/jpeg" };
  }

  if (filterName === "FlateDecode" || filterName === null) {
    const w = getNum(streamObj.dict.get(PDFName.of("Width")));
    const h = getNum(streamObj.dict.get(PDFName.of("Height")));
    const bpc = getNum(streamObj.dict.get(PDFName.of("BitsPerComponent"))) ?? 8;
    if (!w || !h || bpc !== 8) return null;

    const csName = resolveColorSpaceName(streamObj.dict);
    const candidateChannels = suggestChannels(csName);

    for (const channels of candidateChannels) {
      const expected = w * h * channels;
      let pixelBytes: Uint8Array | null = null;

      if (decompressed.length === expected) {
        pixelBytes = decompressed;
      } else if (decompressed.length === expected + h) {
        pixelBytes = new Uint8Array(expected);
        for (let y = 0; y < h; y++) {
          const srcStart = y * (w * channels + 1) + 1;
          const dstStart = y * w * channels;
          pixelBytes.set(
            decompressed.subarray(srcStart, srcStart + w * channels),
            dstStart
          );
        }
      } else {
        continue;
      }

      if (channels === 4) {
        pixelBytes = cmykToRgb(pixelBytes);
      }

      const outChannels = channels === 4 ? 3 : channels;
      const png = encodePng(w, h, pixelBytes, outChannels, outChannels === 1);
      if (png) return { bytes: png, mime: "image/png" };
    }
  }

  return null;
}

function cmykToRgb(cmyk: Uint8Array): Uint8Array {
  const n = cmyk.length / 4;
  const rgb = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = cmyk[i * 4] / 255;
    const m = cmyk[i * 4 + 1] / 255;
    const y = cmyk[i * 4 + 2] / 255;
    const k = cmyk[i * 4 + 3] / 255;
    const r = (1 - Math.min(1, c * (1 - k) + k)) * 255;
    const g = (1 - Math.min(1, m * (1 - k) + k)) * 255;
    const b = (1 - Math.min(1, y * (1 - k) + k)) * 255;
    rgb[i * 3] = Math.round(r);
    rgb[i * 3 + 1] = Math.round(g);
    rgb[i * 3 + 2] = Math.round(b);
  }
  return rgb;
}

function resolveColorSpaceName(dict: PDFDict): string | null {
  const csVal = dict.get(PDFName.of("ColorSpace"));
  if (!csVal) return null;
  if (csVal instanceof PDFName) return getName(csVal);
  if (csVal instanceof PDFArray && csVal.size() > 0) {
    const first = csVal.get(0);
    if (first instanceof PDFName) return getName(first);
  }
  return null;
}

function suggestChannels(csName: string | null): number[] {
  const ordered: number[] = [];
  const push = (c: number) => { if (!ordered.includes(c)) ordered.push(c); };

  switch (csName) {
    case "DeviceGray":
    case "CalGray":
    case "Pattern":
      push(1); break;
    case "DeviceRGB":
    case "CalRGB":
    case "ICCBased":
    case "Lab":
      push(3); break;
    case "DeviceCMYK":
      push(4); break;
    case "Indexed":
    case "I":
      push(1); break;
    default:
      push(1); push(3); push(4);
  }

  return ordered;
}

// Minimal PNG encoder
function encodePng(width: number, height: number, pixels: Uint8Array, channels: number, isGray: boolean): Uint8Array | null {
  try {
    const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const ihdr = new Uint8Array(13);
    const dv = new DataView(ihdr.buffer);
    dv.setUint32(0, width);
    dv.setUint32(4, height);
    ihdr[8] = 8; // bit depth
    ihdr[9] = isGray ? 0 : 2; // color type
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const rawRowSize = width * channels + 1; // +1 filter byte
    const rawData = new Uint8Array(height * rawRowSize);
    for (let y = 0; y < height; y++) {
      rawData[y * rawRowSize] = 0;
      const srcStart = y * width * channels;
      const dstStart = y * rawRowSize + 1;
      rawData.set(pixels.subarray(srcStart, srcStart + width * channels), dstStart);
    }

    const idatDeflated = pako.deflate(rawData);

    const chunks: Uint8Array[] = [];
    chunks.push(sig);
    chunks.push(makePngChunk("IHDR", ihdr));
    chunks.push(makePngChunk("IDAT", idatDeflated));
    chunks.push(makePngChunk("IEND", new Uint8Array(0)));

    let total = 0;
    for (const c of chunks) total += c.length;
    const result = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      result.set(c, off);
      off += c.length;
    }
    return result;
  } catch {
    return null;
  }
}

function makePngChunk(type: string, data: Uint8Array): Uint8Array {
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, data.length);
  const typeBytes = new TextEncoder().encode(type);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  const crcVal = crc32(crcInput);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(0, crcVal >>> 0);
  const result = new Uint8Array(len.length + typeBytes.length + data.length + crc.length);
  result.set(len, 0);
  result.set(typeBytes, len.length);
  result.set(data, len.length + typeBytes.length);
  result.set(crc, len.length + typeBytes.length + data.length);
  return result;
}

let crcTable: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return c ^ 0xffffffff;
}
