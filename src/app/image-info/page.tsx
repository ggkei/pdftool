"use client";

import { useState, useCallback } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t, getDateTimeLocale } from "@/i18n/dictionary";

interface ImageInfo {
  name: string;
  type: string;
  size: string;
  width: number;
  height: number;
  lastModified: string;
  aspectRatio: string;
  megapixels: string;
}

interface ExifInfo {
  Make?: string;
  Model?: string;
  DateTime?: string;
  FocalLength?: string;
  ISOSpeedRatings?: string;
  FNumber?: string;
  ExposureTime?: string;
  GPSLatitude?: string;
  GPSLongitude?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function readExif(file: File): Promise<ExifInfo> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buf = reader.result as ArrayBuffer;
      const view = new DataView(buf);
      let offset = 0;

      if (view.getUint16(0) === 0xffd8) {
        offset = 2;
        while (offset < view.byteLength) {
          const marker = view.getUint16(offset);
          if (marker === 0xffe1) {
            const exifLength = view.getUint16(offset + 2);
            const exifStart = offset + 4;
            if (view.getUint32(exifStart) === 0x45786966) {
              const tiffStart = exifStart + 6;
              const endian = view.getUint16(tiffStart);
              const little = endian === 0x4949;
              const ifdOffset = tiffStart + view.getUint32(tiffStart + 4, little);
              const entries = view.getUint16(ifdOffset, little);
              const exif: ExifInfo = {};

              for (let i = 0; i < entries; i++) {
                const entryOffset = ifdOffset + 2 + i * 12;
                const tag = view.getUint16(entryOffset, little);
                const type = view.getUint16(entryOffset + 2, little);
                const numValues = view.getUint32(entryOffset + 4, little);
                const valueOffset = view.getUint32(entryOffset + 8, little);

                try {
                  if (tag === 0x010f && type === 2) exif.Make = readString(view, entryOffset + 8, numValues, little);
                  else if (tag === 0x0110 && type === 2) exif.Model = readString(view, entryOffset + 8, numValues, little);
                  else if (tag === 0x0132 && type === 2) exif.DateTime = readString(view, valueOffset > 4 ? valueOffset : entryOffset + 8, numValues, little);
                  else if (tag === 0x920a && type === 5) exif.FocalLength = `${view.getUint32(valueOffset, little) / view.getUint32(valueOffset + 4, little)}mm`;
                  else if (tag === 0x8827 && type === 3) exif.ISOSpeedRatings = String(view.getUint16(entryOffset + 8, little));
                  else if (tag === 0x829d && type === 5) exif.FNumber = `f/${(view.getUint32(valueOffset, little) / view.getUint32(valueOffset + 4, little)).toFixed(1)}`;
                  else if (tag === 0x829a && type === 5) exif.ExposureTime = `${view.getUint32(valueOffset, little) / view.getUint32(valueOffset + 4, little)}s`;
                } catch { /* skip */ }
              }
              resolve(exif);
              return;
            }
          }
          offset += 2 + view.getUint16(offset + 2);
        }
      }
      resolve({});
    };
    reader.readAsArrayBuffer(file);
  });
}

function readString(view: DataView, offset: number, length: number, little: boolean): string {
  let str = "";
  for (let i = 0; i < length - 1; i++) {
    const code = view.getUint8(offset + i);
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str;
}

export default function ImageInfoPage() {
  const [info, setInfo] = useState<ImageInfo | null>(null);
  const [exif, setExif] = useState<ExifInfo | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError(t("img_info.error_format"));
      return;
    }
    setError("");
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const img = new Image();
    img.onload = async () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const divisor = gcd(w, h);
      const ratio = `${w / divisor}:${h / divisor}`;

      setInfo({
        name: file.name,
        type: file.type,
        size: formatSize(file.size),
        width: w,
        height: h,
        lastModified: new Date(file.lastModified).toLocaleString(getDateTimeLocale()),
        aspectRatio: ratio,
        megapixels: `${((w * h) / 1000000).toFixed(1)} MP`,
      });

      if (file.type === "image/jpeg") {
        const exifData = await readExif(file);
        setExif(Object.keys(exifData).length > 0 ? exifData : null);
      } else {
        setExif(null);
      }
    };
    img.src = url;
  }, []);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setInfo(null);
    setExif(null);
    setPreviewUrl("");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      reset();
      setTimeout(() => handleFile(file), 0);
    }
  };

  const tool = getToolById("image-info")!;

  const infoRows = info ? [
    { label: t("img_info.file_name"), value: info.name },
    { label: t("util_json_format.type_label"), value: info.type },
    { label: t("img_info.file_size"), value: info.size },
    { label: t("img_info.width"), value: `${info.width} px` },
    { label: t("img_info.height"), value: `${info.height} px` },
    { label: t("img_info.aspect_ratio"), value: info.aspectRatio },
    { label: t("img_info.total_pixels"), value: info.megapixels },
    { label: t("util_unit_convert.cat_time"), value: info.lastModified },
  ] : [];

  const exifRows = exif ? [
    { label: t("img_info.camera_brand"), value: exif.Make },
    { label: t("img_info.camera_model"), value: exif.Model },
    { label: t("util_unit_convert.cat_time"), value: exif.DateTime },
    { label: t("img_info.focal_length"), value: exif.FocalLength },
    { label: "ISO", value: exif.ISOSpeedRatings },
    { label: t("img_info.aperture"), value: exif.FNumber },
    { label: t("img_info.shutter"), value: exif.ExposureTime },
  ].filter((r) => r.value) : [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      <div className="mt-8 space-y-4">
        {!info && (
          <div className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
            dragOver ? "border-brand-400 bg-brand-50" : "border-slate-300 bg-white/60"
          }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}>
            <div className="mb-4 text-5xl">&#128269;</div>
            <p className="mb-2 text-sm font-medium text-zinc-700">{t("img_info.drag_hint")}</p>
            <p className="mb-6 text-xs text-zinc-400">{t("common.privacy_badge")}</p>
            <input type="file" accept="image/*" className="hidden" id="image-info-input"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
            <button onClick={() => document.getElementById("image-info-input")?.click()} className="btn-primary">{t("img_info.select_image")}</button>
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          </div>
        )}

        {info && (
          <>
            {previewUrl && (
              <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
                <img src={previewUrl} alt="preview" className="max-h-48 w-auto rounded-lg mx-auto" />
              </div>
            )}

            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("img_info.basic_info")}</h3>
              <div className="space-y-2">
                {infoRows.map((row) => (
                  <div key={row.label} className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-sm text-zinc-500">{row.label}</span>
                    <span className="text-sm font-medium text-zinc-800">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {exifRows.length > 0 && (
              <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
                <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("img_info.exif_title")}</h3>
                <div className="space-y-2">
                  {exifRows.map((row) => (
                    <div key={row.label} className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-sm text-zinc-500">{row.label}</span>
                      <span className="text-sm font-medium text-zinc-800">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={reset} className="btn-secondary">{t("common.reupload")}</button>
          </>
        )}
      </div>
    </main>
  );
}
