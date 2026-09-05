"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { t } from "@/i18n/dictionary";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const [isZh, setIsZh] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    setMounted(true);
    const host = window.location.hostname;
    // Dev mode: localhost defaults to Chinese
    const dev = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
    setIsDev(dev);

    // Priority: URL param > cookie > hostname
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get("lang");
    if (urlLang === "en" || urlLang === "zh") {
      setIsZh(urlLang === "zh");
      // Auto-sync URL param to cookie so navigation keeps the language
      document.cookie = `user_lang=${urlLang}; path=/; domain=.atoolx.cn; max-age=31536000; SameSite=Lax`;
      document.cookie = `user_lang=${urlLang}; path=/; max-age=31536000; SameSite=Lax`;
      return;
    }

    const cookieMatch = document.cookie.match(/user_lang=(zh|en)/);
    if (cookieMatch) {
      setIsZh(cookieMatch[1] === "zh");
      return;
    }

    if (dev) {
      setIsZh(true); // localhost defaults to zh
    } else {
      setIsZh(host.includes("atoolx.cn"));
    }
  }, []);

  const switchTo = (lang: "zh" | "en") => {
    // Set cookie for current domain (and localhost fallback)
    document.cookie = `user_lang=${lang}; path=/; domain=.atoolx.cn; max-age=31536000; SameSite=Lax`;
    document.cookie = `user_lang=${lang}; path=/; max-age=31536000; SameSite=Lax`;

    const host = window.location.hostname;
    const isCnDomain = host === "atoolx.cn" || host === "www.atoolx.cn";
    const isComDomain = host === "atoolx.com" || host === "www.atoolx.com";

    if (isCnDomain && lang === "en") {
      // 中文站切英文 → 跳转英文站并保留路径
      window.location.href = `https://atoolx.com${pathname}?lang=en`;
      return;
    }
    if (isComDomain && lang === "zh") {
      // 英文站切中文 → 跳转中文站并保留路径
      window.location.href = `https://atoolx.cn${pathname}?lang=zh`;
      return;
    }

    // Dev / 其他域名：用 URL 参数切换
    const url = new URL(window.location.href);
    url.searchParams.set("lang", lang);
    window.location.href = url.toString();
  };

  // Avoid hydration mismatch: render neutral state until mounted
  const zhClass = mounted && isZh ? "text-brand-600 font-semibold" : "text-zinc-400";
  const enClass = mounted && !isZh ? "text-brand-600 font-semibold" : "text-zinc-400";

  return (
    <div className={`flex items-center gap-1.5 text-xs ${className}`}>
      <button
        onClick={() => switchTo("zh")}
        className={`rounded-md px-1.5 py-0.5 transition-all hover:bg-brand-50 ${zhClass}`}
      >
        {t("common.lang_zh")}
      </button>
      <span className="text-zinc-300">|</span>
      <button
        onClick={() => switchTo("en")}
        className={`rounded-md px-1.5 py-0.5 transition-all hover:bg-brand-50 ${enClass}`}
      >
        English
      </button>
    </div>
  );
}
