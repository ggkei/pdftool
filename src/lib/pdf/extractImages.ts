import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import pako from "pako";
import JSZip from "jszip";

export interface ExtractedImage {
  name: string;
  page: number;
  ref: string;
  width: number;
  height: number;
  colorSpace: string;
  mime: string;
  bytes: Uint8Array;
  size: number;
}

function getName(v: any): string {
  if (v instanceof PDFName) return v.asString().replace(/^\//, "");
  return "";
}
function getNum(v: any): number | null {
  if (typeof v === "number") return v;
  if (v?.asNumber) return v.asNumber();
  return null;
}

function readRawBytes(streamObj: PDFRawStream): Uint8Array {
  let raw: Uint8Array | undefined;
  try {
    const d = decodePDFRawStream(streamObj);
    raw = d.decode();
  } catch {}
  if (!raw || raw.length === 0) {
    try { raw = (streamObj as any).contents; } catch {}
  }
  return raw || new Uint8Array();
}

function decompressIfNeeded(raw: Uint8Array, filterName: string | null): Uint8Array {
  if (!filterName) return raw;
  if (filterName.toLowerCase().includes("flate")) {
    try { return pako.inflate(raw); } catch { return raw; }
  }
  if (filterName.toLowerCase().includes("ascii85")) {
    try {
      const dec = pako.inflate(raw);
      return dec;
    } catch { return raw; }
  }
  return raw;
}

function getFilterName(dict: PDFDict): string | null {
  const f = dict.get(PDFName.of("Filter"));
  if (f instanceof PDFName) return getName(f);
  if (f instanceof PDFArray) {
    for (let i = 0; i < f.size(); i++) {
      const item = f.get(i);
      if (item instanceof PDFName) return getName(item);
    }
  }
  return null;
}

function inferChannels(cs: string, bitsPerComponent: number): 1 | 3 | 4 {
  const c = cs.toLowerCase();
  if (c.includes("gray") || c.includes("indexed")) return 1;
  if (c.includes("cmyk")) return 4;
  if (c.includes("rgb") || c.includes("calrgb") || c.includes("lab")) return 3;
  if (c.includes("device")) return bitsPerComponent >= 8 ? 3 : 1;
  return 3;
}

function cmykToRgb(cmyk: Uint8Array): Uint8Array {
  const n = cmyk.length / 4;
  const rgb = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = cmyk[i * 4] / 255;
    const m = cmyk[i * 4 + 1] / 255;
    const y = cmyk[i * 4 + 2] / 255;
    const k = cmyk[i * 4 + 3] / 255;
    rgb[i * 3] = Math.round((1 - Math.min(1, c * (1 - k) + k)) * 255);
    rgb[i * 3 + 1] = Math.round((1 - Math.min(1, m * (1 - k) + k)) * 255);
    rgb[i * 3 + 2] = Math.round((1 - Math.min(1, y * (1 - k) + k)) * 255);
  }
  return rgb;
}

