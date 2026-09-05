"use client";

import { useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

export default function UtilUuidPage() {
  const [count, setCount] = useState(5);
  const [uppercase, setUppercase] = useState(true);
  const [hyphens, setHyphens] = useState(true);
  const [results, setResults] = useState<string[]>([]);
  const [copied, setCopied] = useState(-1);

  const generate = () => {
    const uuids: string[] = [];
    for (let i = 0; i < count; i++) {
      const uuid = generateUUID();
      let formatted = hyphens ? uuid : uuid.replace(/-/g, "");
      if (uppercase) formatted = formatted.toUpperCase();
      uuids.push(formatted);
    }
    setResults(uuids);
  };

  const generateUUID = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (crypto.getRandomValues(new Uint8Array(1))[0] % 16);
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const copy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(-1), 1500);
  };

  const copyAll = () => {
    navigator.clipboard.writeText(results.join("\n"));
    setCopied(-2);
    setTimeout(() => setCopied(-1), 1500);
  };

  const tool = getToolById("uuid")!;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      <div className="mt-8 rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">{t("util_uuid.生成数量")}</label>
            <input type="number" min="1" max="100" value={count}
              onChange={(e) => setCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-600 mt-6">
            <input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300" />{t("util_uuid.大写")}</label>
          <label className="flex items-center gap-2 text-sm text-zinc-600 mt-6">
            <input type="checkbox" checked={hyphens} onChange={(e) => setHyphens(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300" />
            {t("util_uuid.连字符")}
          </label>
          <button onClick={generate} className="btn-primary mt-6">{t("util_uuid.生成")}</button>
          {results.length > 0 && (
            <button onClick={copyAll} className="btn-secondary mt-6">
              {copied === -2 ? t("util_common.copied") : t("util_uuid.复制全部")}
            </button>
          )}
        </div>

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((uuid, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5">
                <code className="text-sm font-mono text-zinc-700">{uuid}</code>
                <button onClick={() => copy(uuid, i)}
                  className="text-xs text-brand-600 hover:text-brand-700">
                  {copied === i ? t("util_common.copied") : t("util_common.copy")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
