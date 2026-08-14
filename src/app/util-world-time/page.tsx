"use client";

import { useEffect, useMemo, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

interface City {
  name: string;
  timezone: string;
  flag: string;
}

const CITIES: City[] = [
  { name: "北京", timezone: "Asia/Shanghai", flag: "🇨🇳" },
  { name: "东京", timezone: "Asia/Tokyo", flag: "🇯🇵" },
  { name: "伦敦", timezone: "Europe/London", flag: "🇬🇧" },
  { name: "纽约", timezone: "America/New_York", flag: "🇺🇸" },
  { name: "洛杉矶", timezone: "America/Los_Angeles", flag: "🇺🇸" },
  { name: "悉尼", timezone: "Australia/Sydney", flag: "🇦🇺" },
  { name: "迪拜", timezone: "Asia/Dubai", flag: "🇦🇪" },
  { name: "新加坡", timezone: "Asia/Singapore", flag: "🇸🇬" },
  { name: "莫斯科", timezone: "Europe/Moscow", flag: "🇷🇺" },
  { name: "巴黎", timezone: "Europe/Paris", flag: "🇫🇷" },
];

function getTimeParts(timezone: string, date: Date) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  const s = parts.find((p) => p.type === "second")?.value ?? "00";
  return { time: `${h}:${m}:${s}`, date: dateFormatter.format(date) };
}

function getOffsetFromBeijing(timezone: string, date: Date): string {
  const bj = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
  const tz = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  const diff = (tz.getTime() - bj.getTime()) / 1000 / 60;
  const hours = Math.floor(diff / 60);
  const mins = Math.abs(Math.round(diff % 60));
  if (hours === 0 && mins === 0) return "与北京同时区";
  const sign = hours >= 0 ? "+" : "";
  const h = Math.abs(hours);
  if (mins === 0) return `UTC ${sign}${hours} 小时`;
  return `UTC ${sign}${hours}:${mins.toString().padStart(2, "0")}`;
}

function getTZOffsetLabel(timezone: string, date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(date);
  const tzPart = parts.find((p) => p.type === "timeZoneName");
  return tzPart?.value ?? "";
}

function getLocalISOString(date: Date, timezone: string): string {
  const yearFmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric" });
  const monthFmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, month: "2-digit" });
  const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, day: "2-digit" });
  const hourFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  });
  const minFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    minute: "2-digit",
  });
  const y = yearFmt.format(date);
  const m = monthFmt.format(date);
  const d = dayFmt.format(date);
  const h = hourFmt.format(date).padStart(2, "0");
  const min = minFmt.format(date).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function tzTimeToUTC(dateStr: string, timezone: string): Date | null {
  if (!dateStr) return null;
  const [ymd, hms] = dateStr.split("T");
  if (!ymd || !hms) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, min] = hms.split(":").map(Number);
  if ([y, m, d, h, min].some((v) => isNaN(v))) return null;

  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const nowY = parts.find((p) => p.type === "year")?.value;
  const nowM = parts.find((p) => p.type === "month")?.value;
  const nowD = parts.find((p) => p.type === "day")?.value;
  const nowH = parts.find((p) => p.type === "hour")?.value;
  const nowMin = parts.find((p) => p.type === "minute")?.value;

  const nowUtc = Date.UTC(
    Number(nowY),
    Number(nowM) - 1,
    Number(nowD),
    Number(nowH),
    Number(nowMin)
  );
  const targetLocal = Date.UTC(y, m - 1, d, h, min);
  const localOffsetMs = nowUtc - now.getTime();
  return new Date(targetLocal - localOffsetMs);
}

function formatTZTime(date: Date, timezone: string): { date: string; time: string; weekday: string } {
  const dateFmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const weekdayFmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    weekday: "long",
  });
  return {
    date: dateFmt.format(date),
    time: timeFmt.format(date),
    weekday: weekdayFmt.format(date),
  };
}

