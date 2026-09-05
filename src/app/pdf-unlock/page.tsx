"use client";

import { useState, useRef, useCallback } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

type Step = "upload" | "config" | "done";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

// Parse base64 string to Uint8Array (same as HTML decryptor)
function b64ToU8(s: string): Uint8Array {
  const b = atob(s);
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as any, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

interface HtmlCryptoData {
  salt: Uint8Array;
  iv: Uint8Array;
  cipher: Uint8Array;
}

function parseHtmlCrypto(html: string): HtmlCryptoData | null {
  const saltMatch = html.match(/const saltB64="([^"]+)"/);
  const ivMatch = html.match(/const ivB64="([^"]+)"/);
  const cipherMatch = html.match(/const cipherB64="([^"]+)"/);
  if (!saltMatch || !ivMatch || !cipherMatch) return null;
  try {
    return {
      salt: b64ToU8(saltMatch[1]),
      iv: b64ToU8(ivMatch[1]),
      cipher: b64ToU8(cipherMatch[1]),
    };
  } catch {
    return null;
  }
}

export default function PdfUnlockPage() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [htmlData, setHtmlData] = useState<HtmlCryptoData | null>(null);
  const [isHtml, setIsHtml] = useState(false);
  const [password, setPassword] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError("");
    setFileName(file.name);
    setFileSize(file.size);
    const bytes = new Uint8Array(await file.arrayBuffer());
    setFileBytes(bytes);

    // Detect if it's HTML format (new encrypted file)
    const text = new TextDecoder().decode(bytes.slice(0, 200));
    if (text.includes("<!DOCTYPE") || text.includes("<html")) {
      const htmlStr = new TextDecoder().decode(bytes);
      const parsed = parseHtmlCrypto(htmlStr);
      if (parsed) {
        setIsHtml(true);
        setHtmlData(parsed);
        setStep("config");
        return;
      }
    }

    // Old binary format: salt(16) + iv(12) + ciphertext
    if (bytes.length >= 28) {
      setIsHtml(false);
      setStep("config");
      return;
    }

    setError(t("pdf_unlock.error_invalid"));
  }, []);

  const decrypt = async () => {
    setProcessing(true);
    setError("");
    try {
      let salt: Uint8Array, iv: Uint8Array, cipher: Uint8Array;

      if (isHtml && htmlData) {
        salt = htmlData.salt;
        iv = htmlData.iv;
        cipher = htmlData.cipher;
      } else if (fileBytes && fileBytes.length >= 28) {
        salt = fileBytes.slice(0, 16);
        iv = fileBytes.slice(16, 28);
        cipher = fileBytes.slice(28);
      } else {
        setError(t("pdf_unlock.error_format"));
        setProcessing(false);
        return;
      }

      const key = await deriveKey(password, salt);
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv as any },
        key,
        cipher as any
      );

      const blob = new Blob([decrypted as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setStep("done");
    } catch {
      setError(t("pdf_unlock.error_decrypt_failed"));
    } finally {
      setProcessing(false);
    }
  };

  const download = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    // Ensure the downloaded file is always .pdf
    const baseName = fileName.replace(/\.html?$/i, "").replace(/\.encrypted\.pdf$/i, "");
    a.download = baseName + "_decrypted.pdf";
    a.click();
  };

  const reset = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setStep("upload");
    setFileBytes(null);
    setHtmlData(null);
    setIsHtml(false);
    setResultUrl("");
    setError("");
    setPassword("");
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

  const tool = getToolById("unlock")!;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 p-4">
        <p className="text-sm text-blue-800">
          <strong>{t("pdf_unlock.description")}</strong>{t("pdf_unlock.description_text")}
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {step === "upload" && (
          <div className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
            dragOver ? "border-brand-400 bg-brand-50" : "border-slate-300 bg-white/60"
          }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}>
            <div className="mb-4 text-5xl">&#128275;</div>
            <p className="mb-2 text-sm font-medium text-zinc-700">{t("pdf_unlock.drag_hint")}</p>
            <p className="mb-6 text-xs text-zinc-400">{t("pdf_unlock.upload_subhint")}</p>
            <button onClick={() => inputRef.current?.click()} className="btn-primary">{t("pdf_unlock.select_file")}</button>
            <input ref={inputRef} type="file" accept=".html,.pdf" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          </div>
        )}

        {step === "config" && (
          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
            <p className="text-sm text-zinc-500 mb-4">{fileName} | {formatSize(fileSize)}</p>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">{t("pdf_unlock.password_label")}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={t("pdf_unlock.password_placeholder")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter" && password) decrypt(); }} />
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={decrypt} className="btn-primary" disabled={processing || !password}>
                {processing ? t("pdf_unlock.decrypting") : t("pdf_unlock.decrypt_btn")}
              </button>
              <button onClick={reset} className="btn-secondary">{t("pdf_unlock.re_upload")}</button>
            </div>
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          </div>
        )}

        {step === "done" && resultUrl && (
          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
            <div className="mb-4">
              <div className="mb-2 text-4xl">&#9989;</div>
              <h3 className="text-sm font-semibold text-zinc-700">{t("pdf_unlock.done_title")}</h3>
              <p className="mt-2 text-sm text-zinc-500">{t("pdf_unlock.done_desc")}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={download} className="btn-primary">{t("pdf_unlock.download_pdf")}</button>
              <button onClick={reset} className="btn-secondary">{t("pdf_unlock.re_decrypt")}</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
