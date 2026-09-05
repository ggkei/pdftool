"use client";

import { useState, useRef, useCallback } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";
import * as bodyPix from "@tensorflow-models/body-pix";

type Step = "upload" | "adjust" | "processing" | "result";
type ModelStatus = "idle" | "loading" | "ready" | "error";

interface PhotoSpec {
  name: string;
  width: number;
  height: number;
  desc: string;
  dpi: string;
}

const PHOTO_SPECS: PhotoSpec[] = [
  { name: t("img_id_photo.spec_1inch"), width: 295, height: 413, desc: "25x35mm", dpi: "300dpi" },
  { name: t("img_id_photo.spec_2inch"), width: 413, height: 579, desc: "35x49mm", dpi: "300dpi" },
  { name: t("img_id_photo.spec_1inch"), width: 260, height: 378, desc: "22x32mm", dpi: "300dpi" },
  { name: t("img_id_photo.spec_2inch"), width: 413, height: 531, desc: "35x45mm", dpi: "300dpi" },
  { name: t("img_id_photo.spec_1inch"), width: 390, height: 567, desc: "33x48mm", dpi: "300dpi" },
  { name: t("img_id_photo.spec_2inch"), width: 413, height: 626, desc: "35x53mm", dpi: "300dpi" },
  { name: t("img_id_photo.spec_passport"), width: 390, height: 567, desc: "33x48mm", dpi: "300dpi" },
  { name: t("img_id_photo.spec_visa"), width: 413, height: 626, desc: "35x53mm", dpi: "300dpi" },
  { name: t("img_id_photo.spec_license"), width: 358, height: 441, desc: "30x37mm", dpi: "300dpi" },
  { name: t("img_id_photo.spec_student"), width: 295, height: 413, desc: "25x35mm", dpi: "300dpi" },
];

const BG_COLORS = [
  { name: t("img_id_photo.bg_blue"), color: "#438EDB" },
  { name: t("img_id_photo.bg_white"), color: "#FFFFFF" },
  { name: t("img_id_photo.bg_red"), color: "#D9001B" },
  { name: t("img_id_photo.bg_light_blue"), color: "#A0D8F1" },
  { name: t("img_id_photo.bg_gray"), color: "#B0B0B0" },
  { name: t("img_id_photo.bg_gradient_blue"), color: "gradient-blue" },
  { name: t("img_id_photo.bg_gradient_red"), color: "gradient-red" },
];

interface QualityCheck {
  label: string;
  passed: boolean;
  message: string;
}

