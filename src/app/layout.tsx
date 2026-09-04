import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ClientProviders } from "@/components/ClientProviders";
import { headers } from "next/headers";
import { getLocaleFromHostname, homeT } from "@/lib/i18n";
import { LocaleProvider } from "@/components/LocaleContext";

export async function generateMetadata(): Promise<Metadata> {
  const host = headers().get("host") || "";
  const locale = getLocaleFromHostname(host);
  const dict = homeT[locale];
  return {
    title: dict.metaTitle,
    description: dict.metaDescription,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const host = headers().get("host") || "";
  const locale = getLocaleFromHostname(host);
  const lang = homeT[locale].lang;

  return (
    <html lang={lang}>
      <body className="min-h-screen font-sans text-zinc-900 antialiased">
        <LocaleProvider locale={locale}>
          <ClientProviders>
            <div className="relative min-h-screen">
              <div
                className="pointer-events-none fixed inset-0 z-0 bg-grid-pattern bg-[length:32px_32px] opacity-[0.35]"
                aria-hidden
              />
              <div
                className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[420px] bg-radial-fade"
                aria-hidden
              />
              <Navbar />
              <div className="relative z-10">{children}</div>
            </div>
          </ClientProviders>
        </LocaleProvider>
      </body>
    </html>
  );
}
