"use client";

import { useMemo, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

type CategoryKey = "length" | "weight" | "area" | "temp" | "volume" | "time";

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "length", label: "长度" },
  { key: "weight", label: "重量" },
  { key: "area", label: "面积" },
  { key: "temp", label: "温度" },
  { key: "volume", label: "体积" },
  { key: "time", label: "时间" },
];

const UNITS: Record<CategoryKey, { unit: string; label: string }[]> = {
  length: [
    { unit: "m", label: "米 (m)" },
    { unit: "km", label: "千米 (km)" },
    { unit: "cm", label: "厘米 (cm)" },
    { unit: "mm", label: "毫米 (mm)" },
    { unit: "in", label: "英寸 (in)" },
    { unit: "ft", label: "英尺 (ft)" },
  ],
  weight: [
    { unit: "kg", label: "千克 (kg)" },
    { unit: "g", label: "克 (g)" },
    { unit: "lb", label: "磅 (lb)" },
    { unit: "oz", label: "盎司 (oz)" },
  ],
  area: [
    { unit: "m2", label: "平方米 (m²)" },
    { unit: "km2", label: "平方千米 (km²)" },
    { unit: "ha", label: "公顷 (ha)" },
    { unit: "acre", label: "英亩 (acre)" },
  ],
  temp: [
    { unit: "C", label: "摄氏度 (°C)" },
    { unit: "F", label: "华氏度 (°F)" },
    { unit: "K", label: "开尔文 (K)" },
  ],
  volume: [
    { unit: "L", label: "升 (L)" },
    { unit: "mL", label: "毫升 (mL)" },
    { unit: "gal", label: "加仑 (gal)" },
  ],
  time: [
    { unit: "s", label: "秒 (s)" },
    { unit: "min", label: "分 (min)" },
    { unit: "hr", label: "小时 (hr)" },
    { unit: "day", label: "天 (day)" },
  ],
};

const TO_BASE: Record<CategoryKey, Record<string, number>> = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, in: 0.0254, ft: 0.3048 },
  weight: { kg: 1, g: 0.001, lb: 0.45359237, oz: 0.0283495231 },
  area: { m2: 1, km2: 1e6, ha: 1e4, acre: 4046.8564224 },
  volume: { L: 1, mL: 0.001, gal: 3.785411784 },
  time: { s: 1, min: 60, hr: 3600, day: 86400 },
  temp: { C: 1, F: 1, K: 1 },
};

function toBase(cat: CategoryKey, unit: string, val: number): number {
  if (cat === "temp") {
    if (unit === "C") return val;
    if (unit === "F") return ((val - 32) * 5) / 9;
    if (unit === "K") return val - 273.15;
  }
  return val * TO_BASE[cat][unit];
}

function fromBase(cat: CategoryKey, unit: string, base: number): number {
  if (cat === "temp") {
    if (unit === "C") return base;
    if (unit === "F") return (base * 9) / 5 + 32;
    if (unit === "K") return base + 273.15;
  }
  return base / TO_BASE[cat][unit];
}

export default function UtilUnitConvertPage() {
  const [cat, setCat] = useState<CategoryKey>("length");
  const [inputUnit, setInputUnit] = useState("m");
  const [outputUnit, setOutputUnit] = useState("km");
  const [inputVal, setInputVal] = useState<string>("1000");

  const result = useMemo(() => {
    const n = parseFloat(inputVal);
    if (isNaN(n)) return "";
    const base = toBase(cat, inputUnit, n);
    const out = fromBase(cat, outputUnit, base);
    if (!isFinite(out)) return "";
    if (Math.abs(out) < 0.0001 && out !== 0) return out.toExponential(6);
    return parseFloat(out.toPrecision(10)).toString();
  }, [cat, inputUnit, outputUnit, inputVal]);

  const swap = () => {
    setInputUnit(outputUnit);
    setOutputUnit(inputUnit);
    setInputVal(result || "");
  };

  const handleCatChange = (k: CategoryKey) => {
    setCat(k);
    const units = UNITS[k].map((u) => u.unit);
    setInputUnit(units[0]);
    setOutputUnit(units[Math.min(1, units.length - 1)]);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ToolHeader title="单位换算器" description="长度、重量、面积、温度、体积、时间的一键换算" />

      <div className="rounded-2xl bg-white/60 backdrop-blur shadow-soft border border-slate-200/70 p-6">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => handleCatChange(c.key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                cat === c.key
                  ? "bg-primary-600 text-white shadow-soft"
                  : "border border-slate-200 bg-white text-zinc-700 hover:border-primary-400 hover:text-primary-600"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">从</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-zinc-900 shadow-inner focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10"
                placeholder="输入数值"
              />
              <select
                value={inputUnit}
                onChange={(e) => setInputUnit(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-inner focus:border-primary-400 focus:outline-none"
              >
                {UNITS[cat].map((u) => (
                  <option key={u.unit} value={u.unit}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={swap}
            className="h-10 w-10 self-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-soft transition hover:border-primary-400 hover:text-primary-600 hover:shadow-card active:scale-95"
            title="交换"
          >
            ⇅
          </button>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">到</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={result}
                readOnly
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-primary-700 font-semibold shadow-inner"
                placeholder="结果"
              />
              <select
                value={outputUnit}
                onChange={(e) => setOutputUnit(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-inner focus:border-primary-400 focus:outline-none"
              >
                {UNITS[cat].map((u) => (
                  <option key={u.unit} value={u.unit}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {result && (
          <div className="mt-5 rounded-xl bg-primary-50/70 px-4 py-3 text-center text-sm text-primary-800">
            {inputVal} {UNITS[cat].find((u) => u.unit === inputUnit)?.label} ={" "}
            <span className="font-semibold">{result}</span>{" "}
            {UNITS[cat].find((u) => u.unit === outputUnit)?.label}
          </div>
        )}
      </div>
            <ToolUsage tool={getToolById("unit-convert")!} />
</main>
  );
}