export default function ImageIdPhotoPage() {
  const [step, setStep] = useState<Step>("upload");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [printUrl, setPrintUrl] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [selectedSpec, setSelectedSpec] = useState(0);
  const [bgColor, setBgColor] = useState("#438EDB");
  const [customColor, setCustomColor] = useState("#438EDB");
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [progress, setProgress] = useState("");
  const [beautyLevel, setBeautyLevel] = useState(0);
  const [whitenLevel, setWhitenLevel] = useState(0);
  const [adjustX, setAdjustX] = useState(0);
  const [adjustY, setAdjustY] = useState(0);
  const [adjustScale, setAdjustScale] = useState(1);
  const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const printCanvasRef = useRef<HTMLCanvasElement>(null);
  const netRef = useRef<bodyPix.BodyPix | null>(null);
  const maskDataRef = useRef<Uint8Array | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const imgDimsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const effectiveColor = useCustomColor ? customColor : bgColor;

  const loadModel = useCallback(async () => {
    if (netRef.current || modelStatus === "loading") return;
    setModelStatus("loading");
    try {
      setProgress(t("img_id_photo.model_loading"));
      const net = await bodyPix.load();
      netRef.current = net;
      setModelStatus("ready");
      setProgress("");
    } catch {
      setModelStatus("error");
      setProgress(t("img_id_photo.model_failed"));
    }
  }, [modelStatus]);

  const checkPhotoQuality = useCallback(
    (img: HTMLImageElement): QualityCheck[] => {
      const checks: QualityCheck[] = [];
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // Resolution check
      const minDim = Math.min(w, h);
      checks.push({
        label: t("img_id_photo.quality_resolution"),
        passed: minDim >= 300,
        message:
          minDim >= 600
            ? t("img_id_photo.res_high", { w, h })
            : minDim >= 300
            ? t("img_id_photo.res_ok", { w, h })
            : t("img_id_photo.res_low", { w, h }),
      });

      // Aspect ratio check (portrait preferred)
      const ratio = h / w;
      checks.push({
        label: t("img_id_photo.quality_ratio"),
        passed: ratio >= 1.2 && ratio <= 2.5,
        message:
          ratio >= 1.2 && ratio <= 2.5
            ? t("img_id_photo.ratio_ok")
            : ratio < 1.2
            ? t("img_id_photo.ratio_wide")
            : t("img_id_photo.ratio_tall"),
      });

      // File size check
      const fileSizeKB = originalFile ? originalFile.size / 1024 : 0;
      checks.push({
        label: t("img_id_photo.quality_filesize"),
        passed: fileSizeKB >= 50 && fileSizeKB <= 10240,
        message:
          fileSizeKB < 50
            ? t("img_id_photo.size_small", { size: Math.round(fileSizeKB) })
            : fileSizeKB > 10240
            ? t("img_id_photo.size_large", { size: Math.round(fileSizeKB / 1024) })
            : t("img_id_photo.size_ok", { size: Math.round(fileSizeKB) }),
      });

      // Brightness check (simple sampling)
      const canvas = document.createElement("canvas");
      const sampleSize = 100;
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }
        const avgBrightness = sum / (data.length / 4);
        checks.push({
          label: t("img_id_photo.quality_brightness"),
          passed: avgBrightness >= 60 && avgBrightness <= 200,
          message:
            avgBrightness < 60
              ? t("img_id_photo.bright_dark")
              : avgBrightness > 200
              ? t("img_id_photo.bright_bright")
              : t("img_id_photo.bright_ok"),
        });
      }

      return checks;
    },
    [originalFile]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError(t("img_id_photo.error_not_image"));
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError(t("img_id_photo.error_too_large"));
        return;
      }
      setError("");
      setOriginalFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setResultUrl("");
      setPrintUrl("");
      setStep("upload");
      maskDataRef.current = null;

      // Load image to check quality
      const img = new Image();
      img.onload = () => {
        const checks = checkPhotoQuality(img);
        setQualityChecks(checks);
      };
      img.src = url;
    },
    [checkPhotoQuality]
  );

  const performMatting = useCallback(async () => {
    if (!originalFile || !previewUrl) return;

    if (!netRef.current) {
      await loadModel();
      if (!netRef.current) return;
    }

    setStep("processing");
    setProgress(t("img_id_photo.processing"));

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        imgRef.current = img;
        imgDimsRef.current = { w: img.naturalWidth, h: img.naturalHeight };

        try {
          const segmentation = await netRef.current!.segmentPerson(img, {
            flipHorizontal: false,
            internalResolution: "medium",
            segmentationThreshold: 0.7,
            maxDetections: 5,
            scoreThreshold: 0.3,
            nmsRadius: 20,
          });

          maskDataRef.current = segmentation.data;

          // Check if person detected
          let personPixels = 0;
          for (let i = 0; i < segmentation.data.length; i++) {
            if (segmentation.data[i] === 1) personPixels++;
          }

          if (personPixels < 100) {
            setError(t("img_id_photo.error_no_person"));
            setStep("upload");
            setProgress("");
            return;
          }

          setStep("adjust");
          setProgress("");
        } catch (e) {
          setError(
            t("img_id_photo.error_matting", { error: e instanceof Error ? e.message : "unknown error" })
          );
          setStep("upload");
          setProgress("");
        }
      };
      img.onerror = () => {
        setError(t("img_id_photo.error_image_load"));
        setStep("upload");
        setProgress("");
      };
      img.src = previewUrl;
    } catch (e) {
      setError(
        t("img_id_photo.error_processing", { error: e instanceof Error ? e.message : "unknown error" })
      );
      setStep("upload");
      setProgress("");
    }
  }, [originalFile, previewUrl, loadModel]);

  const generatePhoto = useCallback(async () => {
    if (!imgRef.current || !maskDataRef.current) return;

    setStep("processing");
    setProgress(t("img_id_photo.processing"));

    try {
      const img = imgRef.current;
      const imgW = imgDimsRef.current.w;
      const imgH = imgDimsRef.current.h;
      const mask = maskDataRef.current;

      // Find person bounding box
      let minX = imgW,
        minY = imgH,
        maxX = 0,
        maxY = 0;
      for (let y = 0; y < imgH; y++) {
        for (let x = 0; x < imgW; x++) {
          if (mask[y * imgW + x] === 1) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      const personW = maxX - minX;
      const personH = maxY - minY;

      // Create masked temp canvas
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = imgW;
      tempCanvas.height = imgH;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      tempCtx.drawImage(img, 0, 0, imgW, imgH);
      const imageData = tempCtx.getImageData(0, 0, imgW, imgH);
      const data = imageData.data;

      // Apply mask with edge feathering
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] === 0) {
          data[i * 4 + 3] = 0;
        }
      }
      tempCtx.putImageData(imageData, 0, 0);

      // Apply beauty filter if requested
      if (beautyLevel > 0 || whitenLevel > 0) {
        setProgress(t("img_id_photo.processing"));
        const beautyCanvas = document.createElement("canvas");
        beautyCanvas.width = imgW;
        beautyCanvas.height = imgH;
        const beautyCtx = beautyCanvas.getContext("2d");
        if (!beautyCtx) return;
        beautyCtx.drawImage(tempCanvas, 0, 0);
        const bData = beautyCtx.getImageData(0, 0, imgW, imgH);
        const bd = bData.data;

        if (beautyLevel > 0) {
          // Simple skin smoothing: neighbor average
          const radius = Math.round(beautyLevel / 25) + 1;
          const original = new Uint8ClampedArray(bd);
          for (let y = radius; y < imgH - radius; y++) {
            for (let x = radius; x < imgW - radius; x++) {
              const idx = (y * imgW + x) * 4;
              // Only smooth if pixel is part of person (alpha > 0)
              if (original[idx + 3] === 0) continue;
              let r = 0,
                g = 0,
                b = 0,
                count = 0;
              for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                  const nIdx = ((y + dy) * imgW + (x + dx)) * 4;
                  if (original[nIdx + 3] > 0) {
                    r += original[nIdx];
                    g += original[nIdx + 1];
                    b += original[nIdx + 2];
                    count++;
                  }
                }
              }
              if (count > 0) {
                const blend = beautyLevel / 100;
                bd[idx] = Math.round(r / count * blend + original[idx] * (1 - blend));
                bd[idx + 1] = Math.round(g / count * blend + original[idx + 1] * (1 - blend));
                bd[idx + 2] = Math.round(b / count * blend + original[idx + 2] * (1 - blend));
              }
            }
          }
        }

        if (whitenLevel > 0) {
          // Whiten: increase brightness of skin-tone pixels
          const wBlend = whitenLevel / 100;
          for (let i = 0; i < bd.length; i += 4) {
            if (bd[i + 3] === 0) continue;
            const r = bd[i],
              g = bd[i + 1],
              b = bd[i + 2];
            // Simple skin detection: R > G > B and R < 250
            if (r > g && g > b && r < 250) {
              bd[i] = Math.min(255, Math.round(r + (255 - r) * wBlend * 0.3));
              bd[i + 1] = Math.min(255, Math.round(g + (255 - g) * wBlend * 0.3));
              bd[i + 2] = Math.min(255, Math.round(b + (255 - b) * wBlend * 0.3));
            }
          }
        }

        beautyCtx.putImageData(bData, 0, 0);
        tempCtx.clearRect(0, 0, imgW, imgH);
        tempCtx.drawImage(beautyCanvas, 0, 0);
      }

      // Compose final photo
      setProgress(t("img_id_photo.processing"));
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const spec = PHOTO_SPECS[selectedSpec];
      canvas.width = spec.width;
      canvas.height = spec.height;

      // Fill background
      if (effectiveColor === "gradient-blue") {
        const grad = ctx.createLinearGradient(0, 0, spec.width, spec.height);
        grad.addColorStop(0, "#5BA3E8");
        grad.addColorStop(1, "#2E6BB8");
        ctx.fillStyle = grad;
      } else if (effectiveColor === "gradient-red") {
        const grad = ctx.createLinearGradient(0, 0, spec.width, spec.height);
        grad.addColorStop(0, "#E84A4A");
        grad.addColorStop(1, "#B81E1E");
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = effectiveColor;
      }
      ctx.fillRect(0, 0, spec.width, spec.height);

      // Scale and position person
      const targetH = spec.height * 0.78 * adjustScale;
      const scale = targetH / personH;
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const baseOffsetX = (spec.width - drawW) / 2;
      const baseOffsetY = spec.height * 0.08;
      const offsetX = baseOffsetX + adjustX;
      const offsetY = baseOffsetY + adjustY;

      ctx.drawImage(tempCanvas, 0, 0, imgW, imgH, offsetX, offsetY, drawW, drawH);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setResultUrl(url);
            setStep("result");
            setProgress("");
          }
        },
        "image/jpeg",
        0.95
      );
    } catch (e) {
      setError(
        `generation failed: ${e instanceof Error ? e.message : "unknown error"}`
      );
      setStep("adjust");
      setProgress("");
    }
  }, [selectedSpec, effectiveColor, beautyLevel, whitenLevel, adjustX, adjustY, adjustScale]);

  const generatePrintLayout = useCallback(() => {
    if (!resultUrl) return;

    const spec = PHOTO_SPECS[selectedSpec];
    const canvas = printCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // A4 at 300dpi: 2480x3508
    const a4W = 2480;
    const a4H = 3508;
    canvas.width = a4W;
    canvas.height = a4H;

    // White background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, a4W, a4H);

    const img = new Image();
    img.onload = () => {
      const margin = 100; // margin in px
      const gap = 20; // gap between photos
      const photoW = spec.width;
      const photoH = spec.height;

      const cols = Math.floor((a4W - 2 * margin + gap) / (photoW + gap));
      const rows = Math.floor((a4H - 2 * margin + gap) / (photoH + gap));

      let count = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = margin + col * (photoW + gap);
          const y = margin + row * (photoH + gap);
          ctx.drawImage(img, x, y, photoW, photoH);
          count++;
        }
      }

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setPrintUrl(url);
          }
        },
        "image/jpeg",
        0.92
      );
    };
    img.src = resultUrl;
  }, [resultUrl, selectedSpec]);

  const download = (url: string, name: string) => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    if (printUrl) URL.revokeObjectURL(printUrl);
    setStep("upload");
    setOriginalFile(null);
    setPreviewUrl("");
    setResultUrl("");
    setPrintUrl("");
    setError("");
    setProgress("");
    setQualityChecks([]);
    setAdjustX(0);
    setAdjustY(0);
    setAdjustScale(1);
    maskDataRef.current = null;
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

  const tool = getToolById("image-id-photo")!;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
        <p className="text-sm text-emerald-800">
          <strong>{t("img_id_photo.privacy_title")}:</strong> {t("img_id_photo.privacy_desc")}
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {/* Model status */}
        {modelStatus !== "ready" && (originalFile || step === "processing") && (
          <div
            className={`rounded-xl p-4 ${
              modelStatus === "error"
                ? "bg-red-50 border border-red-200"
                : modelStatus === "loading"
                ? "bg-amber-50 border border-amber-200"
                : "bg-slate-50 border border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${
                  modelStatus === "error"
                    ? "bg-red-500"
                    : modelStatus === "loading"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-slate-300"
                }`}
              />
              <span className="text-sm text-zinc-600">
                {modelStatus === "loading"
                  ? t("img_id_photo.model_loading")
                  : modelStatus === "error"
                  ? t("img_id_photo.model_failed")
                  : t("img_id_photo.model_idle")}
              </span>
              {modelStatus === "idle" && (
                <button
                  onClick={loadModel}
                  className="text-xs text-brand-600 hover:text-brand-700"
                >
                  {t("img_id_photo.load_now")}
                </button>
              )}
              {modelStatus === "error" && (
                <button
                  onClick={loadModel}
                  className="text-xs text-brand-600 hover:text-brand-700"
                >
                  {t("img_id_photo.retry")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Upload step */}
        {step === "upload" && !originalFile && (
          <div
            className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
              dragOver
                ? "border-brand-400 bg-brand-50"
                : "border-slate-300 bg-white/60"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="mb-4 text-5xl">&#128247;</div>
            <p className="mb-2 text-sm font-medium text-zinc-700">
              {t("img_id_photo.upload_title")}
            </p>
            <p className="mb-6 text-xs text-zinc-400">
              {t("img_id_photo.upload_desc")}
            </p>
            <button
              onClick={() => inputRef.current?.click()}
              className="btn-primary"
            >
              {t("img_id_photo.select_photo")}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          </div>
        )}

        {/* Quality checks + preview */}
        {originalFile && (step === "upload" || step === "adjust") && (
          <div className="space-y-4">
            {previewUrl && (
              <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
                <img
                  src={previewUrl}
                  alt="preview"
                  className="max-h-64 w-auto rounded-lg mx-auto"
                />
              </div>
            )}

            {/* Quality checks */}
            {qualityChecks.length > 0 && step === "upload" && (
              <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
                <h3 className="text-sm font-semibold text-zinc-700 mb-3">
                  {t("img_id_photo.quality_check")}
                </h3>
                <div className="space-y-2">
                  {qualityChecks.map((qc) => (
                    <div key={qc.label} className="flex items-center gap-2 text-sm">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          qc.passed ? "bg-green-500" : "bg-amber-500"
                        }`}
                      />
                      <span className="text-zinc-500 w-24">{qc.label}</span>
                      <span
                        className={
                          qc.passed ? "text-zinc-600" : "text-amber-600"
                        }
                      >
                        {qc.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings */}
            {step === "upload" && (
              <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
                <h3 className="text-sm font-semibold text-zinc-700 mb-4">
                  {t("img_id_photo.photo_size")}
                </h3>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-6">
                  {PHOTO_SPECS.map((spec, i) => (
                    <button
                      key={spec.name}
                      onClick={() => setSelectedSpec(i)}
                      className={`rounded-xl border-2 py-3 text-center transition-all ${
                        selectedSpec === i
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-slate-200 bg-white text-zinc-600 hover:border-slate-300"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {spec.name}
                      </span>
                      <span className="block text-xs text-zinc-400">
                        {spec.desc}
                      </span>
                    </button>
                  ))}
                </div>

                <h3 className="text-sm font-semibold text-zinc-700 mb-3">
                  {t("img_id_photo.bg_color")}
                </h3>
                <div className="flex flex-wrap gap-3 mb-4">
                  {BG_COLORS.map((bg) => (
                    <button
                      key={bg.color}
                      onClick={() => {
                        setBgColor(bg.color);
                        setUseCustomColor(false);
                      }}
                      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 transition-all ${
                        !useCustomColor && bgColor === bg.color
                          ? "border-brand-500"
                          : "border-slate-200"
                      }`}
                    >
                      {bg.color.startsWith("gradient") ? (
                        <span
                          className="h-6 w-6 rounded border border-slate-300"
                          style={{
                            background:
                              bg.color === "gradient-blue"
                                ? "linear-gradient(135deg,#5BA3E8,#2E6BB8)"
                                : "linear-gradient(135deg,#E84A4A,#B81E1E)",
                          }}
                        />
                      ) : (
                        <span
                          className="h-6 w-6 rounded border border-slate-300"
                          style={{ background: bg.color }}
                        />
                      )}
                      <span className="text-sm text-zinc-600">{bg.name}</span>
                    </button>
                  ))}
                </div>

                {/* Custom color */}
                <div className="flex items-center gap-3 mb-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomColor}
                      onChange={(e) => setUseCustomColor(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-zinc-600">{t("img_id_photo.custom_color")}</span>
                  </label>
                  {useCustomColor && (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="h-8 w-12 rounded border border-slate-300"
                      />
                      <span className="text-xs text-zinc-400 font-mono">
                        {customColor}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={performMatting} className="btn-primary">
                    {modelStatus === "ready"
                      ? t("img_id_photo.ai_cutout")
                      : t("img_id_photo.load_model_generate")}
                  </button>
                  <button onClick={reset} className="btn-secondary">
                    {t("img_id_photo.reupload")}
                  </button>
                </div>
              </div>
            )}

            {/* Adjust step */}
            {step === "adjust" && (
              <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
                <h3 className="text-sm font-semibold text-zinc-700 mb-4">
                  {t("img_id_photo.adjust_title")}
                </h3>

                {/* Beauty controls */}
                <div className="space-y-3 mb-6">
                  <div>
                    <label className="text-xs text-zinc-500 flex justify-between">
                      <span>{t("img_id_photo.skin_smooth")}</span>
                      <span>{beautyLevel}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={beautyLevel}
                      onChange={(e) => setBeautyLevel(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 flex justify-between">
                      <span>{t("img_id_photo.skin_whiten")}</span>
                      <span>{whitenLevel}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={whitenLevel}
                      onChange={(e) => setWhitenLevel(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Position controls */}
                <div className="space-y-3 mb-6">
                  <div>
                    <label className="text-xs text-zinc-500 flex justify-between">
                      <span>{t("img_id_photo.h_offset")}</span>
                      <span>{adjustX}px</span>
                    </label>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={adjustX}
                      onChange={(e) => setAdjustX(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 flex justify-between">
                      <span>{t("img_id_photo.v_offset")}</span>
                      <span>{adjustY}px</span>
                    </label>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={adjustY}
                      onChange={(e) => setAdjustY(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 flex justify-between">
                      <span>{t("img_id_photo.scale")}</span>
                      <span>{Math.round(adjustScale * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.05"
                      value={adjustScale}
                      onChange={(e) => setAdjustScale(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={generatePhoto} className="btn-primary">
                    {t("img_id_photo.generate_photo")}
                  </button>
                  <button
                    onClick={() => setStep("upload")}
                    className="btn-secondary"
                  >
                    {t("img_id_photo.back_to_settings")}
                  </button>
                  <button onClick={reset} className="btn-secondary">
                    {t("img_id_photo.reupload")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Processing */}
        {step === "processing" && (
          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-12 text-center">
            <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
            <p className="text-sm text-zinc-600">{progress || t("img_id_photo.processing")}</p>
          </div>
        )}

        {/* Result */}
        {step === "result" && resultUrl && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-4">
                {t("img_id_photo.result_title")} - {PHOTO_SPECS[selectedSpec].name} (
                {PHOTO_SPECS[selectedSpec].width}x{PHOTO_SPECS[selectedSpec].height}
                px, {PHOTO_SPECS[selectedSpec].dpi})
              </h3>
              <div className="flex justify-center mb-4">
                <img
                  src={resultUrl}
                  alt="ID photo"
                  style={{
                    width: PHOTO_SPECS[selectedSpec].width * 0.5,
                    height: PHOTO_SPECS[selectedSpec].height * 0.5,
                  }}
                  className="rounded-lg border-2 border-slate-200"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    download(
                      resultUrl,
                      `${originalFile?.name.replace(/\.[^.]+$/, "")}_id_photo.jpg`
                    )
                  }
                  className="btn-primary"
                >
                  {t("img_id_photo.download_photo")}
                </button>
                <button
                  onClick={generatePrintLayout}
                  className="btn-secondary"
                >
                  {t("img_id_photo.generate_a4")}
                </button>
                <button
                  onClick={() => setStep("adjust")}
                  className="btn-secondary"
                >
                  {t("img_id_photo.readjust")}
                </button>
                <button onClick={reset} className="btn-secondary">
                  {t("img_id_photo.new_photo")}
                </button>
              </div>
            </div>

            {/* A4 print layout */}
            {printUrl && (
              <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
                <h3 className="text-sm font-semibold text-zinc-700 mb-4">
                  {t("img_id_photo.a4_layout")}
                </h3>
                <div className="flex justify-center mb-4">
                  <img
                    src={printUrl}
                    alt={t("img_id_photo.a4_layout")}
                    className="max-h-96 w-auto rounded-lg border-2 border-slate-200"
                  />
                </div>
                <button
                  onClick={() =>
                    download(
                      printUrl,
                      `${originalFile?.name.replace(/\.[^.]+$/, "")}_a4_print.jpg`
                    )
                  }
                  className="btn-primary"
                >
                  {t("img_id_photo.download_a4")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={printCanvasRef} className="hidden" />
    </main>
  );
}
