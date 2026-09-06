"use client";

import Link from "next/link";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { t } from "@/i18n/dictionary";

export function ToolHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="mb-10 animate-fade-in">
      <Link
        href="/"
        className="group mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-brand-600"
      >
        <svg className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
        </svg>
        {t("common.back_to_tools")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
            {description}
          </p>
        </div>
        <PrivacyBadge compact />
      </div>
    </header>
  );
}
