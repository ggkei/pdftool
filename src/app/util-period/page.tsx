"use client";

import { t } from "@/i18n/dictionary";

import { useMemo, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

interface CyclePrediction {
  cycleIndex: number;
  periodStart: Date;
  periodEnd: Date;
  ovulationDay: Date;
  fertileStart: Date;
  fertileEnd: Date;
  safeBefore: { start: Date; end: Date } | null;
  safeAfter: { start: Date; end: Date } | null;
  nextPeriodStart: Date;
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatShort(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatWeekday(date: Date): string {
  const weekdays = [t("util_period.week_sun"), t("util_period.week_mon"), t("util_period.week_tue"), t("util_period.week_wed"), t("util_period.week_thu"), t("util_period.week_fri"), t("util_period.week_sat")];
  return t("util_period.周", {0: weekdays[date.getDay()]});
}

function formatRange(a: Date, b: Date): string {
  if (a.getTime() === b.getTime()) return formatShort(a);
  return `${formatShort(a)} - ${formatShort(b)}`;
}

export default function Page() {
  const today = new Date();
  const defaultLastPeriod = new Date(today);
  defaultLastPeriod.setDate(defaultLastPeriod.getDate() - 14);

  const [lastPeriod, setLastPeriod] = useState<string>(formatDate(defaultLastPeriod));
  const [cycleLength, setCycleLength] = useState<number>(28);
  const [periodDays, setPeriodDays] = useState<number>(5);
  const [showCount, setShowCount] = useState<number>(3);

  const predictions = useMemo<CyclePrediction[]>(() => {
    const start = new Date(lastPeriod + "T00:00:00");
    if (isNaN(start.getTime())) return [];

    const result: CyclePrediction[] = [];
    let currentPeriodStart = start;

    for (let i = 0; i < showCount; i++) {
      const periodEnd = addDays(currentPeriodStart, periodDays - 1);
      const nextPeriodStart = addDays(currentPeriodStart, cycleLength);
      const ovulationDay = addDays(nextPeriodStart, -14);
      const fertileStart = addDays(ovulationDay, -5);
      const fertileEnd = addDays(ovulationDay, 1);

      let safeBefore: { start: Date; end: Date } | null = null;
      if (periodDays < cycleLength - 18) {
        safeBefore = {
          start: addDays(periodEnd, 1),
          end: addDays(fertileStart, -1),
        };
      }

      let safeAfter: { start: Date; end: Date } | null = null;
      const nextFertileStart = addDays(nextPeriodStart, -14 - 5);
      if (daysBetween(fertileEnd, nextFertileStart) > 0) {
        safeAfter = {
          start: addDays(fertileEnd, 1),
          end: addDays(nextFertileStart, -1),
        };
      }

      result.push({
        cycleIndex: i + 1,
        periodStart: currentPeriodStart,
        periodEnd,
        ovulationDay,
        fertileStart,
        fertileEnd,
        safeBefore,
        safeAfter,
        nextPeriodStart,
      });

      currentPeriodStart = nextPeriodStart;
    }

    return result;
  }, [lastPeriod, cycleLength, periodDays, showCount]);

  const todayInfo = useMemo(() => {
    if (predictions.length === 0) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const firstCycle = predictions[0];
    const daysSinceStart = daysBetween(firstCycle.periodStart, now);

    if (daysSinceStart < 0) {
      return { label: t("util_period.还未到预测周期"), sub: t("util_period.距离上次月经还有", {0: -daysSinceStart}), color: "text-zinc-500" };
    }

    if (daysSinceStart < periodDays) {
      return { label: t("util_period.经期中"), sub: t("util_period.第天还剩天", {0: daysSinceStart + 1, 1: periodDays - daysSinceStart - 1}), color: "text-rose-600" };
    }

    if (now.getTime() === firstCycle.ovulationDay.getTime()) {
      return { label: t("util_period.ovulation_day"), sub: t("util_period.ovulation_today"), color: "text-fuchsia-600" };
    }

    if (now >= firstCycle.fertileStart && now <= firstCycle.fertileEnd) {
      const fertileDay = daysBetween(firstCycle.fertileStart, now) + 1;
      return { label: t("util_period.易孕期"), sub: t("util_period.易孕期第天", {0: fertileDay}), color: "text-orange-600" };
    }

    if (now >= firstCycle.periodStart && now < firstCycle.nextPeriodStart) {
      const daysUntilNext = daysBetween(now, firstCycle.nextPeriodStart);
      if (daysUntilNext <= 3) {
        return { label: t("util_period.经前期"), sub: t("util_period.距离下次月经", {0: daysUntilNext}), color: "text-amber-600" };
      }
      return { label: t("util_period.安全期"), sub: t("util_period.距离下次月经", {0: daysUntilNext}), color: "text-green-600" };
    }

    return null;
  }, [predictions, periodDays]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ToolHeader title={t("util_period.title")} description={t("util_period.desc")} />

      <section className="card p-6 animate-slide-up">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">{t("util_period.label_last_period")}</label>
            <input
              type="date"
              value={lastPeriod}
              onChange={(e) => setLastPeriod(e.target.value)}
              className="input-base"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              {t("util_period.周期长度")}
              <span className="ml-2 text-xs text-zinc-400">{t("util_period.cycle_hint")}</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCycleLength((v) => Math.max(21, v - 1))}
                disabled={cycleLength <= 21}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-zinc-700 hover:bg-zinc-50 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                −
              </button>
              <input
                type="number"
                min={21}
                max={35}
                value={cycleLength}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!isNaN(v) && v >= 21 && v <= 35) setCycleLength(v);
                }}
                className="input-base text-center font-display text-lg font-semibold"
              />
              <button
                onClick={() => setCycleLength((v) => Math.min(35, v + 1))}
                disabled={cycleLength >= 35}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-zinc-700 hover:bg-zinc-50 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              {t("util_period.经期天数")}
              <span className="ml-2 text-xs text-zinc-400">{t("util_period.period_hint")}</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPeriodDays((v) => Math.max(2, v - 1))}
                disabled={periodDays <= 2}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-zinc-700 hover:bg-zinc-50 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                −
              </button>
              <input
                type="number"
                min={2}
                max={10}
                value={periodDays}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!isNaN(v) && v >= 2 && v <= 10) setPeriodDays(v);
                }}
                className="input-base text-center font-display text-lg font-semibold"
              />
              <button
                onClick={() => setPeriodDays((v) => Math.min(10, v + 1))}
                disabled={periodDays >= 10}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-zinc-700 hover:bg-zinc-50 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>{t("util_period.common_cycles")}</span>
          {[
            { label: t("util_period.cycle_21"), v: 21 },
            { label: t("util_period.cycle_25"), v: 25 },
            { label: t("util_period.cycle_28"), v: 28 },
            { label: t("util_period.cycle_30"), v: 30 },
            { label: t("util_period.cycle_32"), v: 32 },
            { label: t("util_period.cycle_35"), v: 35 },
          ].map((p) => (
            <button
              key={p.v}
              onClick={() => setCycleLength(p.v)}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                cycleLength === p.v
                  ? "bg-primary-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
          <span>{t("util_period.show_cycles")}</span>
          {[1, 2, 3, 4, 6].map((n) => (
            <button
              key={n}
              onClick={() => setShowCount(n)}
              className={`rounded-md px-2 py-0.5 transition-colors ${
                showCount === n
                  ? "bg-primary-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {n}
            </button>
          ))}
          <span className="ml-auto">{t("util_period.default_hint")}</span>
        </div>
      </section>

      {predictions.length > 0 && (
        <>
          {todayInfo && (
            <section className="mt-6 card p-5 animate-slide-up">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-zinc-500">{t("util_period.today_status")}</div>
                  <div className={`mt-1 font-display text-2xl font-bold ${todayInfo.color}`}>
                    {todayInfo.label}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">{todayInfo.sub}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500">{t("util_period.today")}</div>
                  <div className="font-mono text-sm text-zinc-700">
                    {formatDate(new Date())} {formatWeekday(new Date())}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="mt-6 space-y-4">
            {predictions.map((cycle) => (
              <div key={cycle.cycleIndex} className="card p-5 animate-slide-up">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-800">
                    {t("util_period.第个周期", {0: cycle.cycleIndex})}
                  </h3>
                  <span className="text-xs text-zinc-400">
                    {formatDate(cycle.periodStart)} ~ {formatDate(addDays(cycle.periodStart, cycleLength - 1))}
                  </span>
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-16 flex-shrink-0 text-xs text-zinc-500">{t("util_period.menstrual")}</span>
                    <div className="flex-1 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-rose-700 font-medium">
                          {formatRange(cycle.periodStart, cycle.periodEnd)}
                        </span>
                        <span className="text-xs text-rose-500">{t("util_common.共")} {periodDays} {t("util_common.天")}</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        {formatWeekday(cycle.periodStart)} ~ {formatWeekday(cycle.periodEnd)}
                      </div>
                    </div>
                  </div>

                  {cycle.safeBefore && (
                    <div className="flex items-center gap-3">
                      <span className="w-16 flex-shrink-0 text-xs text-zinc-500">{t("util_period.safe")}</span>
                      <div className="flex-1 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-green-700 font-medium">
                            {formatRange(cycle.safeBefore.start, cycle.safeBefore.end)}
                          </span>
                          <span className="text-xs text-green-500">{t("util_period.safe_before")}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <span className="w-16 flex-shrink-0 text-xs text-zinc-500">{t("util_period.fertile")}</span>
                    <div className="flex-1 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-orange-700 font-medium">
                          {formatRange(cycle.fertileStart, cycle.fertileEnd)}
                        </span>
                        <span className="text-xs text-orange-500">{t("util_period.fertile_hint")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="w-16 flex-shrink-0 text-xs text-zinc-500">{t("util_period.ovulation_day")}</span>
                    <div className="flex-1 rounded-lg bg-fuchsia-50 border border-fuchsia-200 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-fuchsia-700 font-semibold">
                          {formatShort(cycle.ovulationDay)} {formatWeekday(cycle.ovulationDay)}
                        </span>
                        <span className="text-xs text-fuchsia-500">{t("util_period.ovulation_hint")}</span>
                      </div>
                    </div>
                  </div>

                  {cycle.safeAfter && (
                    <div className="flex items-center gap-3">
                      <span className="w-16 flex-shrink-0 text-xs text-zinc-500">{t("util_period.safe")}</span>
                      <div className="flex-1 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-green-700 font-medium">
                            {formatRange(cycle.safeAfter.start, cycle.safeAfter.end)}
                          </span>
                          <span className="text-xs text-green-500">{t("util_period.safe_after")}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-100">
                  <div className="text-[11px] text-zinc-500 mb-2">{t("util_period.timeline")}</div>
                  <div className="relative flex h-8 rounded-lg overflow-hidden border border-zinc-200">
                    {(() => {
                      const total = cycleLength;
                      const segments: { width: number; bg: string; title: string }[] = [];
                      const periodDaysCount = periodDays;
                      const safeBeforeDays = cycle.safeBefore
                        ? daysBetween(cycle.safeBefore.start, cycle.safeBefore.end) + 1
                        : 0;
                      const fertileDays = daysBetween(cycle.fertileStart, cycle.fertileEnd) + 1;
                      const safeAfterDays = cycle.safeAfter
                        ? daysBetween(cycle.safeAfter.start, cycle.safeAfter.end) + 1
                        : 0;

                      segments.push({ width: periodDaysCount, bg: "bg-rose-400", title: t("util_period.menstrual") });
                      if (safeBeforeDays > 0)
                        segments.push({ width: safeBeforeDays, bg: "bg-green-300", title: t("util_period.safe") });
                      segments.push({ width: fertileDays, bg: "bg-orange-400", title: t("util_period.fertile") });
                      if (safeAfterDays > 0)
                        segments.push({ width: safeAfterDays, bg: "bg-green-300", title: t("util_period.safe") });

                      const ovulationPos = daysBetween(cycle.periodStart, cycle.ovulationDay);

                      return (
                        <>
                          {segments.map((s, i) => (
                            <div
                              key={i}
                              className={`${s.bg} h-full flex items-center justify-center text-[9px] text-white/90 font-medium`}
                              style={{ width: `${(s.width / total) * 100}%` }}
                              title={s.title}
                            />
                          ))}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-fuchsia-600 shadow-[0_0_0_2px_rgba(217,70,239,0.3)]"
                            style={{ left: `${(ovulationPos / total) * 100}%` }}
                            title={t("util_period.ovulation_day")}
                          />
                        </>
                      );
                    })()}
                  </div>
                  <div className="mt-1 flex justify-between text-[9px] text-zinc-400">
                    <span>{t("util_period.day1")}</span>
                    <span>{t("util_period.第天", {0: cycleLength})}</span>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="mt-6 card p-4">
            <h4 className="mb-3 text-xs font-semibold text-zinc-700">{t("util_period.legend")}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-6 rounded bg-rose-400" />
                <span className="text-zinc-600">{t("util_period.menstrual")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-6 rounded bg-orange-400" />
                <span className="text-zinc-600">{t("util_period.fertile")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-0.5 bg-fuchsia-600 h-4" />
                <span className="text-zinc-600">{t("util_period.ovulation_day")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-6 rounded bg-green-300" />
                <span className="text-zinc-600">{t("util_period.safe")}</span>
              </div>
            </div>
          </section>
        </>
      )}

      <p className="mt-5 text-center text-xs text-zinc-400">
        {t("util_period.本工具仅提供参考")}
      </p>
      <ToolUsage tool={getToolById("period")!} />
    </main>
  );
}
