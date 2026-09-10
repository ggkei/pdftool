"use client";

import { t } from "@/i18n/dictionary";

import { useState } from "react";
import QRCode from "qrcode";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

const EC_LEVELS: { value: "L" | "M" | "Q" | "H"; label: string; desc: string }[] = [
  { value: "L", label: "L", desc: t("util_qrcode.ec_l") },
  { value: "M", label: "M", desc: t("util_qrcode.ec_m") },
  { value: "Q", label: "Q", desc: t("util_qrcode.ec_q") },
  { value: "H", label: "H", desc: t("util_qrcode.ec_h") },
];

export default function UtilQrcodePage() {
  const [text, setText] = useState("https://example.com");
  const [size, setSize] = useState(256);
  const [ecLevel, setEcLevel] = useState<"L" | "M" | "Q" | "H">("M");
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const generate = async () => {
    setError("");
    if (!text.trim()) {
      setError(t("util_qrcode.error_empty"));
      return;
    }
    try {
      const url = await QRCode.toDataURL(text, {
        width: size,
        margin: 2,
        errorCorrectionLevel: ecLevel,
        color: { dark: "#18181b", light: "#ffffff" },
      });
      setQrUrl(url);
      setGenerated(true);
    } catch (e: any) {
      setError(e.message || t("util_qrcode.error_failed"));
    }
  };

  const download = () => {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `qrcode-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 1500);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ToolHeader title={t("util_qrcode.title")} description={t("util_qrcode.desc")} />

      <div className="rounded-2xl bg-white/60 backdrop-blur shadow-soft border border-slate-200/70 p-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">{t("util_qrcode.label_text")}</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-inner focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 scrollbar-thin"
                placeholder={t("util_qrcode.placeholder_input")}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                {t("util_qrcode.尺寸")}: <span className="text-primary-600 font-semibold">{size}px</span>
              </label>
              <input
                type="range"
                min={128}
                max={512}
                step={8}
                value={size}
                onChange={(e) => setSize(+e.target.value)}
                className="w-full"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
                <span>128</span>
                <span>512</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">{t("util_qrcode.label_ec")}</label>
              <div className="flex gap-2">
                {EC_LEVELS.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setEcLevel(l.value)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-center transition ${
                      ecLevel === l.value
                        ? "border-primary-400 bg-primary-50 text-primary-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-sm font-semibold">{l.label}</div>
                    <div className="text-[10px] opacity-70">{l.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={generate}
              className="w-full rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-primary-700 hover:shadow-glow active:scale-[0.98] transition"
            >
              {t("util_qrcode.生成二维码")}
            </button>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div
              className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-inner"
              style={{ minHeight: 280, minWidth: 280 }}
            >
              {generated && qrUrl ? (
                <img
                  src={qrUrl}
                  alt="QR Code"
                  width={size}
                  height={size}
                  className="rounded-lg shadow-soft"
                />
              ) : (
                <div className="text-center text-slate-400">
                  <div className="text-5xl mb-2">🔲</div>
                  <div className="text-sm">{t("util_qrcode.preview_hint")}</div>
                </div>
              )}
            </div>
            {generated && qrUrl && (
              <button
                onClick={download}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-zinc-700 shadow-soft transition hover:border-primary-400 hover:text-primary-600"
              >
                💾 {downloaded ? t("util_qrcode.downloaded") : t("util_qrcode.download_png")}
              </button>
            )}
          </div>
        </div>
      </div>
            <ToolUsage tool={getToolById("qrcode")!} />
</main>
  );
}
