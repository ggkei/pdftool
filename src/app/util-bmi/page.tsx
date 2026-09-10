"use client";

import { t } from "@/i18n/dictionary";

import { useMemo, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

interface BmiCategory {
  name: string;
  range: string;
  color: string;
  bgColor: string;
  description: string;
}

const CATEGORIES: BmiCategory[] = [
  { name: t("util_bmi.cat_thin"), range: "< 18.5", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200", description: t("util_bmi.desc_thin") },
  { name: t("util_bmi.cat_normal"), range: "18.5 - 23.9", color: "text-green-700", bgColor: "bg-green-50 border-green-200", description: t("util_bmi.desc_normal") },
  { name: t("util_bmi.cat_overweight"), range: "24 - 27.9", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200", description: t("util_bmi.desc_overweight") },
  { name: t("util_bmi.cat_obese"), range: "≥ 28", color: "text-red-700", bgColor: "bg-red-50 border-red-200", description: t("util_bmi.desc_obese") },
];

function getCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return CATEGORIES[0];
  if (bmi < 24) return CATEGORIES[1];
  if (bmi < 28) return CATEGORIES[2];
  return CATEGORIES[3];
}

export default function Page() {
  const [height, setHeight] = useState<string>("170");
  const [weight, setWeight] = useState<string>("65");

  const bmiInfo = useMemo(() => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || !w || h <= 0 || w <= 0) return null;
    const heightM = h / 100;
    const bmi = w / (heightM * heightM);
    const healthyMin = 18.5 * heightM * heightM;
    const healthyMax = 24 * heightM * heightM;
    return {
      bmi: bmi,
      category: getCategory(bmi),
      healthyMin: healthyMin,
      healthyMax: healthyMax,
    };
  }, [height, weight]);

  const getBarColor = (bmi: number) => {
    if (bmi < 18.5) return "bg-blue-500";
    if (bmi < 24) return "bg-green-500";
    if (bmi < 28) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title={t("util_bmi.title")} description={t("util_bmi.desc")} />

      <section className="card p-6 space-y-5 animate-slide-up">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-zinc-700">
              {t("util_bmi.身高")}
              <span className="text-xs text-zinc-400">cm</span>
            </label>
            <input
              type="number"
              min={50}
              max={250}
              step={0.1}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="input-base"
              placeholder={t("util_bmi.placeholder_height")}
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-zinc-700">
              {t("util_bmi.体重")}
              <span className="text-xs text-zinc-400">kg</span>
            </label>
            <input
              type="number"
              min={20}
              max={300}
              step={0.1}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="input-base"
              placeholder={t("util_bmi.placeholder_weight")}
            />
          </div>
        </div>
      </section>

      {bmiInfo && (
        <section className="mt-6 animate-slide-up">
          <div className={`card p-6 border ${bmiInfo.category.bgColor}`}>
            <div className="text-center">
              <div className="text-xs text-zinc-500 mb-1">{t("util_bmi.your_bmi")}</div>
              <div className={`font-display text-5xl font-bold ${bmiInfo.category.color}`}>
                {bmiInfo.bmi.toFixed(1)}
              </div>
              <div className={`mt-2 inline-block rounded-full px-4 py-1 text-sm font-semibold ${bmiInfo.category.color}`}>
                {bmiInfo.category.name}
              </div>
            </div>

            <div className="mt-5">
              <div className="relative h-3 rounded-full overflow-hidden bg-zinc-100">
                <div className="absolute inset-y-0 left-0 bg-blue-400" style={{ width: "23.125%" }} />
                <div className="absolute inset-y-0 bg-green-400" style={{ left: "23.125%", width: "36.875%" }} />
                <div className="absolute inset-y-0 bg-amber-400" style={{ left: "60%", width: "20%" }} />
                <div className="absolute inset-y-0 bg-red-400" style={{ left: "80%", right: "0" }} />
              </div>
              <div className="relative mt-1 h-3">
                <div
                  className={`absolute -translate-x-1/2 h-4 w-4 rounded-full border-2 border-white shadow-soft ${getBarColor(bmiInfo.bmi)}`}
                  style={{ left: `${Math.min(100, Math.max(0, (bmiInfo.bmi / 40) * 100))}%` }}
                />
              </div>
              <div className="mt-3 flex justify-between text-[10px] text-zinc-500">
                <span>{t("util_bmi.cat_thin")}</span><span>{t("util_bmi.cat_normal")}</span><span>{t("util_bmi.cat_overweight")}</span><span>{t("util_bmi.cat_obese")}</span>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-white/80 backdrop-blur p-4">
              <div className="text-xs text-zinc-500 mb-1">{t("util_bmi.healthy_range")}</div>
              <div className="font-display text-xl font-bold text-zinc-800">
                {bmiInfo.healthyMin.toFixed(1)} - {bmiInfo.healthyMax.toFixed(1)} kg
              </div>
              <div className="mt-2 text-sm text-zinc-600">
                {bmiInfo.category.description}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {CATEGORIES.map((c) => (
              <div
                key={c.name}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${c.bgColor}`}
              >
                <span className={`font-medium ${c.color}`}>{c.name}</span>
                <span className={`font-mono ${c.color}`}>{c.range}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!bmiInfo && (
        <div className="mt-6 card p-8 text-center text-zinc-400 text-sm animate-fade-in">
          {t("util_bmi.请输入有效的身高和体重")}
        </div>
      )}

      <p className="mt-5 text-center text-xs text-zinc-400">
        {t("util_bmi.BMI为通用健康指标不适用于孕")}
      </p>
            <ToolUsage tool={getToolById("bmi")!} />
</main>
  );
}
