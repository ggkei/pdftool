"use client";

import { useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t, getDateTimeLocale } from "@/i18n/dictionary";

interface DecodedJWT {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  exp?: string;
  iat?: string;
  error?: string;
}

export default function UtilJwtDecodePage() {
  const [token, setToken] = useState("");
  const [decoded, setDecoded] = useState<DecodedJWT | null>(null);

  const decode = () => {
    try {
      const parts = token.trim().split(".");
      if (parts.length !== 3) {
        setDecoded({ header: {}, payload: {}, signature: "", error: t("util_jwt_decode.error_format") });
        return;
      }
      const header = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      const result: DecodedJWT = {
        header,
        payload,
        signature: parts[2],
      };
      if (payload.exp) result.exp = new Date(payload.exp * 1000).toLocaleString(getDateTimeLocale());
      if (payload.iat) result.iat = new Date(payload.iat * 1000).toLocaleString(getDateTimeLocale());
      setDecoded(result);
    } catch {
      setDecoded({ header: {}, payload: {}, signature: "", error: t("util_jwt_decode.error_parse") });
    }
  };

  const tool = getToolById("jwt-decode")!;

  const isExpired = decoded?.payload && (decoded.payload as Record<string, number>).exp
    ? Date.now() > (decoded.payload as Record<string, number>).exp * 1000
    : false;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      <div className="mt-8 space-y-4">
        <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
          <label className="mb-2 block text-sm font-medium text-zinc-700">{t("util_jwt_decode.label_token")}</label>
          <textarea value={token} onChange={(e) => setToken(e.target.value)} rows={4}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono break-all" />
          <button onClick={decode} className="btn-primary mt-4" disabled={!token.trim()}>{t("util_base64.btn_decode")}</button>
        </div>

        {decoded?.error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">
            {decoded.error}
          </div>
        )}

        {decoded && !decoded.error && (
          <div className="space-y-4">
            {decoded.exp && (
              <div className={`rounded-xl p-4 text-sm ${isExpired ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {isExpired ? t("util_jwt_decode.status_expired") : t("util_jwt_decode.Token有效")} | {t("util_jwt_decode.过期时间")}: {decoded.exp}
                {decoded.iat && t("util_jwt_decode.签发时间").replace("{0}", String(decoded.iat))}
              </div>
            )}
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-3">Header</h3>
              <pre className="rounded-lg bg-slate-50 p-4 text-xs font-mono overflow-x-auto">{JSON.stringify(decoded.header, null, 2)}</pre>
            </div>
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-3">Payload</h3>
              <pre className="rounded-lg bg-slate-50 p-4 text-xs font-mono overflow-x-auto">{JSON.stringify(decoded.payload, null, 2)}</pre>
            </div>
            <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-3">Signature</h3>
              <code className="text-xs font-mono text-zinc-500 break-all">{decoded.signature}</code>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
