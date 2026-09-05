"use client";

import { useState, useCallback, useRef } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

type Step = "upload" | "done";
type Mode = "encode" | "decode";

export default function ImageBase64Page() {
  const [step, setStep] = useState<Step>("upload");
  const [mode, setMode] = useState<Mode>("encode");
  const [base64Text, setBase64Text] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileInfo, setFileInfo] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const encodeFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError(t("img_base64.error_format"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setBase64Text(result);
      setFileInfo(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      setStep("done");
    };
    reader.readAsDataURL(file);
  }, []);

  const decodeBase64 = useCallback(() => {
    const text = base64Text.trim();
    if (!text.startsWith("data:image/")) {
      setError(t("img_base64.error_decode"));
      return;
    }
    try {
      setPreviewUrl(text);
      setStep("done");
      setError("");
    } catch {
      setError(t("img_base64.error_decode"));
    }
  }, [base64Text]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(base64Text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const downloadImage = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `decoded-image-${Date.now()}.png`;
    a.click();
  };

  const reset = () => {
    setStep("upload");
    setBase64Text("");
    setPreviewUrl("");
    setFileInfo("");
    setError("");
    setCopied(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setBase64Text("");
      setPreviewUrl("");
      setFileInfo("");
      setError("");
      setCopied(false);
      setStep("upload");
      setTimeout(() => encodeFile(file), 0);
    }
  };

  const tool = getToolById("image-base64")!;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6 mb-6">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setMode("encode"); reset(); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === "encode"
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-zinc-600 hover:bg-slate-200"
            }`}
          >
            {t("img_base64.data_url")}
          </button>
          <button
            onClick={() => { setMode("decode"); reset(); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === "decode"
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-zinc-600 hover:bg-slate-200"
            }`}
          >
            {t("img_base64.mode_decode")}
          </button>
        </div>

        {mode === "encode" && (
          <>
            {step === "upload" && (
              <div
                className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
                  dragOver ? "border-brand-400 bg-brand-50" : "border-slate-300 bg-white/60"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <div className="mb-3 text-4xl">&#128220;</div>
                <p className="mb-1 text-sm font-medium text-zinc-700">{t("img_base64.drag_hint")}</p>
                <p className="mb-4 text-xs text-zinc-400">{t("common.privacy_badge")}</p>
                <button onClick={() => inputRef.current?.click()} className="btn-primary">{t("img_base64.select_image")}</button>
                <input ref={inputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) encodeFile(file); }} />
                {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
              </div>
            )}

            {step === "done" && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-500">{fileInfo}</p>
                <div className="relative">
                  <textarea
                    value={base64Text}
                    readOnly
                    rows={8}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono break-all"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="absolute top-2 right-2 rounded-lg bg-white border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50"
                  >
                    {copied ? t("img_base64.copied") : t("img_base64.copy")}
                  </button>
                </div>
                <div className="flex gap-3">
                  <button onClick={reset} className="btn-secondary">{t("common.reupload")}</button>
                </div>
              </div>
            )}
          </>
        )}

        {mode === "decode" && (
          <>
            {step === "upload" && (
              <div className="space-y-4">
                <textarea
                  value={base64Text}
                  onChange={(e) => setBase64Text(e.target.value)}
                  rows={6}
                  placeholder={t("img_base64.input_base64")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono break-all"
                />
                <div className="flex gap-3">
                  <button onClick={decodeBase64} className="btn-primary" disabled={!base64Text.trim()}>
                    {t("img_base64.btn_decode")}
                  </button>
                  <button onClick={() => setBase64Text("")} className="btn-secondary">{t("util_common.clear")}</button>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
            )}

            {step === "done" && (
              <div className="space-y-4">
                <img src={previewUrl} alt="decoded" className="max-h-64 w-auto rounded-lg" />
                <div className="flex gap-3">
                  <button onClick={downloadImage} className="btn-primary">{t("img_base64.download")}</button>
                  <button onClick={reset} className="btn-secondary">{t("img_base64.input_base64")}</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
