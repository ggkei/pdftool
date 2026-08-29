import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ClientProviders } from "@/components/ClientProviders";

export const metadata: Metadata = {
  title: "AtoolX - 纯浏览器端 PDF 工具箱",
  description: "去水印、合并、拆分、旋转、加水印、压缩、转图片、OCR，全部在浏览器本地处理，文件不上传服务器，隐私零风险。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen font-sans text-zinc-900 antialiased">
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
      </body>
    </html>
  );
}