function encodePng(width: number, height: number, channels: number, raw: Uint8Array): Uint8Array {
  // Minimal PNG encoder: signature + IHDR + IDAT + IEND
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = channels === 1 ? 0 : channels === 3 ? 2 : 6; // color type
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Add filter byte (0 = None) at start of each scanline
  const stride = width * channels;
  const filtered = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    filtered[y * (stride + 1)] = 0;
    filtered.set(raw.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  const compressed = pako.deflate(filtered);

  const crc32 = (data: Uint8Array) => {
    let c = 0xFFFFFFFF;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let cc = n;
      for (let k = 0; k < 8; k++) cc = cc & 1 ? 0xEDB88320 ^ (cc >>> 1) : cc >>> 1;
      table[n] = cc >>> 0;
    }
    for (let i = 0; i < data.length; i++) c = table[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  const makeChunk = (type: string, data: Uint8Array) => {
    const typeBytes = new TextEncoder().encode(type);
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, data.length);
    const typeAndData = new Uint8Array(typeBytes.length + data.length);
    typeAndData.set(typeBytes, 0);
    typeAndData.set(data, typeBytes.length);
    const crc = new Uint8Array(4);
    new DataView(crc.buffer).setUint32(0, crc32(typeAndData));
    const chunk = new Uint8Array(len.length + typeAndData.length + crc.length);
    chunk.set(len, 0);
    chunk.set(typeAndData, len.length);
    chunk.set(crc, len.length + typeAndData.length);
    return chunk;
  };

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = makeChunk("IHDR", ihdr);
  const idatChunk = makeChunk("IDAT", compressed);
  const iendChunk = makeChunk("IEND", new Uint8Array());

  const total = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const png = new Uint8Array(total);
  png.set(signature, 0);
  png.set(ihdrChunk, signature.length);
  png.set(idatChunk, signature.length + ihdrChunk.length);
  png.set(iendChunk, signature.length + ihdrChunk.length + idatChunk.length);
  return png;
}

export async function extractImagesFromPdf(bytes: Uint8Array): Promise<ExtractedImage[]> {
  const doc = await PDFDocument.load(bytes);
  const results: ExtractedImage[] = [];
  const context = doc.context;
  const seenRefs = new Set<string>();

  for (let pi = 0; pi < doc.getPageCount(); pi++) {
    const page = doc.getPage(pi);
    const node = (page as any).node;
    const resRef = node.get(PDFName.of("Resources"));
    if (!resRef) continue;
    const res = context.lookup(resRef);
    if (!(res instanceof PDFDict)) continue;
    const xoRef = res.get(PDFName.of("XObject"));
    if (!xoRef) continue;
    const xoDict = context.lookup(xoRef);
    if (!(xoDict instanceof PDFDict)) continue;

    for (const key of xoDict.keys()) {
      const entry = xoDict.get(key);
      const name = getName(key);
      if (!(entry instanceof PDFRef)) continue;
      const refKey = `ref:${entry.objectNumber}`;
      if (seenRefs.has(refKey)) continue;
      seenRefs.add(refKey);

      const obj = context.lookup(entry);
      if (!(obj instanceof PDFRawStream)) continue;
      const subtype = getName(obj.dict.get(PDFName.of("Subtype")));
      if (subtype !== "Image") continue;

      const w = getNum(obj.dict.get(PDFName.of("Width"))) ?? 0;
      const h = getNum(obj.dict.get(PDFName.of("Height"))) ?? 0;
      const csObj = obj.dict.get(PDFName.of("ColorSpace"));
      let cs = "Unknown";
      if (csObj instanceof PDFName) cs = getName(csObj);
      else if (csObj instanceof PDFArray) {
        const first = csObj.get(0);
        if (first instanceof PDFName) cs = getName(first);
      }
      const bpp = getNum(obj.dict.get(PDFName.of("BitsPerComponent"))) ?? 8;
      const filterName = getFilterName(obj.dict);

      if (w === 0 || h === 0) continue;

      let raw = readRawBytes(obj);
      raw = decompressIfNeeded(raw, filterName);

      const channels = inferChannels(cs, bpp);
      const totalPixels = w * h;
      const expectedBytes = totalPixels * channels;

      let imageData = raw;
      if (channels === 4) {
        // CMYK → RGB
        if (raw.length === expectedBytes) {
          imageData = cmykToRgb(raw);
        }
      }

      const png = encodePng(w, h, channels === 4 ? 3 : channels, imageData);

      results.push({
        name,
        page: pi + 1,
        ref: refKey,
        width: w,
        height: h,
        colorSpace: cs,
        mime: "image/png",
        bytes: png,
        size: png.length,
      });
    }
  }

  return results;
}

export async function packImagesAsZip(images: ExtractedImage[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const counts = new Map<string, number>();
  for (const img of images) {
    const base = `page_${img.page}_${img.name}`;
    counts.set(base, (counts.get(base) || 0) + 1);
    const suffix = counts.get(base)! > 1 ? `_${counts.get(base)}` : "";
    zip.file(`${base}${suffix}.png`, img.bytes);
  }
  return zip.generateAsync({ type: "uint8array" });
}
