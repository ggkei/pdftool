"use client";

import { useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

export default function UtilCrontabPage() {
  const [minute, setMinute] = useState("*");
  const [hour, setHour] = useState("*");
  const [day, setDay] = useState("*");
  const [month, setMonth] = useState("*");
  const [weekday, setWeekday] = useState("*");
  const [parseInput, setParseInput] = useState("");
  const [parsedDesc, setParsedDesc] = useState("");

  const cron = `${minute} ${hour} ${day} ${month} ${weekday}`;

  const describe = (cron: string): string => {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return t("util_crontab.格式错误需要5段分时日月周");
    const [m, h, d, mon, w] = parts;
    const desc: string[] = [];

    const fieldDesc = (val: string, unit: string) => {
      if (val === "*") return t("util_crontab.每").replace("{0}", unit);
      if (val.startsWith("*/")) return t("util_crontab.每隔").replace("{0}", val.slice(2)).replace("{1}", unit);
      if (val.includes(",")) return t("util_crontab.指定").replace("{0}", unit).replace("{1}", val);
      if (val.includes("-")) return `${val.split("-")[0]}-${val.split("-")[1]} ${unit}`;
      return `${val} ${unit}`;
    };

    desc.push(fieldDesc(m, t("util_crontab.分钟")));
    desc.push(fieldDesc(h, t("util_crontab.小时")));
    desc.push(fieldDesc(d, t("util_crontab.日")));
    desc.push(fieldDesc(mon, t("util_crontab.月")));
    desc.push(fieldDesc(w, t("util_crontab.周")));
    return desc.join(", ");
  };

  const parse = () => {
    setParsedDesc(describe(parseInput));
  };

  const tool = getToolById("crontab")!;

  const fields = [
    { label: t("util_crontab.分钟"), value: minute, set: setMinute, placeholder: "0-59 / * / */5" },
    { label: t("util_crontab.小时"), value: hour, set: setHour, placeholder: "0-23 / * / */2" },
    { label: t("util_crontab.日"), value: day, set: setDay, placeholder: "1-31 / *" },
    { label: t("util_crontab.月"), value: month, set: setMonth, placeholder: "1-12 / *" },
    { label: t("util_crontab.周"), value: weekday, set: setWeekday, placeholder: "0-6 / *" },
  ];

  const quickPresets = [
    { label: t("util_crontab.每分钟"), vals: ["*", "*", "*", "*", "*"] },
    { label: t("util_crontab.每小时"), vals: ["0", "*", "*", "*", "*"] },
    { label: t("util_crontab.每天0点"), vals: ["0", "0", "*", "*", "*"] },
    { label: t("util_crontab.每天8点"), vals: ["0", "8", "*", "*", "*"] },
    { label: t("util_crontab.每周一9点"), vals: ["0", "9", "*", "*", "1"] },
    { label: t("util_crontab.每月1号"), vals: ["0", "0", "1", "*", "*"] },
    { label: t("util_crontab.每5分钟"), vals: ["*/5", "*", "*", "*", "*"] },
    { label: t("util_crontab.每30分钟"), vals: ["*/30", "*", "*", "*", "*"] },
  ];

  const applyPreset = (vals: string[]) => {
    setMinute(vals[0]); setHour(vals[1]); setDay(vals[2]); setMonth(vals[3]); setWeekday(vals[4]);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      <div className="mt-8 space-y-4">
        <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
          <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("util_crontab.生成Cron表达式")}</h3>
          <div className="grid grid-cols-5 gap-3 mb-4">
            {fields.map((f) => (
              <div key={f.label}>
                <label className="mb-1 block text-center text-xs font-medium text-zinc-500">{f.label}</label>
                <input type="text" value={f.value} onChange={(e) => f.set(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-sm font-mono" />
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-brand-50 p-4 mb-4">
            <code className="text-lg font-mono font-semibold text-brand-700">{cron}</code>
            <p className="mt-2 text-sm text-zinc-600">{describe(cron)}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickPresets.map((p) => (
              <button key={p.label} onClick={() => applyPreset(p.vals)}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-zinc-600 hover:bg-slate-200">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
          <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("util_crontab.解析Cron表达式")}</h3>
          <div className="flex gap-3">
            <input type="text" value={parseInput} onChange={(e) => setParseInput(e.target.value)}
              placeholder="*/5 * * * *"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono" />
            <button onClick={parse} className="btn-primary" disabled={!parseInput.trim()}>{t("util_crontab.解析")}</button>
          </div>
          {parsedDesc && (
            <p className="mt-4 text-sm text-zinc-600">{parsedDesc}</p>
          )}
        </div>
      </div>
    </main>
  );
}
