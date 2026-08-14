import Link from "next/link";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { TOOLS, TOOL_GROUPS, PDF_TOOLS, UTIL_TOOLS } from "@/lib/tools";

interface ToolItem {
  title: string;
  description: string;
  href: string;
  icon: string;
  tag?: string;
  featured?: boolean;
  group: string;
}

const STATIC_EXTRAS: Record<string, { href: string; tag?: string; featured?: boolean }> = {
  merge: { href: "/pdf-merge" },
  split: { href: "/pdf-split" },
  rotate: { href: "/pdf-rotate" },
  watermark: { href: "/pdf-watermark" },
  "remove-watermark": { href: "/pdf-remove-watermark", tag: "热门", featured: true },
  "extract-image": { href: "/pdf-extract-image" },
  compress: { href: "/pdf-compress" },
  "to-image": { href: "/pdf-to-image" },
  ocr: { href: "/pdf-ocr" },
  "json-format": { href: "/util-json-format" },
  base64: { href: "/util-base64" },
  "url-encode": { href: "/util-url-encode" },
  hash: { href: "/util-hash" },
  timestamp: { href: "/util-timestamp" },
  color: { href: "/util-color" },
  regex: { href: "/util-regex" },
  "text-tools": { href: "/util-text-tools" },
  "unit-convert": { href: "/util-unit-convert" },
  qrcode: { href: "/util-qrcode", tag: "免费" },
  password: { href: "/util-password" },
  random: { href: "/util-random" },
  mortgage: { href: "/util-mortgage", tag: "实用" },
  currency: { href: "/util-currency" },
  "world-time": { href: "/util-world-time" },
  bmi: { href: "/util-bmi" },
  "cn-idcard": { href: "/util-cn-idcard" },
  "number-base": { href: "/util-number-base" },
  period: { href: "/util-period" },
};

const tools: ToolItem[] = TOOLS.map((t) => {
  const extra = STATIC_EXTRAS[t.id] ?? { href: `/${t.id}` };
  return {
    title: t.name,
    description: t.desc,
    href: extra.href,
    icon: t.icon,
    tag: extra.tag,
    featured: extra.featured,
    group: t.group,
  };
});

const ICON_PATHS: Record<string, React.ReactNode> = {
  merge: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 6h9a2 2 0 012 2v8a2 2 0 01-2 2H8m0-12H5a2 2 0 00-2 2v8a2 2 0 002 2h3m0-12v12" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 10l-2 2 2 2M14 14l2-2-2-2" /></>,
  split: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 4h10l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6M12 9v6" /></>,
  rotate: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 9a8 8 0 113 6.2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 9L4 4" /></>,
  watermark: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 3h12v4H6zM4 7v4a4 4 0 004 4h8a4 4 0 004-4V7" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 15v6h12v-6" /></>,
  eraser: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 17l8-8 6 6-8 8H5v-6z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7l6 6" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" strokeWidth={1.8} /><circle cx="9" cy="10" r="1.5" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 17l5-5 4 4 3-3 6 6" /></>,
  compress: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h7v7H4zM13 13h7v7h-7z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 11l2-2M13 13l-2-2" /></>,
  text: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5h16M12 5v14" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 19h8" /></>,
  code: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 6l-6 6 6 6M16 6l6 6-6 6M14 4l-4 16" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 11V7a4 4 0 118 0v4" /></>,
  link: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></>,
  fingerprint: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 11v1a2 2 0 01-2 2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8a4 4 0 014 4v1" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 11a4 4 0 118 0v2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 11a7 7 0 0114 7v1" /></>,
  clock: <><circle cx="12" cy="12" r="9" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 7v5l3 2" /></>,
  palette: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3a9 9 0 100 18c1.5 0 2-1 2-2 0-1.5 1-2 2-2h2a3 3 0 003-3 9 9 0 00-9-11z" /><circle cx="7.5" cy="10.5" r="1" fill="currentColor" /><circle cx="12" cy="7.5" r="1" fill="currentColor" /><circle cx="16.5" cy="10.5" r="1" fill="currentColor" /></>,
  search: <><circle cx="11" cy="11" r="7" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.3-4.3" /></>,
  type: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7V5a1 1 0 011-1h14a1 1 0 011 1v2M4 7h16M4 7v12a1 1 0 001 1h14a1 1 0 001-1V7M9 11v6M15 11v6M9 14h6" /></>,
  ruler: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7l18-3v16l-18 3zM7 7v4M11 6v5M15 5v6M19 5v6" /></>,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={1.8} /><rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={1.8} /><rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" /></>,
  key: <><circle cx="8" cy="15" r="4" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15h9M17 15v3M20 15v2" /></>,
  dice: <><rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={1.8} /><circle cx="8" cy="8" r="1.2" fill="currentColor" /><circle cx="16" cy="8" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="8" cy="16" r="1.2" fill="currentColor" /><circle cx="16" cy="16" r="1.2" fill="currentColor" /></>,
  home: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z" /></>,
  dollar: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v18M17 7H9a3 3 0 000 6h6a3 3 0 010 6H7" /></>,
  globe: <><circle cx="12" cy="12" r="9" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></>,
  heart: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 21s-7-4.5-9.5-9.5A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 5.5C19 16.5 12 21 12 21z" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={1.8} /><circle cx="9" cy="11" r="2" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 10h6M14 13h4" /></>,
  hex: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h2l-1 4h6l-1-4h2" /></>,
};

