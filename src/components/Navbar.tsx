"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PDF_TOOLS, UTIL_TOOLS, TOOL_GROUPS, getToolHref, type ToolDef } from "@/lib/tools";
import { useUser } from "@/components/UserContext";
import { LoginModal } from "@/components/LoginModal";
import { useLocale } from "@/components/LocaleContext";
import { homeT, groupName, toolName, toolDesc, t } from "@/lib/i18n";

const ICON_PATHS: Record<string, React.ReactNode> = {
  merge: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 6h9a2 2 0 012 2v8a2 2 0 01-2 2H8m0-12H5a2 2 0 00-2 2v8a2 2 0 002 2h3m0-12v12" />,
  split: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 4h10l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />,
  rotate: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h5M4 9a8 8 0 113 6.2M9 9L4 4" />,
  watermark: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 3h12v4H6zM4 7v4a4 4 0 004 4h8a4 4 0 004-4V7M6 15v6h12v-6" />,
  eraser: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 17l8-8 6 6-8 8H5v-6zM13 7l6 6" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" strokeWidth={1.8} /><circle cx="9" cy="10" r="1.5" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 17l5-5 4 4 3-3 6 6" /></>,
  compress: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h7v7H4zM13 13h7v7h-7zM11 11l2-2M13 13l-2-2" />,
  text: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5h16M12 5v14M8 19h8" />,
  code: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 6l-6 6 6 6M16 6l6 6-6 6M14 4l-4 16" />,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 11V7a4 4 0 118 0v4" /></>,
  link: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />,
  fingerprint: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 11v1a2 2 0 01-2 2M12 8a4 4 0 014 4v1M8 11a4 4 0 118 0v2M5 11a7 7 0 0114 7v1" />,
  clock: <><circle cx="12" cy="12" r="9" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 7v5l3 2" /></>,
  palette: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3a9 9 0 100 18c1.5 0 2-1 2-2 0-1.5 1-2 2-2h2a3 3 0 003-3 9 9 0 00-9-11z" />,
  search: <><circle cx="11" cy="11" r="7" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.3-4.3" /></>,
  type: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7V5a1 1 0 011-1h14a1 1 0 011 1v2M4 7h16M4 7v12a1 1 0 001 1h14a1 1 0 001-1V7M9 11v6M15 11v6M9 14h6" />,
  ruler: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7l18-3v16l-18 3zM7 7v4M11 6v5M15 5v6M19 5v6" />,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={1.8} /><rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={1.8} /><rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" /></>,
  key: <><circle cx="8" cy="15" r="4" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15h9M17 15v3M20 15v2" /></>,
  dice: <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={1.8} />,
  home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z" />,
  dollar: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v18M17 7H9a3 3 0 000 6h6a3 3 0 010 6H7" />,
  globe: <><circle cx="12" cy="12" r="9" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></>,
  heart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 21s-7-4.5-9.5-9.5A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 5.5C19 16.5 12 21 12 21z" />,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={1.8} /><circle cx="9" cy="11" r="2" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 10h6M14 13h4" /></>,
  hex: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z" />,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={1.8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 2v4M8 2v4M3 10h18" /></>,
};

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={className || "h-4 w-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {ICON_PATHS[name] ?? ICON_PATHS.code}
    </svg>
  );
}

