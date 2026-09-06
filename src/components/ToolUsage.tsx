"use client";

import Link from "next/link";
import type { ToolDef } from "@/lib/tools";
import { getToolHref, PDF_TOOLS, UTIL_TOOLS } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

export function ToolUsage({ tool }: { tool: ToolDef }) {
  const relatedGroup = tool.category === "pdf" ? PDF_TOOLS : UTIL_TOOLS;
  const related = relatedGroup
    .filter((t) => t.id !== tool.id)
    .slice(0, 6);

  return (
    <div className="mt-16 space-y-10 border-t border-slate-200 pt-12 animate-fade-in">
      {/* 工具介绍 */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-600">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          {t("common.tool_intro")}
        </h2>
        <p className="text-sm leading-relaxed text-zinc-600">{tool.intro}</p>
      </section>

      {/* 使用说明 */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-600">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </span>
          {t("common.tool_usage")}
        </h2>
        <ol className="space-y-3">
          {tool.usage.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-xs font-semibold text-white shadow-soft">
                {i + 1}
              </span>
              <span className="pt-0.5 text-sm leading-relaxed text-zinc-700">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 小贴士 */}
      {tool.tips && tool.tips.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-600">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            {t("common.tool_tips")}
          </h2>
          <ul className="space-y-2">
            {tool.tips.map((tip, i) => (
              <li key={i} className="flex gap-2 rounded-lg bg-amber-50/60 px-4 py-2.5 text-sm text-amber-900">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 相关工具 */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">{t("common.related_tools")}</h2>
        <div className="flex flex-wrap gap-2">
          {related.map((rt) => (
            <Link
              key={rt.id}
              href={getToolHref(rt)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                rt.category === "pdf"
                  ? "bg-brand-50 text-brand-700 hover:bg-brand-100"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {t(`tools.${rt.id}.name`)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
