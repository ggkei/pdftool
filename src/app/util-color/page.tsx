"use client";

import Link from "next/link";
import { useState } from "react";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

interface RGB { r: number; g: number; b: number }
interface HSL { h: number; s: number; l: number }

function hexToRgb(hex: string): RGB | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: RGB): string {
  return "#" + [r, g, b].map(v => {
    const s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
    return s.length === 1 ? "0" + s : s;
  }).join("");
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)); break;
      case gn: h = ((bn - rn) / d + 2); break;
      case bn: h = ((rn - gn) / d + 4); break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

const PRESET_COLORS = [
  "#7c3aed", "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4",
  "#14b8a6", "#10b981", "#22c55e", "#84cc16", "#eab308",
  "#f59e0b", "#f97316", "#ef4444", "#ec4899", "#a855f7",
  "#ffffff", "#d4d4d8", "#71717a", "#18181b", "#000000",
];

export default function Page() {
  const [hex, setHex] = useState("#7c3aed");
  const [rgb, setRgb] = useState<RGB>({ r: 124, g: 58, b: 237 });
  const [hsl, setHsl] = useState<HSL>({ h: 262, s: 81, l: 58 });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<"hex" | "rgb" | "hsl">("hex");

  function fromHex(val: string) {
    const clean = val.startsWith("#") ? val : "#" + val;
    const parsed = hexToRgb(clean);
    if (!parsed) { setHex(val); return; }
    setHex(clean.toLowerCase());
    setRgb(parsed);
    setHsl(rgbToHsl(parsed));
    setInputMode("hex");
  }

  function fromRgb(key: keyof RGB, val: string) {
    const n = Math.max(0, Math.min(255, parseInt(val) || 0));
    const newRgb = { ...rgb, [key]: n };
    setRgb(newRgb);
    setHex(rgbToHex(newRgb));
    setHsl(rgbToHsl(newRgb));
    setInputMode("rgb");
  }

  function fromHsl(key: keyof HSL, val: string) {
    const n = parseInt(val) || 0;
    const clamped = key === "h" ? ((n % 360) + 360) % 360 : Math.max(0, Math.min(100, n));
    const newHsl = { ...hsl, [key]: clamped };
    setHsl(newHsl);
    const newRgb = hslToRgb(newHsl);
    setRgb(newRgb);
    setHex(rgbToHex(newRgb));
    setInputMode("hsl");
  }

  async function copy(key: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  const rgbStr = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const hslStr = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  const rgbaStr = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-10 animate-fade-in">
        <Link href="/" className="group mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-brand-600">
          <svg className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
          </svg>
          返回工具箱
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">颜色转换</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">HEX、RGB、HSL 三格式实时同步转换，一键复制</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="rounded-2xl border border-slate-200/70 bg-white shadow-soft p-5">
          <div
            className="relative mb-4 h-44 rounded-xl border border-slate-200 shadow-inner overflow-hidden"
            style={{ backgroundColor: hex }}
          >
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <span className={`font-mono text-sm font-semibold ${hsl.l > 55 ? "text-zinc-800" : "text-white"} drop-shadow`}>
                {hex.toUpperCase()}
              </span>
              <label className="relative cursor-pointer">
                <input
                  type="color"
                  value={hex}
                  onChange={(e) => fromHex(e.target.value)}
                  className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                />
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 shadow border border-slate-200">
                  <svg className="h-4 w-4 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </span>
              </label>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">HEX</label>
            <div className="flex gap-2">
              <span className="inline-flex items-center rounded-xl border border-r border-slate-200 bg-slate-50 px-3 text-sm text-zinc-500 font-mono">#</span>
              <input
                type="text"
                value={hex.replace(/^#/, "").toUpperCase()}
                onChange={(e) => fromHex("#" + e.target.value)}
                maxLength={6}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 font-mono text-sm text-zinc-800 uppercase tracking-wider focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all"
              />
              <button onClick={() => copy("hex", hex)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-zinc-500 hover:bg-slate-50">
                {copiedKey === "hex" ? "已复制" : "复制"}
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-xs font-medium text-zinc-600">预设颜色</div>
            <div className="grid grid-cols-10 gap-1.5">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => fromHex(c)}
                  className="h-6 w-6 rounded-md border border-slate-200 hover:scale-110 transition-transform shadow-soft"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white shadow-soft p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-800">颜色值</h3>
          </div>

          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-600">RGB</label>
                <button onClick={() => copy("rgb", rgbStr)}
                  className="text-[11px] text-brand-600 hover:text-brand-700 font-medium">
                  {copiedKey === "rgb" ? "已复制" : "复制 RGB()"}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(["r", "g", "b"] as const).map((k, i) => {
                  const labels = { r: "Red", g: "Green", b: "Blue" };
                  const colors = { r: "#ef4444", g: "#22c55e", b: "#3b82f6" };
                  return (
                    <div key={k}>
                      <div className="mb-1 text-[11px] text-zinc-400">{labels[k]}</div>
                      <input
                        type="number"
                        min={0}
                        max={255}
                        value={rgb[k]}
                        onChange={(e) => fromRgb(k, e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-zinc-800 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all"
                        style={{ borderLeftWidth: 3, borderLeftColor: colors[k] }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-600">HSL</label>
                <button onClick={() => copy("hsl", hslStr)}
                  className="text-[11px] text-brand-600 hover:text-brand-700 font-medium">
                  {copiedKey === "hsl" ? "已复制" : "复制 HSL()"}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="mb-1 text-[11px] text-zinc-400">Hue 色相</div>
                  <div className="flex items-center gap-1">
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={hsl.h}
                      onChange={(e) => fromHsl("h", e.target.value)}
                      className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                      style={{ background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }}
                    />
                    <input
                      type="number"
                      min={0}
                      max={360}
                      value={hsl.h}
                      onChange={(e) => fromHsl("h", e.target.value)}
                      className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center font-mono text-sm text-zinc-800 focus:border-brand-400 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] text-zinc-400">Saturation 饱和度</div>
                  <div className="flex items-center gap-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={hsl.s}
                      onChange={(e) => fromHsl("s", e.target.value)}
                      className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, hsl(${hsl.h}, 0%, ${hsl.l}%), hsl(${hsl.h}, 100%, ${hsl.l}%))` }}
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={hsl.s}
                      onChange={(e) => fromHsl("s", e.target.value)}
                      className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center font-mono text-sm text-zinc-800 focus:border-brand-400 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] text-zinc-400">Lightness 亮度</div>
                  <div className="flex items-center gap-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={hsl.l}
                      onChange={(e) => fromHsl("l", e.target.value)}
                      className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, #000, hsl(${hsl.h}, ${hsl.s}%, 50%), #fff)` }}
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={hsl.l}
                      onChange={(e) => fromHsl("l", e.target.value)}
                      className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center font-mono text-sm text-zinc-800 focus:border-brand-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-zinc-600">CSS 片段</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { key: "hex", label: "HEX", val: hex.toUpperCase() },
                  { key: "rgb", label: "RGB", val: rgbStr },
                  { key: "rgba", label: "RGBA", val: rgbaStr },
                  { key: "hsl", label: "HSL", val: hslStr },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{item.label}</span>
                      <span className="font-mono text-xs text-zinc-700 truncate">{item.val}</span>
                    </div>
                    <button onClick={() => copy(item.key, item.val)}
                      className="ml-2 rounded-md px-2 py-0.5 text-[11px] text-brand-600 hover:text-brand-700 font-medium shrink-0">
                      {copiedKey === item.key ? "已复制" : "复制"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-zinc-600">色彩信息</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] text-zinc-500">相对亮度</div>
                  <div className="font-mono text-sm font-semibold text-zinc-700">
                    {(() => {
                      const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
                        const s = v / 255;
                        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
                      });
                      return ((0.2126 * r + 0.7152 * g + 0.0722 * b)).toFixed(3);
                    })()}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] text-zinc-500">是否暗色</div>
                  <div className="font-mono text-sm font-semibold text-zinc-700">{hsl.l < 50 ? "是" : "否"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] text-zinc-500">互补色</div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-4 w-4 rounded border border-slate-300" style={{ backgroundColor: rgbToHex(hslToRgb({ h: (hsl.h + 180) % 360, s: hsl.s, l: hsl.l })) }} />
                    <span className="font-mono text-xs font-semibold text-zinc-700">{rgbToHex(hslToRgb({ h: (hsl.h + 180) % 360, s: hsl.s, l: hsl.l })).toUpperCase()}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] text-zinc-500">灰度</div>
                  <div className="font-mono text-sm font-semibold text-zinc-700">
                    {Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
            <ToolUsage tool={getToolById("color")!} />
</main>
  );
}
