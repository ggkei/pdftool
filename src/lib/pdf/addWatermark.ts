import { PDFDocument, rgb, degrees, StandardFonts, PDFImage } from "pdf-lib";

export interface WatermarkOptions {
  type: "text" | "image";
  text?: string;
  fontSize?: number;
  color?: string;
  opacity?: number;
  rotation?: number;
  position?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "tile";
  scale?: number;
  imageBytes?: Uint8Array;
}

function hexToRgb(hex: string): ReturnType<typeof rgb> {
  const h = hex.replace("#", "");
  if (h.length !== 6) return rgb(0.75, 0, 0);
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function hasNonAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 127) return true;
  }
  return false;
}

function textToPng(
  text: string,
  fontSize: number,
  color: string,
  opacity: number
): Uint8Array {
  const dpr = 2;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  ctx.font = `bold ${fontSize * dpr}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`;
  const metrics = ctx.measureText(text);
  const textW = Math.ceil(metrics.width);
  const ascent = metrics.actualBoundingBoxAscent ?? fontSize * 0.8;
  const descent = metrics.actualBoundingBoxDescent ?? fontSize * 0.2;
  const textH = Math.ceil(ascent + descent);

  const pad = Math.ceil(fontSize * 0.3) * dpr;
  canvas.width = textW + pad * 2;
  canvas.height = textH + pad * 2;

  ctx.font = `bold ${fontSize * dpr}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.globalAlpha = Math.max(0.05, Math.min(1, opacity));

  const m = color.match(/^#?([0-9a-f]{6})$/i);
  if (m) {
    const r = parseInt(m[1].slice(0, 2), 16);
    const g = parseInt(m[1].slice(2, 4), 16);
    const b = parseInt(m[1].slice(4, 6), 16);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
  } else {
    ctx.fillStyle = color;
  }

  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const out = canvas.toDataURL("image/png");
  const base64 = out.split(",")[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function addWatermarkToPdf(
  bytes: Uint8Array,
  opts: WatermarkOptions
): Promise<{ pageCount: number; outputBytes: Uint8Array }> {
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages();

  const fontSize = opts.fontSize ?? 48;
  const opacity = opts.opacity ?? 0.3;
  const rotation = opts.rotation ?? -30;
  const color = opts.color ?? "#c00000";
  const scale = opts.scale ?? 0.5;

  let embeddedImg: PDFImage | undefined;
  let useTextPath = false;
  let font: Awaited<ReturnType<typeof doc.embedFont>> | null = null;

  if (opts.type === "image" && opts.imageBytes) {
    try {
      if (opts.imageBytes[0] === 0x89) {
        embeddedImg = await doc.embedPng(opts.imageBytes);
      } else {
        embeddedImg = await doc.embedJpg(opts.imageBytes);
      }
    } catch (e) {
      throw new Error("图片水印仅支持 PNG 或 JPG 格式");
    }
  } else if (opts.type === "text" && opts.text) {
    if (hasNonAscii(opts.text)) {
      const pngBytes = textToPng(opts.text, fontSize, color, opacity);
      embeddedImg = await doc.embedPng(pngBytes);
    } else {
      font = await doc.embedFont(StandardFonts.Helvetica);
      useTextPath = true;
    }
  }

  for (const page of pages) {
    const { width, height } = page.getSize();

    if (useTextPath && font && opts.type === "text" && opts.text) {
      page.drawText(opts.text, {
        x: width / 2,
        y: height / 2,
        size: fontSize,
        font,
        color: hexToRgb(color),
        opacity: Math.max(0.05, Math.min(1, opacity)),
        rotate: degrees(rotation),
        xSkew: degrees(0),
        ySkew: degrees(0),
      });
    } else if (embeddedImg) {
      const iw = embeddedImg.width * (opts.type === "text" ? 1 : scale);
      const ih = embeddedImg.height * (opts.type === "text" ? 1 : scale);
      const cx = width / 2;
      const cy = height / 2;

      page.drawImage(embeddedImg, {
        x: cx - iw / 2,
        y: cy - ih / 2,
        width: iw,
        height: ih,
        opacity: opts.type === "text" ? 1 : Math.max(0.05, Math.min(1, opacity)),
        rotate: degrees(rotation),
      });
    }
  }

  const outputBytes = await doc.save({ useObjectStreams: false });
  return { pageCount: pages.length, outputBytes };
}
