"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

type Step = "upload" | "edit" | "done";
type DragMode = "none" | "create" | "move" | "resize";
type ResizeHandle =
  | "n" | "s" | "e" | "w"
  | "ne" | "nw" | "se" | "sw";

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* 手柄尺寸（显示像素） */
const HANDLE_SIZE = 12;
const HANDLE_HIT = 16;

export default function ImageCropPage() {
  const [step, setStep] = useState<Step>("upload");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
  const [aspectRatio, setAspectRatio] = useState<string>("free");

  const [dragMode, setDragMode] = useState<DragMode>("none");
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const cropOnStartRef = useRef<CropRect | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ---------- 文件处理 ---------- */
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError(t("common.error_image_only"));
      return;
    }
    setError("");
    setOriginalFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const img = new Image();
    img.onload = () => {
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      /* 默认全图选中 */
      setCrop({ x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight });
      setStep("edit");
    };
    img.src = url;
  }, []);

  const applyCrop = useCallback(() => {
    if (!originalFile || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = Math.max(1, crop.w);
      canvas.height = Math.max(1, crop.h);
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setResultUrl(url);
          setStep("done");
        }
      }, originalFile.type || "image/jpeg");
    };
    img.src = previewUrl;
  }, [originalFile, crop, previewUrl]);

  /* 二次裁剪：将裁剪结果作为新原图继续裁剪 */
  const continueCrop = useCallback(() => {
    if (!resultUrl || !originalFile) return;
    const newFile = new File(
      [originalFile],
      `${originalFile.name.replace(/\.[^.]+$/, "")}_cropped.${originalFile.name.split(".").pop()}`,
      { type: originalFile.type }
    );
    /* 用 resultUrl 作为新的 previewUrl */
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(resultUrl);
    setResultUrl("");
    setOriginalFile(newFile);

    const img = new Image();
    img.onload = () => {
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setCrop({ x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight });
      setStep("edit");
    };
    img.src = resultUrl;
  }, [resultUrl, originalFile, previewUrl]);

  const download = () => {
    if (!resultUrl || !originalFile) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `${originalFile.name.replace(/\.[^.]+$/, "")}_cropped.${originalFile.name.split(".").pop()}`;
    a.click();
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setStep("upload");
    setOriginalFile(null);
    setPreviewUrl("");
    setResultUrl("");
    setError("");
    setCrop({ x: 0, y: 0, w: 0, h: 0 });
    setImgSize({ w: 0, h: 0 });
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

  /* ---------- 坐标转换：基于 imgRef 实际渲染尺寸 ---------- */
  const getImgRect = () => {
    if (!imgRef.current) return { left: 0, top: 0, width: 0, height: 0 };
    return imgRef.current.getBoundingClientRect();
  };

  /* 鼠标像素坐标 → 图片原始像素坐标 */
  const mouseToImgPx = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = getImgRect();
    if (!rect.width || !rect.height || !imgSize.w || !imgSize.h) return { x: 0, y: 0 };
    const rx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ry = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return {
      x: Math.round(rx * imgSize.w),
      y: Math.round(ry * imgSize.h),
    };
  };

  /* 图片原始像素坐标 → CSS 像素（用于渲染选区/手柄） */
  const imgPxToCss = (px: number, axis: "x" | "y") => {
    const rect = getImgRect();
    if (!rect.width || !rect.height || !imgSize.w || !imgSize.h) return 0;
    const ratio = axis === "x" ? rect.width / imgSize.w : rect.height / imgSize.h;
    return px * ratio;
  };

  /* ---------- 工具：判断点击位置 ---------- */
  const getResizeHandle = (
    clientX: number,
    clientY: number,
    cr: CropRect
  ): ResizeHandle | null => {
    const rect = getImgRect();
    if (!rect.width || !rect.height) return null;
    const hx = rect.left + imgPxToCss(cr.x, "x");
    const hy = rect.top + imgPxToCss(cr.y, "y");
    const hw = imgPxToCss(cr.w, "x");
    const hh = imgPxToCss(cr.h, "y");
    const h = HANDLE_HIT;

    const nearLeft = Math.abs(clientX - hx) < h;
    const nearRight = Math.abs(clientX - (hx + hw)) < h;
    const nearTop = Math.abs(clientY - hy) < h;
    const nearBottom = Math.abs(clientY - (hy + hh)) < h;

    if (nearTop && nearLeft) return "nw";
    if (nearTop && nearRight) return "ne";
    if (nearBottom && nearLeft) return "sw";
    if (nearBottom && nearRight) return "se";
    if (nearTop) return "n";
    if (nearBottom) return "s";
    if (nearLeft) return "w";
    if (nearRight) return "e";

    return null;
  };

  const isInsideCrop = (clientX: number, clientY: number, cr: CropRect) => {
    const rect = getImgRect();
    if (!rect.width || !rect.height) return false;
    const hx = rect.left + imgPxToCss(cr.x, "x");
    const hy = rect.top + imgPxToCss(cr.y, "y");
    const hw = imgPxToCss(cr.w, "x");
    const hh = imgPxToCss(cr.h, "y");
    return clientX >= hx && clientX <= hx + hw && clientY >= hy && clientY <= hy + hh;
  };

  /* ---------- 约束选区在图片内（关键：选区必须完全在图片内） ---------- */
  const clampCrop = (c: CropRect): CropRect => {
    let { x, y, w, h } = c;
    x = Math.max(0, Math.min(x, imgSize.w - 1));
    y = Math.max(0, Math.min(y, imgSize.h - 1));
    w = Math.max(1, Math.min(w, imgSize.w - x));
    h = Math.max(1, Math.min(h, imgSize.h - y));
    return { x, y, w, h };
  };

  /* 应用宽高比 */
  const applyAspectRatio = (w: number, h: number, ratio: number): [number, number] => {
    if (ratio <= 0) return [w, h];
    const currentRatio = w / h;
    if (currentRatio > ratio) {
      return [h * ratio, h];
    } else {
      return [w, w / ratio];
    }
  };

  /* ---------- 鼠标事件 ---------- */
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgSize.w || !imgSize.h) return;
    const { x: mx, y: my } = mouseToImgPx(e.clientX, e.clientY);

    /* 优先检测手柄 */
    const handle = getResizeHandle(e.clientX, e.clientY, crop);
    if (handle) {
      setDragMode("resize");
      setResizeHandle(handle);
      dragStartRef.current = { x: mx, y: my };
      cropOnStartRef.current = { ...crop };
      return;
    }

    /* 检测是否在选区内 → 移动 */
    if (isInsideCrop(e.clientX, e.clientY, crop)) {
      setDragMode("move");
      dragStartRef.current = { x: mx, y: my };
      cropOnStartRef.current = { ...crop };
      return;
    }

    /* 否则创建新选区 */
    setDragMode("create");
    dragStartRef.current = { x: mx, y: my };
    setCrop({ x: mx, y: my, w: 1, h: 1 });
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragMode === "none" || !dragStartRef.current) return;
    if (!imgSize.w || !imgSize.h) return;

    const { x: mx, y: my } = mouseToImgPx(e.clientX, e.clientY);

    if (dragMode === "create") {
      const startX = dragStartRef.current.x;
      const startY = dragStartRef.current.y;

      let x = Math.min(startX, mx);
      let y = Math.min(startY, my);
      let w = Math.abs(mx - startX);
      let h = Math.abs(my - startY);

      /* 限制在图片边界 */
      x = Math.max(0, Math.min(x, imgSize.w));
      y = Math.max(0, Math.min(y, imgSize.h));
      w = Math.min(w, imgSize.w - x);
      h = Math.min(h, imgSize.h - y);

      if (aspectRatio !== "free") {
        const ratio = parseFloat(aspectRatio);
        [w, h] = applyAspectRatio(w, h, ratio);
        if (x + w > imgSize.w) w = imgSize.w - x;
        if (y + h > imgSize.h) h = imgSize.h - y;
      }

      setCrop({ x, y, w: Math.max(1, w), h: Math.max(1, h) });
      return;
    }

    if (dragMode === "move" && cropOnStartRef.current) {
      const dxPx = mx - dragStartRef.current.x;
      const dyPx = my - dragStartRef.current.y;
      const base = cropOnStartRef.current;
      let newX = base.x + dxPx;
      let newY = base.y + dyPx;

      newX = Math.max(0, Math.min(newX, imgSize.w - base.w));
      newY = Math.max(0, Math.min(newY, imgSize.h - base.h));

      setCrop({ ...base, x: newX, y: newY });
      return;
    }

    if (dragMode === "resize" && cropOnStartRef.current && resizeHandle) {
      const dxPx = mx - dragStartRef.current.x;
      const dyPx = my - dragStartRef.current.y;
      const base = cropOnStartRef.current;
      let { x, y, w, h } = base;

      const handle = resizeHandle;
      if (handle.includes("e")) w = Math.max(1, Math.min(base.w + dxPx, imgSize.w - base.x));
      if (handle.includes("w")) {
        const newW = Math.max(1, Math.min(base.w - dxPx, base.x + base.w));
        x = Math.max(0, base.x + base.w - newW);
        w = newW;
      }
      if (handle.includes("s")) h = Math.max(1, Math.min(base.h + dyPx, imgSize.h - base.y));
      if (handle.includes("n")) {
        const newH = Math.max(1, Math.min(base.h - dyPx, base.y + base.h));
        y = Math.max(0, base.y + base.h - newH);
        h = newH;
      }

      if (aspectRatio !== "free") {
        const ratio = parseFloat(aspectRatio);
        if (handle.includes("e") || handle.includes("w")) {
          h = w / ratio;
        } else {
          w = h * ratio;
        }
      }

      const clamped = clampCrop({ x, y, w, h });
      setCrop(clamped);
    }
  };

  const onMouseUp = () => {
    setDragMode("none");
    setResizeHandle(null);
    dragStartRef.current = null;
    cropOnStartRef.current = null;
  };

  /* ---------- 选区样式 ---------- */
  const cropStyle = () => {
    if (!imgSize.w || !imgSize.h) return {};
    return {
      left: imgPxToCss(crop.x, "x"),
      top: imgPxToCss(crop.y, "y"),
      width: imgPxToCss(crop.w, "x"),
      height: imgPxToCss(crop.h, "y"),
    };
  };

  /* 手柄位置 */
  const handlePositions: { key: ResizeHandle; style: React.CSSProperties }[] =
    imgSize.w && imgSize.h
      ? [
          { key: "nw", style: { left: imgPxToCss(crop.x, "x") - HANDLE_SIZE / 2, top: imgPxToCss(crop.y, "y") - HANDLE_SIZE / 2 } },
          { key: "ne", style: { left: imgPxToCss(crop.x + crop.w, "x") - HANDLE_SIZE / 2, top: imgPxToCss(crop.y, "y") - HANDLE_SIZE / 2 } },
          { key: "sw", style: { left: imgPxToCss(crop.x, "x") - HANDLE_SIZE / 2, top: imgPxToCss(crop.y + crop.h, "y") - HANDLE_SIZE / 2 } },
          { key: "se", style: { left: imgPxToCss(crop.x + crop.w, "x") - HANDLE_SIZE / 2, top: imgPxToCss(crop.y + crop.h, "y") - HANDLE_SIZE / 2 } },
          { key: "n", style: { left: imgPxToCss(crop.x + crop.w / 2, "x") - HANDLE_SIZE / 2, top: imgPxToCss(crop.y, "y") - HANDLE_SIZE / 2 } },
          { key: "s", style: { left: imgPxToCss(crop.x + crop.w / 2, "x") - HANDLE_SIZE / 2, top: imgPxToCss(crop.y + crop.h, "y") - HANDLE_SIZE / 2 } },
          { key: "w", style: { left: imgPxToCss(crop.x, "x") - HANDLE_SIZE / 2, top: imgPxToCss(crop.y + crop.h / 2, "y") - HANDLE_SIZE / 2 } },
          { key: "e", style: { left: imgPxToCss(crop.x + crop.w, "x") - HANDLE_SIZE / 2, top: imgPxToCss(crop.y + crop.h / 2, "y") - HANDLE_SIZE / 2 } },
        ]
      : [];

  const tool = getToolById("image-crop")!;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      {step === "upload" && (
        <div
          className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
            dragOver ? "border-brand-400 bg-brand-50" : "border-slate-300 bg-white/60"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <div className="mb-4 text-5xl">&#9986;</div>
          <p className="mb-2 text-sm font-medium text-zinc-700">{t("img_crop.drag_hint")}</p>
          <p className="mb-6 text-xs text-zinc-400">{t("img_crop.drag_hint2")}</p>
          <button onClick={() => inputRef.current?.click()} className="btn-primary">{t("img_crop.select_image")}</button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </div>
      )}

      {(step === "edit" || step === "done") && (
        <div className="space-y-6"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {dragOver && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-50/80 border-4 border-dashed border-brand-400 rounded-2xl pointer-events-none">
              <p className="text-lg font-medium text-brand-700">{t("common.drag_replace")}</p>
            </div>
          )}

          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-zinc-700">{t("img_crop.section_title")}</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "free", label: t("img_crop.ratio_free") },
                  { id: "1", label: "1:1" },
                  { id: "1.7778", label: "16:9" },
                  { id: "1.3333", label: "4:3" },
                  { id: "0.75", label: "3:4" },
                  { id: "0.5625", label: "9:16" },
                ].map((r) => (
                  <button key={r.id} onClick={() => setAspectRatio(r.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      aspectRatio === r.id ? "bg-brand-600 text-white" : "bg-slate-100 text-zinc-600 hover:bg-slate-200"
                    }`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-zinc-500 mb-3">
              {t("img_crop.hint_text")}
            </p>

            <div
              ref={containerRef}
              className="relative inline-block select-none touch-none"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              style={{ cursor: dragMode === "move" ? "move" : dragMode === "resize" ? "nwse-resize" : "crosshair" }}
            >
              <img
                ref={imgRef}
                src={previewUrl}
                alt="crop"
                className="max-w-full rounded-lg"
                style={{ maxWidth: 640, display: "block" }}
                draggable={false}
              />

              {step === "edit" && crop.w > 0 && (
                <>
                  {/* 暗色遮罩（图片外部） */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* 上 */}
                    <div className="absolute bg-black/40" style={{ top: 0, left: 0, right: 0, height: imgPxToCss(crop.y, "y") }} />
                    {/* 下 */}
                    <div className="absolute bg-black/40" style={{ bottom: 0, left: 0, right: 0, height: `calc(100% - ${imgPxToCss(crop.y + crop.h, "y")}px)` }} />
                    {/* 左 */}
                    <div className="absolute bg-black/40" style={{ top: imgPxToCss(crop.y, "y"), left: 0, width: imgPxToCss(crop.x, "x"), height: imgPxToCss(crop.h, "y") }} />
                    {/* 右 */}
                    <div className="absolute bg-black/40" style={{ top: imgPxToCss(crop.y, "y"), right: 0, width: `calc(100% - ${imgPxToCss(crop.x + crop.w, "x")}px)`, height: imgPxToCss(crop.h, "y") }} />
                  </div>

                  {/* 选区边框 */}
                  <div
                    className="absolute border-2 border-brand-400 pointer-events-none"
                    style={cropStyle()}
                  >
                    {/* 网格线 */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-1/3 left-0 right-0 h-px bg-white/50" />
                      <div className="absolute top-2/3 left-0 right-0 h-px bg-white/50" />
                      <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/50" />
                      <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/50" />
                    </div>
                  </div>

                  {/* 调整手柄 */}
                  {handlePositions.map((h) => (
                    <div
                      key={h.key}
                      className="absolute bg-white border-2 border-brand-500 rounded-sm z-10"
                      style={{
                        ...h.style,
                        width: HANDLE_SIZE,
                        height: HANDLE_SIZE,
                      }}
                    />
                  ))}
                </>
              )}
            </div>

            <p className="mt-3 text-xs text-zinc-500">
              {t("img_crop.crop_info")
                .replace("{w}", String(Math.round(crop.w)))
                .replace("{h}", String(Math.round(crop.h)))
                .replace("{x}", String(Math.round(crop.x)))
                .replace("{y}", String(Math.round(crop.y)))
                .replace("{ow}", String(imgSize.w))
                .replace("{oh}", String(imgSize.h))}
            </p>

            <div className="mt-4 flex gap-3">
              <button onClick={applyCrop} className="btn-primary">{t("img_crop.btn_crop")}</button>
              <button onClick={reset} className="btn-secondary">{t("common.reupload")}</button>
            </div>
          </div>

          {step === "done" && resultUrl && (
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("img_crop.result_title")}</h3>
              <img src={resultUrl} alt="cropped" className="max-h-64 w-auto rounded-lg mb-4" />
              <div className="flex gap-3">
                <button onClick={download} className="btn-primary">{t("img_crop.download_result")}</button>
                <button onClick={continueCrop} className="btn-secondary">{t("img_crop.btn_continue")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
