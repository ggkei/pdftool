"use client";

import { useLocale } from "@/components/LocaleContext";
import { homeT, type Locale } from "@/lib/i18n";

export function PrivacyBadge({ compact = false, locale: propLocale }: { compact?: boolean; locale?: Locale }) {
  const ctxLocale = useLocale();
  const locale = propLocale ?? ctxLocale;
  const dict = homeT[locale];

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/70">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        {dict.privacyLabels[0]} · {dict.privacyLabels[1]}
      </div>
    );
  }

  const features = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      title: dict.privacyLabels[0],
      desc: dict.privacyDescs[0],
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          <path d="M12 6v6l4 2" />
        </svg>
      ),
      title: dict.privacyLabels[1],
      desc: dict.privacyDescs[1],
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      title: dict.privacyLabels[2],
      desc: dict.privacyDescs[2],
    },
  ];

  return (
    <div className="card overflow-hidden p-0">
      <div className="grid grid-cols-1 divide-y divide-slate-200/70 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
        {features.map((f) => (
          <div key={f.title} className="flex items-start gap-3 p-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <div className="h-5 w-5">{f.icon}</div>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900">{f.title}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
