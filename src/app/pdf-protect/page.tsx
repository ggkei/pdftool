"use client";

import { useState, useRef, useCallback } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { PDFDocument } from "pdf-lib";
import { t } from "@/i18n/dictionary";

type Step = "upload" | "config" | "done";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export default function PdfProtectPage() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setError(t("pdf_protect.error_upload"));
      return;
    }
    setError("");
    setFileName(file.name);
    setFileSize(file.size);
    const bytes = new Uint8Array(await file.arrayBuffer());
    setPdfBytes(bytes);
    setStep("config");
  }, []);

  const encrypt = async () => {
    if (!pdfBytes) return;
    if (password !== confirmPassword) {
      setError(t("pdf_protect.error_password_mismatch"));
      return;
    }
    if (password.length < 4) {
      setError(t("pdf_protect.error_password_short"));
      return;
    }
    setProcessing(true);
    setError("");
    try {
      // Encrypt with pdf-lib standard password protection
      const pdfDoc = await PDFDocument.load(pdfBytes.buffer as ArrayBuffer);
      
      // pdf-lib doesn't have a direct encrypt() API in v1.17.1
      // Instead we use a self-contained HTML decryptor approach
      // Encrypt the raw PDF bytes with AES-GCM + PBKDF2
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
      );
      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
      );
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv }, key, pdfBytes.buffer as ArrayBuffer
      );
      const encryptedArray = new Uint8Array(encrypted);

      // Build self-contained HTML decryptor
      const saltB64 = uint8ToBase64(salt);
      const ivB64 = uint8ToBase64(iv);
      const cipherB64 = uint8ToBase64(encryptedArray);

      const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${fileName.replace(/</g, '&lt;')} - PDF Decryptor</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,'PingFang SC','Microsoft YaHei',sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:420px;width:100%;padding:32px;text-align:center}
.card h1{font-size:20px;font-weight:700;color:#1f2937;margin-bottom:8px}
.card .file{font-size:13px;color:#6b7280;margin-bottom:20px;word-break:break-all}
.card .icon{font-size:48px;margin-bottom:12px}
.card input{width:100%;padding:12px 16px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;margin-bottom:16px;outline:none;transition:border-color .2s}
.card input:focus{border-color:#667eea}
.card button{width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:opacity .2s}
.card button:hover{opacity:.9}
.card button:disabled{opacity:.5;cursor:not-allowed}
.card .error{color:#ef4444;font-size:13px;margin-top:12px;min-height:20px}
.card .hint{font-size:12px;color:#9ca3af;margin-top:16px}
.card .success{color:#10b981;font-size:14px;margin-top:12px;font-weight:600}
#downloadLink{display:none}
</style>
</head>
<body>
<div class="card">
<div class="icon">&#128274;</div>
<h1>${t("pdf_protect.html_encrypted_title")}</h1>
<p class="file">${fileName.replace(/</g, '&lt;')}</p>
<input type="password" id="pwd" placeholder="${t("pdf_protect.html_enter_password")}" autocomplete="off" onkeydown="if(event.key==='Enter')decrypt()">
<button id="btn" onclick="decrypt()">${t("pdf_protect.html_decrypt_btn")}</button>
<p class="error" id="err"></p>
<p class="success" id="ok"></p>
<p class="hint">${t("pdf_protect.html_hint")}</p>
<a id="downloadLink"></a>
</div>
<script>
const saltB64="${saltB64}";const ivB64="${ivB64}";const cipherB64="${cipherB64}";
const fileName="${fileName.replace(/"/g, '\\"').replace(/</g, '\\x3c')}";
function b64ToU8(s){const b=atob(s);const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
async function deriveKey(password,salt){const enc=new TextEncoder();const km=await crypto.subtle.importKey("raw",enc.encode(password),{name:"PBKDF2"},false,["deriveKey"]);return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},km,{name:"AES-GCM",length:256},false,["decrypt"])}
async function decrypt(){const btn=document.getElementById('btn');const err=document.getElementById('err');const ok=document.getElementById('ok');const pwd=document.getElementById('pwd').value;err.textContent='';ok.textContent='';if(!pwd){err.textContent='${t("pdf_protect.html_err_no_password")}';return}btn.disabled=true;btn.textContent='${t("pdf_protect.html_decrypting")}';try{const salt=b64ToU8(saltB64);const iv=b64ToU8(ivB64);const cipher=b64ToU8(cipherB64);const key=await deriveKey(pwd,salt);const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv},key,cipher);const blob=new Blob([plain],{type:"application/pdf"});const url=URL.createObjectURL(blob);const a=document.getElementById('downloadLink');a.href=url;a.download=fileName.replace(/\\.pdf$/i,'')+'_decrypted.pdf';a.click();ok.textContent='${t("pdf_protect.html_success")}';}catch(e){err.textContent='${t("pdf_protect.html_err_wrong_password")}';}finally{btn.disabled=false;btn.textContent='${t("pdf_protect.html_decrypt_btn")}';}}
</script>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName.replace(/\.pdf$/i, "")}_protected.html`;
      a.click();
      URL.revokeObjectURL(url);
      setStep("done");
    } catch (e) {
      setError(t("pdf_protect.error_encrypt_failed") + ": " + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setPdfBytes(null);
    setFileName("");
    setFileSize(0);
    setError("");
    setPassword("");
    setConfirmPassword("");
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

  const tool = getToolById("protect")!;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
        <p className="text-sm text-amber-800">
          <strong>{t("pdf_protect.how_it_works")}</strong> {t("pdf_protect.how_it_works_desc")}
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
            <div className="mb-4 text-5xl">&#128274;</div>
            <p className="mb-2 text-sm font-medium text-zinc-700">{t("pdf_protect.drag_hint")}</p>
            <p className="mb-6 text-xs text-zinc-400">{t("pdf_protect.upload_subhint")}</p>
            <button onClick={() => inputRef.current?.click()} className="btn-primary">{t("pdf_protect.select_pdf")}</button>
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          </div>
        )}

        {step === "config" && (
          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
            <p className="text-sm text-zinc-500 mb-4">{fileName} | {formatSize(fileSize)}</p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("pdf_protect.password_label")}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("pdf_protect.password_placeholder")} minLength={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("pdf_protect.confirm_password")}</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("pdf_protect.confirm_placeholder")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={encrypt} className="btn-primary" disabled={processing || !password || !confirmPassword}>
                {processing ? t("pdf_protect.encrypting") : t("pdf_protect.encrypt_download")}
              </button>
              <button onClick={reset} className="btn-secondary">{t("pdf_protect.re_upload")}</button>
            </div>
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          </div>
        )}

        {step === "done" && (
          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
            <div className="mb-4">
              <div className="mb-2 text-4xl">&#9989;</div>
              <h3 className="text-sm font-semibold text-zinc-700">{t("pdf_protect.done_title")}</h3>
              <p className="mt-2 text-sm text-zinc-500">{t("pdf_protect.done_desc")}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 mb-4">
              <p className="text-xs text-blue-800">{t("pdf_protect.done_hint")}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={reset} className="btn-primary">{t("pdf_protect.encrypt_another")}</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
