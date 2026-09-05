"use client";

import { useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

interface UAInfo {
  browser: string;
  browserVersion: string;
  engine: string;
  os: string;
  device: string;
  deviceType: string;
}

function parseUA(ua: string): UAInfo {
  const result: UAInfo = {
    browser: t("common.unknown"), browserVersion: "", engine: t("common.unknown"),
    os: t("common.unknown"), device: t("common.unknown"), deviceType: t("util_user_agent.桌面端"),
  };

  if (!ua) return result;

  // Browser
  if (ua.includes("Edg/")) {
    result.browser = "Microsoft Edge";
    result.browserVersion = ua.match(/Edg\/([\d.]+)/)?.[1] || "";
  } else if (ua.includes("Chrome/") && !ua.includes("Edg/")) {
    result.browser = "Chrome";
    result.browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || "";
  } else if (ua.includes("Firefox/")) {
    result.browser = "Firefox";
    result.browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || "";
  } else if (ua.includes("Safari/") && !ua.includes("Chrome")) {
    result.browser = "Safari";
    result.browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] || "";
  }

  // Engine
  if (ua.includes("Gecko/")) result.engine = "Gecko";
  if (ua.includes("AppleWebKit/")) result.engine = "WebKit (Blink)";
  if (ua.includes("Trident/")) result.engine = "Trident";

  // OS
  if (ua.includes("Windows NT 10")) result.os = "Windows 10/11";
  else if (ua.includes("Windows NT 6.3")) result.os = "Windows 8.1";
  else if (ua.includes("Windows NT 6.1")) result.os = "Windows 7";
  else if (ua.includes("Mac OS X")) {
    const v = ua.match(/Mac OS X ([\d_]+)/)?.[1].replace(/_/g, ".");
    result.os = `macOS ${v || ""}`;
  } else if (ua.includes("Android")) {
    const v = ua.match(/Android ([\d.]+)/)?.[1];
    result.os = `Android ${v || ""}`;
  } else if (ua.includes("iPhone OS") || ua.includes("CPU OS")) {
    const v = ua.match(/OS ([\d_]+)/)?.[1].replace(/_/g, ".");
    result.os = `iOS ${v || ""}`;
  } else if (ua.includes("Linux")) result.os = "Linux";

  // Device
  if (ua.includes("iPhone")) { result.device = "iPhone"; result.deviceType = t("util_user_agent.手机"); }
  else if (ua.includes("iPad")) { result.device = "iPad"; result.deviceType = t("util_user_agent.平板"); }
  else if (ua.includes("Android") && !ua.includes("Mobile")) { result.device = t("util_user_agent.Android平板"); result.deviceType = t("util_user_agent.平板"); }
  else if (ua.includes("Android")) { result.device = t("util_user_agent.Android手机"); result.deviceType = t("util_user_agent.手机"); }

  return result;
}

export default function UtilUserAgentPage() {
  const [input, setInput] = useState("");
  const [info, setInfo] = useState<UAInfo | null>(null);

  const analyze = () => {
    setInfo(parseUA(input.trim()));
  };

  const useCurrent = () => {
    const ua = navigator.userAgent;
    setInput(ua);
    setInfo(parseUA(ua));
  };

  const tool = getToolById("user-agent")!;

  const items = info ? [
    { label: t("util_user_agent.浏览器"), value: `${info.browser} ${info.browserVersion}` },
    { label: t("util_user_agent.渲染引擎"), value: info.engine },
    { label: t("util_user_agent.操作系统"), value: info.os },
    { label: t("util_user_agent.设备"), value: info.device },
    { label: t("util_user_agent.设备类型"), value: info.deviceType },
  ] : [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      <div className="mt-8 space-y-4">
        <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
          <label className="mb-2 block text-sm font-medium text-zinc-700">{t("util_user_agent.UserAgent字符串")}</label>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={4}
            placeholder={t("util_user_agent.粘贴UA")}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono break-all" />
          <div className="mt-4 flex gap-3">
            <button onClick={analyze} className="btn-primary" disabled={!input.trim()}>{t("util_crontab.解析")}</button>
            <button onClick={useCurrent} className="btn-secondary">{t("util_user_agent.使用当前浏览器UA")}</button>
          </div>
        </div>

        {info && (
          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
            <h3 className="text-sm font-semibold text-zinc-700 mb-4">{t("util_user_agent.解析结果")}</h3>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.label} className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-sm text-zinc-500">{item.label}</span>
                  <span className="text-sm font-medium text-zinc-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