function ToolIcon({ name }: { name: string }) {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {ICON_PATHS[name] ?? ICON_PATHS.code}
    </svg>
  );
}

function ToolCard({ tool, index }: { tool: ToolItem; index: number }) {
  return (
    <Link
      href={tool.href}
      className="card card-hover group relative overflow-hidden"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {tool.tag && (
        <span className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tool.tag === "热门" ? "bg-brand-100 text-brand-700" : "bg-emerald-100 text-emerald-700"}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {tool.tag}
        </span>
      )}

      <div className="p-5">
        <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-all duration-300 group-hover:bg-brand-600 group-hover:text-white group-hover:shadow-glow">
          <ToolIcon name={tool.icon} />
        </div>
        <h3 className="mb-1 text-[15px] font-semibold text-zinc-900 group-hover:text-brand-700 transition-colors">
          {tool.title}
        </h3>
        <p className="text-[13px] leading-relaxed text-zinc-500">{tool.description}</p>

        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-600 opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
          开始使用
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const groupedTools: Record<string, ToolItem[]> = {};
  for (const t of tools) {
    (groupedTools[t.group] = groupedTools[t.group] || []).push(t);
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
      {/* Hero */}
      <section className="mb-14 text-center animate-fade-in">
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-1.5 text-xs font-medium text-brand-700 backdrop-blur shadow-soft">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
          </span>
          {TOOLS.length} 个工具已就绪 · 浏览器本地运行
        </div>

        <h1 className="font-display text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl text-balance">
          PDF 处理 · 实用工具
          <span className="block bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 bg-clip-text text-transparent">
            更安全 · 更私密 · 更全面
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-500 sm:text-lg text-balance">
          PDF 去水印、合并、拆分、压缩、OCR —
          <span className="font-medium text-zinc-700"> 所有处理都在你的浏览器本地完成</span>，
          同时提供 18+ 免费实用小工具（编码、计算、生活服务）。
        </p>
      </section>

      {/* Privacy banner */}
      <section className="mb-14 animate-slide-up" style={{ animationDelay: "120ms" }}>
        <PrivacyBadge />
      </section>

      {/* Groups */}
      {TOOL_GROUPS.map((groupKey, gi) => {
        const groupTools = groupedTools[groupKey];
        if (!groupTools || groupTools.length === 0) return null;
        const isPdf = groupKey === "PDF 工具";
        return (
          <section key={groupKey} className="mb-12 animate-slide-up" style={{ animationDelay: `${240 + gi * 60}ms` }}>
            <div className="mb-5 flex items-end justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold text-zinc-900 sm:text-2xl">
                  {groupKey}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {isPdf ? `${PDF_TOOLS.length} 个专业 PDF 处理工具` : `${groupTools.length} 个免费在线小工具`}
                </p>
              </div>
              <span className={`hidden rounded-full px-3 py-1 text-xs font-medium sm:inline-block ${isPdf ? "bg-brand-50 text-brand-600" : "bg-emerald-50 text-emerald-600"}`}>
                {isPdf ? "需登录解锁高级功能" : "完全免费"}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {groupTools.map((tool, i) => (
                <ToolCard key={tool.href} tool={tool} index={i} />
              ))}
            </div>
          </section>
        );
      })}

      {/* Footer */}
      <footer className="mt-20 border-t border-slate-200/70 pt-8 text-center">
        <div className="mx-auto max-w-md">
          <p className="text-xs text-zinc-400">
            © {new Date().getFullYear()} PDFTool · 纯前端架构 · 文件零上传
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">
            数据安全由你的浏览器全权守护
          </p>
        </div>
      </footer>
    </main>
  );
}