function ToolListGrid({ tools }: { tools: ToolDef[] }) {
  const locale = useLocale();
  return (
    <div className="grid grid-cols-2 gap-1">
      {tools.map((t) => (
        <Link
          key={t.id}
          href={getToolHref(t)}
          className="group flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
            <Icon name={t.icon} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-zinc-800">{toolName(t.id, locale)}</span>
            <span className="block truncate text-[11px] text-zinc-500">{toolDesc(t.id, locale)}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function UtilGroupSection({ group, tools, onSelect }: { group: string; tools: ToolDef[]; onSelect: () => void }) {
  const locale = useLocale();
  return (
    <section>
      <h4 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {groupName(group, locale)}
        <span className="h-px flex-1 bg-slate-100" />
        <span className="text-[10px] text-zinc-400">{tools.length}</span>
      </h4>
      <div className="grid grid-cols-2 gap-1">
        {tools.map((t) => (
          <Link
            key={t.id}
            href={getToolHref(t)}
            onClick={onSelect}
            className="group flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-slate-50"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
              <Icon name={t.icon} className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-zinc-800">{toolName(t.id, locale)}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Dropdown({
  label,
  children,
  isOpen,
  onOpen,
  onClose,
  icon,
  active,
  width = "w-[560px]",
}: {
  label: string;
  children: React.ReactNode;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  icon: React.ReactNode;
  active: boolean;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    if (isOpen) {
      document.addEventListener("mousedown", handler);
    }
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        onMouseEnter={onOpen}
        onClick={() => (isOpen ? onClose() : onOpen())}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isOpen || active ? "text-brand-600" : "text-zinc-700 hover:text-brand-600"
        }`}
      >
        {icon}
        {label}
        <svg className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          onMouseLeave={onClose}
          className={`absolute left-0 top-full z-50 mt-2 ${width} origin-top-left rounded-2xl border border-slate-200 bg-white p-4 shadow-card animate-slide-up`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const locale = useLocale();
  const dict = homeT[locale];
  const [openMenu, setOpenMenu] = useState<"pdf" | "util" | null>(null);
  const { user, loading, openLogin, logout } = useUser();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpenMenu(null);
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pdfActive = pathname.startsWith("/pdf-");
  const utilActive = pathname.startsWith("/util-");

  const utilGroups: Record<string, ToolDef[]> = {};
  for (const g of TOOL_GROUPS) {
    if (g === "PDF 工具") continue;
    utilGroups[g] = UTIL_TOOLS.filter((t) => t.group === g);
  }

  const tierBadgeClass = (tier: string) => {
    switch (tier) {
      case "forever": return "bg-gradient-to-r from-amber-400 to-amber-500 text-white";
      case "three_year": return "bg-purple-100 text-purple-700";
      case "year": return "bg-violet-100 text-violet-700";
      case "half_year": return "bg-cyan-100 text-cyan-700";
      case "month": return "bg-blue-100 text-blue-700";
      default: return "bg-zinc-100 text-zinc-700";
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-5">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 mr-3 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden transition-transform group-hover:scale-105">
            <img src="/logo.png" alt="AtoolX" className="h-full w-full object-contain" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-zinc-900">AtoolX</span>
        </Link>

        <span className="h-4 w-px bg-slate-200" />

        <div className="flex items-center gap-1 ml-2 flex-1">
          <Link
            href="/"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname === "/" ? "text-brand-600" : "text-zinc-600 hover:text-brand-600"
            }`}
          >
            {dict.nav.home}
          </Link>

          <Dropdown
            label={dict.nav.pdfTools}
            isOpen={openMenu === "pdf"}
            onOpen={() => setOpenMenu("pdf")}
            onClose={() => setOpenMenu(null)}
            active={pdfActive}
            width="w-[520px]"
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 4h10l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
              </svg>
            }
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{dict.nav.pdfTools}</span>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-600">
                {t("nav.items", locale, { n: PDF_TOOLS.length })}
              </span>
            </div>
            <ToolListGrid tools={PDF_TOOLS} />
          </Dropdown>

          <Dropdown
            label={dict.nav.utilities}
            isOpen={openMenu === "util"}
            onOpen={() => setOpenMenu("util")}
            onClose={() => setOpenMenu(null)}
            active={utilActive}
            width="w-[820px]"
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" strokeWidth={1.8} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            }
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{dict.nav.utilities}</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                {t("nav.items", locale, { n: UTIL_TOOLS.length })}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(utilGroups).map(([group, tools]) =>
                tools.length > 0 ? (
                  <UtilGroupSection
                    key={group}
                    group={group}
                    tools={tools}
                    onSelect={() => setOpenMenu(null)}
                  />
                ) : null
              )}
            </div>
          </Dropdown>
        </div>

        {/* Right side: user area */}
        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-100" />
          ) : user ? (
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  user.isMember
                    ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "bg-slate-50 text-zinc-700 hover:bg-slate-100"
                }`}
              >
                {user.isMember && user.tierInfo && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tierBadgeClass(user.membershipTier || "")}`}>
                    {user.tierInfo.name}
                  </span>
                )}
                <span className="max-w-[120px] truncate">
                  {user.nickname || user.email?.split("@")[0] || dict.nav.user}
                </span>
                <svg className={`h-3 w-3 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-slide-up rounded-xl border border-slate-200 bg-white p-2 shadow-card">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="text-sm font-medium text-zinc-800 truncate">{user.email}</div>
                    {user.isMember ? (
                      <div className="mt-0.5 text-[11px] text-amber-600">
                        {user.remainingDays === -1 ? dict.nav.forever : t("nav.remainingDays", locale, { n: user.remainingDays })}
                      </div>
                    ) : (
                      <div className="mt-0.5 text-[11px] text-zinc-400">{dict.nav.notMember}</div>
                    )}
                  </div>
                  <Link
                    href="/account"
                    onClick={() => setUserMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-xs text-zinc-600 hover:bg-slate-50"
                  >
                    {dict.nav.account}
                  </Link>
                  <button
                    onClick={() => { logout(); setUserMenuOpen(false); }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                  >
                    {dict.nav.logout}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => openLogin()}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {dict.nav.login}
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
