"use client";

import { useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

interface Stop {
  color: string;
  pos: number;
}

export default function UtilGradientPage() {
  const [type, setType] = useState<"linear" | "radial">("linear");
  const [angle, setAngle] = useState(90);
  const [stops, setStops] = useState<Stop[]>([
    { color: "#7c3aed", pos: 0 },
    { color: "#ec4899", pos: 100 },
  ]);
  const [copied, setCopied] = useState(false);

  const updateStop = (index: number, key: keyof Stop, value: string | number) => {
    setStops(stops.map((s, i) => i === index ? { ...s, [key]: value } : s));
  };

  const addStop = () => {
    setStops([...stops, { color: "#ffffff", pos: 50 }]);
  };

  const removeStop = (index: number) => {
    if (stops.length <= 2) return;
    setStops(stops.filter((_, i) => i !== index));
  };

  const gradientCSS = () => {
    const stopsStr = stops
      .sort((a, b) => a.pos - b.pos)
      .map((s) => `${s.color} ${s.pos}%`)
      .join(", ");
    return type === "linear"
      ? `linear-gradient(${angle}deg, ${stopsStr})`
      : `radial-gradient(circle, ${stopsStr})`;
  };

  const css = `background: ${gradientCSS()};`;

  const copy = () => {
    navigator.clipboard.writeText(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tool = getToolById("css-gradient")!;

  const presets = [
    { name: t("util_gradient.紫色渐变"), css: "linear-gradient(135deg, #7c3aed, #ec4899)" },
    { name: t("util_common.海洋"), css: "linear-gradient(135deg, #0ea5e9, #6366f1)" },
    { name: t("util_common.日落"), css: "linear-gradient(135deg, #f59e0b, #ef4444)" },
    { name: t("util_common.森林"), css: "linear-gradient(135deg, #10b981, #059669)" },
    { name: t("util_common.暗夜"), css: "linear-gradient(135deg, #1e293b, #334155)" },
    { name: t("util_common.彩虹"), css: "linear-gradient(90deg, #ef4444, #f59e0b, #10b981, #0ea5e9, #6366f1)" },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      <div className="mt-8 space-y-4">
        <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
          <div className="flex gap-2 mb-6">
            <button onClick={() => setType("linear")}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${type === "linear" ? "bg-brand-600 text-white" : "bg-slate-100 text-zinc-600"}`}>
              {t("util_gradient.线性渐变")}
            </button>
            <button onClick={() => setType("radial")}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${type === "radial" ? "bg-brand-600 text-white" : "bg-slate-100 text-zinc-600"}`}>
              {t("util_gradient.径向渐变")}
            </button>
          </div>

          {type === "linear" && (
            <div className="mb-6">
              <label className="mb-1 block text-xs font-medium text-zinc-500">{t("util_common.角度")}: {angle}°</label>
              <input type="range" min="0" max="360" value={angle}
                onChange={(e) => setAngle(parseInt(e.target.value))} className="w-full" />
            </div>
          )}

          <div className="space-y-3 mb-4">
            {stops.map((stop, i) => (
              <div key={i} className="flex items-center gap-3">
                <input type="color" value={stop.color}
                  onChange={(e) => updateStop(i, "color", e.target.value)}
                  className="h-10 w-12 rounded-lg border border-slate-200" />
                <input type="range" min="0" max="100" value={stop.pos}
                  onChange={(e) => updateStop(i, "pos", parseInt(e.target.value))}
                  className="flex-1" />
                <span className="w-12 text-sm text-zinc-500">{stop.pos}%</span>
                <code className="text-xs text-zinc-400 w-20">{stop.color}</code>
                <button onClick={() => removeStop(i)}
                  className={`text-red-400 hover:text-red-600 text-sm ${stops.length <= 2 ? "invisible" : ""}`}>
                  {t("common.delete")}
                </button>
              </div>
            ))}
          </div>

          <button onClick={addStop} className="btn-secondary text-sm mb-4">{t("util_gradient.添加色标")}</button>

          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-zinc-500">{t("util_gradient.预设渐变")}</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button key={p.name} onClick={() => {
                  const matches = p.css.match(/(\d+)deg,\s*(.+)/);
                  if (matches) {
                    setType("linear");
                    setAngle(parseInt(matches[1]));
                    const colorStops = matches[2].split(",").map((s, i) => {
                      const trimmed = s.trim();
                      const match = trimmed.match(/^(#[0-9a-fA-F]+)\s*(\d+)?%?$/);
                      return { color: match?.[1] || "#000000", pos: match?.[2] ? parseInt(match[2]) : Math.round((i / (matches[2].split(",").length - 1)) * 100) };
                    });
                    setStops(colorStops);
                  }
                }} className="rounded-lg overflow-hidden border border-slate-200" style={{ width: 80, height: 30, background: p.css }}>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden border border-slate-200/70" style={{ height: 120, background: gradientCSS() }} />

        <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-zinc-500">{t("util_gradient.CSS代码")}</span>
            <button onClick={copy} className="text-xs text-brand-600 hover:text-brand-700">
              {copied ? t("util_common.copied") : t("util_common.copy")}
            </button>
          </div>
          <pre className="rounded-lg bg-slate-900 p-4 text-xs font-mono text-green-400 overflow-x-auto">{css}</pre>
        </div>
      </div>
    </main>
  );
}
