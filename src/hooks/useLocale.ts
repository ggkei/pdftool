"use client";

import { useEffect, useState } from "react";
import { createT, type Locale } from "@/i18n/dictionary";

export function useLocale(): { locale: Locale; t: (key: string) => string } {
  const [locale, setLocale] = useState<Locale>("zh");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const lang = params.get("lang");
    if (lang === "en" || lang === "zh") {
      setLocale(lang);
      return;
    }
    const cookieMatch = document.cookie.match(/user_lang=(zh|en)/);
    if (cookieMatch) {
      setLocale(cookieMatch[1] as Locale);
    }
  }, []);

  const t = createT(locale);
  return { locale, t };
}
