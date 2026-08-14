"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { FileDropZone } from "@/components/FileDropZone";
import { useFileGuard } from "@/hooks/useFileGuard";
import { FileGuardModal } from "@/components/FileGuardModal";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

interface ImageRow {
  ref: string;
  name: string;
  width: number;
  height: number;
  colorSpace: string;
  hasAlpha: boolean;
  score?: number;
  reason?: string;
  selected: boolean;
  previewUrl?: string;
  kind: "image" | "form";
  transform?: number[];
  subtype?: string;
  formTextPreview?: string;
  nestedImagePreviews?: { name: string; url: string }[];
}

interface PageData {
  pageIndex: number;
  pageRef: string;
  images: ImageRow[];
}

type Step = "upload" | "analyzing" | "select" | "processing" | "done";

export default function PdfRemoveWatermarkPage() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<{
    outputBytes: Uint8Array;
    removedCount: number;
    pageCount: number;
  } | null>(null);
  const [dumpResult, setDumpResult] = useState<any>(null);
  const isDumpMode = useMemo(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("dump"),
    []
  );
  const guard = useFileGuard("remove-watermark");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingMb, setPendingMb] = useState(0);

  useEffect(() => {
    return () => {
      // Clean up object URLs
      for (const p of pages) {
        for (const img of p.images) {
          if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
        }
      }
    };
  }, [pages]);

  const handleFileSelect = useCallback(async (file: File) => {
    const level = guard.check(file.size);
    if (level !== "free") {
      setPendingFile(file);
      setPendingMb(file.size / 1024 / 1024);
      if (level === "verify") guard.requestVerify();
      else guard.requestMembership();
      return;
    }
    setError("");
    setResult(null);
    setFileName(file.name);

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("请选择 PDF 文件");
      return;
    }

    setStep("analyzing");

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setFileBytes(bytes);

      const [{ analyzePdf }, dumpMod] = await Promise.all([
        import("@/lib/pdf"),
        import("@/lib/pdf/dumpPdf"),
      ]);

      let dumpOut: any = null;
      try {
        dumpOut = await dumpMod.dumpPdf(bytes);
        (globalThis as any).__pdfDump = dumpOut;
        if (isDumpMode) setDumpResult(dumpOut);
      } catch (e) {
        dumpOut = { error: String(e) };
        (globalThis as any).__pdfDump = dumpOut;
      }

      const analyzedPages = await analyzePdf(bytes);

      // Attach preview URLs from dump
      const previewMap = new Map<string, string>();
      const formInfoMap = new Map<string, { text?: string; nested: { name: string; url: string }[] }>();

      const walkNested = (xos: any[] | undefined, acc: { name: string; url: string }[]) => {
        if (!xos) return;
        for (const xo of xos) {
          if (xo.imageBytes) {
            const blob = new Blob([xo.imageBytes as any], { type: xo.imageMime || "image/png" });
            acc.push({ name: xo.name, url: URL.createObjectURL(blob) });
          }
          walkNested(xo.formNestedXObjects, acc);
        }
      };

      if (dumpOut && dumpOut.pages) {
        for (const pg of dumpOut.pages) {
          for (const xo of pg.xobjects) {
            if (xo.imageBytes) {
              const blob = new Blob([xo.imageBytes as any], { type: xo.imageMime || "image/png" });
              const url = URL.createObjectURL(blob);
              previewMap.set(`${pg.pageIndex}:${xo.name}`, url);
            }
            if (xo.subtype === "Form") {
              const nested: { name: string; url: string }[] = [];
              walkNested(xo.formNestedXObjects, nested);
              formInfoMap.set(`${pg.pageIndex}:${xo.name}`, {
                text: xo.formTextPreview,
                nested,
              });
            }
          }
        }
      }

      const pageData: PageData[] = analyzedPages.map((page) => ({
        pageIndex: page.pageIndex,
        pageRef: page.pageRef,
        images: page.images.map((img) => {
          const candidate = page.watermarkCandidates.find(
            (c) => c.image.ref === img.ref
          );
          const previewUrl = previewMap.get(`${page.pageIndex}:${img.name}`);
          const formInfo = formInfoMap.get(`${page.pageIndex}:${img.name}`);
          return {
            ref: img.ref,
            name: img.name,
            width: img.width,
            height: img.height,
            colorSpace: img.colorSpace,
            hasAlpha: img.hasAlpha,
            score: candidate?.score,
            reason: candidate?.reason,
            selected: (candidate?.score ?? 0) >= 0.5,
            previewUrl,
            kind: img.kind,
            transform: img.transform,
            subtype: img.subtype,
            formTextPreview: formInfo?.text,
            nestedImagePreviews: formInfo?.nested,
          };
        }),
      }));

      setPages(pageData);

      const totalImages = pageData.reduce((sum, p) => sum + p.images.length, 0);
      if (totalImages === 0) {
        setError("未在 PDF 中检测到图片对象。该文件可能不包含可识别的图片水印。");
      }

      setStep("select");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? `解析失败: ${err.message}`
          : "解析 PDF 时发生未知错误"
      );
      setStep("upload");
    }
  }, [isDumpMode]);

  const retryHandleRef = useRef<typeof handleFileSelect | null>(null);
  retryHandleRef.current = handleFileSelect;

  useEffect(() => {
    if (!guard.level && pendingFile && retryHandleRef.current) {
      const f = pendingFile;
      setPendingFile(null);
      retryHandleRef.current(f);
    }
  }, [guard.level, pendingFile]);

  useEffect(() => {
    (globalThis as any).__debugUpload = handleFileSelect;
  }, [handleFileSelect]);

  const toggleImage = useCallback(
    (pageIdx: number, ref: string) => {
      setPages((prev) =>
        prev.map((p) => {
          if (p.pageIndex !== pageIdx) return p;
          return {
            ...p,
            images: p.images.map((img) =>
              img.ref === ref ? { ...img, selected: !img.selected } : img
            ),
          };
        })
      );
    },
    []
  );

  const toggleAll = useCallback((selected: boolean) => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        images: p.images.map((img) => ({ ...img, selected })),
      }))
    );
  }, []);

  const allSelectedRefs = useMemo(() => {
    const refs: string[] = [];
    for (const page of pages) {
      for (const img of page.images) {
        if (img.selected) refs.push(`${page.pageIndex}:${img.name}`);
      }
    }
    return refs;
  }, [pages]);

  const selectedCount = useMemo(
    () => pages.reduce((sum, p) => sum + p.images.filter((i) => i.selected).length, 0),
    [pages]
  );

  const handleProcess = useCallback(async () => {
    if (!fileBytes) return;
    setStep("processing");
    setError("");

    try {
      const { removeWatermark } = await import("@/lib/pdf");
      const res = await removeWatermark(fileBytes, {
        selectedImageRefs: allSelectedRefs,
      });

      setResult({
        outputBytes: res.outputBytes,
        removedCount: res.removedCount,
        pageCount: res.pageCount,
      });
      setStep("done");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? `处理失败: ${err.message}`
          : "处理水印时发生未知错误"
      );
      setStep("select");
    }
  }, [fileBytes, allSelectedRefs]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.outputBytes as any], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/\.pdf$/i, "_无水印.pdf");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result, fileName]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setFileName("");
    setFileBytes(null);
    setPages([]);
    setError("");
    setResult(null);
    setDumpResult(null);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <ToolHeader
        title="PDF 去水印"
        description="智能识别 PDF 中的图片水印并删除，适用于扫描全能王、夸克扫描王等生成的 PDF"
      />

      {step === "upload" && (
        <FileDropZone onFileSelect={handleFileSelect} />
      )}

      {step === "analyzing" && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-12">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          <p className="text-lg font-medium text-slate-700">正在解析 PDF 文件...</p>
          <p className="mt-2 text-sm text-slate-500">{fileName}</p>
        </div>
      )}

      {step === "select" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">选择要删除的水印</h2>
                <p className="text-sm text-slate-500">
                  文件：{fileName} · 共 {pages.length} 页 · 已选择 {selectedCount} 张图片
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleAll(true)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  全选
                </button>
                <button
                  onClick={() => toggleAll(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  全不选
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                ⚠️ {error}
              </div>
            )}

            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
              {pages.map((page) => (
                <div
                  key={page.pageIndex}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">
                    第 {page.pageIndex + 1} 页
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      ({page.images.length} 张图片)
                    </span>
                  </h3>

                  {page.images.length === 0 ? (
                    <p className="text-sm text-slate-400">未检测到图片</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {page.images.map((img) => (
                        <ImageCard
                          key={img.ref}
                          image={img}
                          onToggle={() => toggleImage(page.pageIndex, img.ref)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={handleReset}
              className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-slate-700 hover:bg-slate-50"
            >
              重新上传
            </button>
            <button
              onClick={handleProcess}
              disabled={selectedCount === 0}
              className="rounded-lg bg-primary-600 px-8 py-3 font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              开始处理（删除 {selectedCount} 张图片）
            </button>
          </div>

          {isDumpMode && dumpResult && (
            <DumpPanel dump={dumpResult} />
          )}
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-12">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          <p className="text-lg font-medium text-slate-700">正在处理中...</p>
          <p className="mt-2 text-sm text-slate-500">请稍候</p>
        </div>
      )}

      {step === "done" && result && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-slate-900">处理完成！</h2>
          <p className="mb-6 text-slate-600">
            共处理 {result.pageCount} 页，删除了 {result.removedCount} 处图片引用
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={handleReset}
              className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-slate-700 hover:bg-slate-50"
            >
              处理新文件
            </button>
            <button
              onClick={handleDownload}
              className="rounded-lg bg-primary-600 px-8 py-3 font-medium text-white hover:bg-primary-700"
            >
              下载 PDF
            </button>
          </div>
        </div>
      )}

      {guard.level && (
        <FileGuardModal
          mode={guard.level as "verify" | "membership"}
          fileSizeMB={pendingMb}
          verifyMb={guard.config?.verify.mb ?? 8}
          membershipMb={guard.toolThresholds?.membershipMb ?? guard.config?.membership.mb ?? 20}
          onClose={() => { setPendingFile(null); setPendingMb(0); guard.clearModal(); }}
          onVerified={(k) => guard.onVerified(k)}
        />
      )}
            <ToolUsage tool={getToolById("remove-watermark")!} />
</main>
  );
}

function ImageCard({
  image,
  onToggle,
}: {
  image: ImageRow;
  onToggle: () => void;
}) {
  const suspicious = (image.score ?? 0) >= 0.5;
  const isForm = image.kind === "form";
  const isSheared = image.transform && (Math.abs(image.transform[1] || 0) > 0.01 || Math.abs(image.transform[2] || 0) > 0.01);

  return (
    <label
      className={`group relative flex cursor-pointer flex-col rounded-lg border transition-all ${
        image.selected
          ? "border-primary-400 bg-primary-50 ring-1 ring-primary-400"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <input
          type="checkbox"
          checked={image.selected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        />
        <span className="truncate font-mono text-xs text-slate-700" title={image.name}>
          {image.name}
        </span>
        <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium ${
          isForm ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
        }`}>
          {isForm ? "Form" : "Image"}
        </span>
      </div>
      <div className="flex min-h-[8rem] items-center justify-center bg-slate-50 p-2">
        {image.previewUrl ? (
          <img
            src={image.previewUrl}
            alt={image.name}
            className="max-h-full max-w-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        ) : isForm ? (
          image.nestedImagePreviews && image.nestedImagePreviews.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-1">
              {image.nestedImagePreviews.map((n, i) => (
                <img
                  key={i}
                  src={n.url}
                  alt={n.name}
                  title={n.name}
                  className="max-h-16 max-w-16 rounded border border-slate-200 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              ))}
            </div>
          ) : image.formTextPreview ? (
            <div className="text-center">
              <div className="mb-1 text-xl">📝</div>
              <div className="truncate text-xs font-medium text-indigo-700 max-w-full" title={image.formTextPreview}>
                {image.formTextPreview}
              </div>
            </div>
          ) : (
            <div className="text-center text-xs text-indigo-500">
              <div className="mb-1 text-2xl">📦</div>
              Form 对象
            </div>
          )
        ) : (
          <div className="text-center text-xs text-slate-400">
            <div className="mb-1 text-2xl">🖼️</div>
            无法预览
          </div>
        )}
      </div>
      <div className="px-3 py-2 text-xs text-slate-500">
        <div className="flex items-center gap-1.5 flex-wrap">
          {image.width > 0 && image.height > 0 && (
            <span>{image.width}×{image.height}</span>
          )}
          {image.hasAlpha && (
            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700">Alpha</span>
          )}
          {suspicious && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
              {(image.score! * 100).toFixed(0)}%
            </span>
          )}
          {isSheared && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">
              倾斜
            </span>
          )}
        </div>
        {image.transform && (
          <div className="mt-1 truncate font-mono text-[10px] text-slate-400" title={image.transform.join(" ")}>
            cm {image.transform.map(v => Number(v).toFixed(2)).join(" ")}
          </div>
        )}
      </div>
    </label>
  );
}

function DumpPanel({ dump }: { dump: any }) {
  return (
    <details className="rounded-xl border border-slate-300 bg-slate-900 p-4 text-xs text-slate-100">
      <summary className="cursor-pointer font-semibold">🔍 PDF 结构诊断（供开发者查看）</summary>
      <pre className="mt-3 max-h-[400px] overflow-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
{JSON.stringify(dump, (k, v) => {
  if (k === "imageBytes") return `<${(v as Uint8Array).length} bytes>`;
  return v;
}, 2)}
      </pre>
    </details>
  );
}
