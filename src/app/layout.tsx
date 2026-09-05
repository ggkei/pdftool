import type { Metadata } from "next";
import { headers, cookies } from "next/headers";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ClientProviders } from "@/components/ClientProviders";
import { createT, buildLocale } from "@/i18n/dictionary";

export async function generateMetadata(): Promise<Metadata> {
  let locale: "zh" | "en" = buildLocale;
  try {
    const h = headers();
    const cookie = h.get("cookie") || "";
    const match = cookie.match(/user_lang=(zh|en)/);
    if (match) locale = match[1] as "zh" | "en";
  } catch { /* fallback to buildLocale */ }
  const tt = createT(locale);
  return {
    title: tt("layout.title"),
    description: tt("layout.description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let locale: "zh" | "en" = buildLocale;
  try {
    const cookieStore = await cookies();
    const cookieLang = cookieStore.get("user_lang")?.value;
    if (cookieLang === "en" || cookieLang === "zh") {
      locale = cookieLang;
    }
  } catch { /* fallback to buildLocale */ }

  return (
    <html lang={locale}>
      <body className="min-h-screen font-sans text-zinc-900 antialiased">
        <ClientProviders>
          <div className="relative min-h-screen">
            <div
              className="pointer-events-none fixed inset-0 z-0 bg-grid-pattern bg-[length:32px_32px] opacity-[0.3]"
              aria-hidden
            />
            <div
              className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[480px] bg-radial-fade"
              aria-hidden
            />
            <div
              className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-[320px]"
              style={{ background: "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(124,58,237,0.04), transparent)" }}
              aria-hidden
            />
            <Navbar />
            <div className="relative z-10">{children}</div>
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