export default function Page() {
  const [now, setNow] = useState<Date>(() => new Date());
  const [fromCity, setFromCity] = useState<string>("Asia/Shanghai");
  const [toCity, setToCity] = useState<string>("America/New_York");
  const [inputTime, setInputTime] = useState<string>("");

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setInputTime(getLocalISOString(new Date(), fromCity));
  }, [fromCity]);

  const beijingTime = useMemo(() => getTimeParts("Asia/Shanghai", now), [now]);

  const convertResult = useMemo(() => {
    if (!inputTime) return null;
    const utcDate = tzTimeToUTC(inputTime, fromCity);
    if (!utcDate) return null;
    const fromCityObj = CITIES.find((c) => c.timezone === fromCity)!;
    const toCityObj = CITIES.find((c) => c.timezone === toCity)!;
    const fromFormatted = formatTZTime(utcDate, fromCity);
    const toFormatted = formatTZTime(utcDate, toCity);
    const fromOffset = getTZOffsetLabel(fromCity, utcDate);
    const toOffset = getTZOffsetLabel(toCity, utcDate);

    const fromDateFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: fromCity,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const toDateFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: toCity,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const diffMs =
      new Date(toDateFmt.format(utcDate)).getTime() -
      new Date(fromDateFmt.format(utcDate)).getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));

    return {
      fromCity: fromCityObj,
      toCity: toCityObj,
      fromFormatted,
      toFormatted,
      fromOffset,
      toOffset,
      diffHours,
    };
  }, [inputTime, fromCity, toCity]);

  const handleSwap = () => {
    const prevFrom = fromCity;
    const prevTo = toCity;
    setFromCity(prevTo);
    setToCity(prevFrom);
    setInputTime(getLocalISOString(new Date(), prevTo));
  };

  const quickSetNow = () => {
    setInputTime(getLocalISOString(new Date(), fromCity));
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ToolHeader title="世界时钟" description="实时查看全球主要城市时间 + 时区转换" />

      <section className="card p-6 mb-6 animate-slide-up">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-600"></span>
            </span>
            北京时间
          </div>
          <div className="font-display text-4xl sm:text-5xl font-bold text-zinc-900 tracking-wider">
            {beijingTime.time}
          </div>
          <div className="mt-2 text-sm text-zinc-500">{beijingTime.date}</div>
        </div>
      </section>

      <section className="card p-6 mb-6 animate-slide-up">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-zinc-800">
          <svg className="h-5 w-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          时区转换器
        </h2>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700">源时区</label>
            <select
              value={fromCity}
              onChange={(e) => setFromCity(e.target.value)}
              className="input-base"
            >
              {CITIES.map((c) => (
                <option key={c.timezone} value={c.timezone}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={inputTime}
              onChange={(e) => setInputTime(e.target.value)}
              className="input-base font-mono"
            />
          </div>

          <button
            onClick={handleSwap}
            className="mb-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white shadow-soft hover:bg-primary-700 active:scale-95 transition-transform"
            title="交换时区"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700">目标时区</label>
            <select
              value={toCity}
              onChange={(e) => setToCity(e.target.value)}
              className="input-base"
            >
              {CITIES.map((c) => (
                <option key={c.timezone} value={c.timezone}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            <div className="h-10 flex items-center">
              {convertResult && (
                <div className="text-xs text-zinc-500">
                  {convertResult.diffHours === 0
                    ? "同时区"
                    : convertResult.diffHours > 0
                    ? `目标快 ${convertResult.diffHours} 小时`
                    : `目标慢 ${Math.abs(convertResult.diffHours)} 小时`}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={quickSetNow}
            className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 transition-colors"
          >
            当前时间
          </button>
          <button
            onClick={() => setInputTime(getLocalISOString(new Date(Date.now() + 3600000), fromCity))}
            className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 transition-colors"
          >
            +1 小时
          </button>
          <button
            onClick={() => setInputTime(getLocalISOString(new Date(Date.now() + 86400000), fromCity))}
            className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 transition-colors"
          >
            +1 天
          </button>
        </div>

        {convertResult && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-slide-up">
            <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-700 mb-2">
                <span className="text-lg">{convertResult.fromCity.flag}</span>
                {convertResult.fromCity.name} · {convertResult.fromOffset}
              </div>
              <div className="font-display text-2xl font-bold text-zinc-900 tracking-wider">
                {convertResult.fromFormatted.time}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {convertResult.fromFormatted.date} {convertResult.fromFormatted.weekday}
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-primary-50 to-purple-50 border border-primary-100 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-primary-700 mb-2">
                <span className="text-lg">{convertResult.toCity.flag}</span>
                {convertResult.toCity.name} · {convertResult.toOffset}
              </div>
              <div className="font-display text-2xl font-bold text-primary-700 tracking-wider">
                {convertResult.toFormatted.time}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {convertResult.toFormatted.date} {convertResult.toFormatted.weekday}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CITIES.map((city) => {
          const parts = getTimeParts(city.timezone, now);
          const offset = getOffsetFromBeijing(city.timezone, now);
          return (
            <div
              key={city.timezone}
              className="card p-5 animate-slide-up hover:border-primary-200 hover:shadow-card transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{city.flag}</span>
                  <span className="font-semibold text-zinc-800">{city.name}</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {city.timezone.split("/")[1] || city.timezone}
                </span>
              </div>
              <div className="font-display text-2xl font-bold text-zinc-900 tracking-wider">
                {parts.time}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                <span>{parts.date}</span>
                <span
                  className={`px-2 py-0.5 rounded-full ${
                    offset === "与北京同时区"
                      ? "bg-green-100 text-green-700"
                      : offset.startsWith("UTC -")
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {offset}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      <p className="mt-6 text-center text-xs text-zinc-400">
        时间基于浏览器系统时钟计算，依赖 Intl.DateTimeFormat API
      </p>
      <ToolUsage tool={getToolById("world-time")!} />
    </main>
  );
}
