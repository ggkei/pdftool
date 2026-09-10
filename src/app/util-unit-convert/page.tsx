"use client";

import { useMemo, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

type CategoryKey = "length" | "weight" | "area" | "temp" | "volume" | "time";

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "length", label: t("util_unit_convert.cat_length") },
  { key: "weight", label: t("util_unit_convert.cat_weight") },
  { key: "area", label: t("util_unit_convert.cat_area") },
  { key: "temp", label: t("util_unit_convert.cat_temp") },
  { key: "volume", label: t("util_unit_convert.cat_volume") },
  { key: "time", label: t("util_unit_convert.cat_time") },
];

const UNITS: Record<CategoryKey, { unit: string; label: string }[]> = {
  length: [
    { unit: "m", label: t("util_unit_convert.unit_m") },
    { unit: "km", label: t("util_unit_convert.unit_km") },
    { unit: "cm", label: t("util_unit_convert.unit_cm") },
    { unit: "mm", label: t("util_unit_convert.unit_mm") },
    { unit: "in", label: t("util_unit_convert.unit_in") },
    { unit: "ft", label: t("util_unit_convert.unit_ft") },
  ],
  weight: [
    { unit: "kg", label: t("util_unit_convert.unit_kg") },
    { unit: "g", label: t("util_unit_convert.unit_g") },
    { unit: "lb", label: t("util_unit_convert.unit_lb") },
    { unit: "oz", label: t("util_unit_convert.unit_oz") },
  ],
  area: [
    { unit: "m2", label: t("util_unit_convert.unit_m2") },
    { unit: "km2", label: t("util_unit_convert.unit_km2") },
    { unit: "ha", label: t("util_unit_convert.unit_ha") },
    { unit: "acre", label: t("util_unit_convert.unit_acre") },
  ],
  temp: [
    { unit: "C", label: t("util_unit_convert.unit_celsius") },
    { unit: "F", label: t("util_unit_convert.unit_fahr") },
    { unit: "K", label: t("util_unit_convert.unit_kelvin") },
  ],
  volume: [
    { unit: "L", label: t("util_unit_convert.unit_liter") },
    { unit: "mL", label: t("util_unit_convert.unit_ml") },
    { unit: "gal", label: t("util_unit_convert.unit_gal") },
  ],
  time: [
    { unit: "s", label: t("util_unit_convert.unit_s") },
    { unit: "min", label: t("util_unit_convert.unit_min") },
    { unit: "hr", label: t("util_unit_convert.unit_hr") },
    { unit: "day", label: t("util_unit_convert.unit_day") },
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
      <ToolHeader title={t("util_unit_convert.title")} description={t("util_unit_convert.desc")} />

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
            <label className="mb-1 block text-xs font-medium text-zinc-500">{t("util_unit_convert.label_from")}</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-zinc-900 shadow-inner focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10"
                placeholder={t("util_unit_convert.placeholder_input")}
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
            title={t("util_unit_convert.swap")}
          >
            ⇅
          </button>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">{t("util_unit_convert.label_to")}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={result}
                readOnly
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-primary-700 font-semibold shadow-inner"
                placeholder={t("util_unit_convert.placeholder_result")}
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
