"use client";

import { useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

type RuleType = "redirect" | "auth" | "hotlink" | "error" | "compress";

export default function UtilHtaccessPage() {
  const [ruleType, setRuleType] = useState<RuleType>("redirect");
  const [redirectFrom, setRedirectFrom] = useState("/old-page");
  const [redirectTo, setRedirectTo] = useState("/new-page");
  const [redirectCode, setRedirectCode] = useState("301");
  const [authUser, setAuthUser] = useState("admin");
  const [authPass, setAuthPass] = useState("");
  const [protectedPath, setProtectedPath] = useState("/admin");
  const [hotlinkDomains, setHotlinkDomains] = useState("example.com");
  const [error404, setError404] = useState("/404.html");
  const [copied, setCopied] = useState(false);

  const generate = (): string => {
    switch (ruleType) {
      case "redirect":
        return `# ${redirectCode} ${t("util_htaccess.重定向")}\nRewriteEngine On\nRewriteRule ^${redirectFrom.replace(/^\//, "")}$ ${redirectTo} [R=${redirectCode},L]\n`;
      case "auth":
        const htpasswd = authPass ? `\n# ${t("util_htaccess.生成htpasswd")}\n# htpasswd -c .htpasswd ${authUser}` : "";
        return `# ${t("util_htaccess.密码保护")}\nAuthType Basic\nAuthName "Restricted Area"\nAuthUserFile /path/to/.htpasswd\nRequire valid-user${htpasswd}\n`;
      case "hotlink":
        const domains = hotlinkDomains.split(",").map((d) => d.trim()).join(" ");
        return `# ${t("util_htaccess.防盗链")}\nRewriteEngine On\nRewriteCond %{HTTP_REFERER} !^$\nRewriteCond %{HTTP_REFERER} !^https?://(www\\.)?(${domains})/ [NC]\nRewriteRule \\.(jpg|jpeg|png|gif|bmp|webp|svg|css|js)$ - [F]\n`;
      case "error":
        return `# ${t("util_htaccess.自定义错误页面")}\nErrorDocument 404 ${error404}\nErrorDocument 403 /403.html\nErrorDocument 500 /500.html\n`;
      case "compress":
        return `# Gzip ${t("util_htaccess.压缩")}\n<IfModule mod_deflate.c>\n  AddOutputFilterByType DEFLATE text/html text/plain text/css text/javascript application/javascript application/json\n  AddOutputFilterByType DEFLATE image/svg+xml application/xml\n</IfModule>\n# ${t("util_htaccess.浏览器缓存")}\n<IfModule mod_expires.c>\n  ExpiresActive On\n  ExpiresByType image/jpg "access plus 1 year"\n  ExpiresByType image/png "access plus 1 year"\n  ExpiresByType text/css "access plus 1 month"\n  ExpiresByType application/javascript "access plus 1 month"\n</IfModule>\n`;
    }
  };

  const result = generate();

  const copy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tool = getToolById("htaccess")!;

  const ruleTypes: { id: RuleType; label: string }[] = [
    { id: "redirect", label: t("util_htaccess.301重定向") },
    { id: "auth", label: t("util_htaccess.密码保护") },
    { id: "hotlink", label: t("util_htaccess.防盗链") },
    { id: "error", label: t("util_htaccess.错误页面") },
    { id: "compress", label: t("util_htaccess.Gzip压缩") },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      <div className="mt-8 space-y-4">
        <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
          <div className="flex flex-wrap gap-2 mb-6">
            {ruleTypes.map((r) => (
              <button key={r.id} onClick={() => setRuleType(r.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  ruleType === r.id ? "bg-brand-600 text-white" : "bg-slate-100 text-zinc-600 hover:bg-slate-200"
                }`}>{r.label}</button>
            ))}
          </div>

          {ruleType === "redirect" && (
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("util_htaccess.源路径")}</label>
                <input type="text" value={redirectFrom} onChange={(e) => setRedirectFrom(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("util_htaccess.目标路径")}</label>
                <input type="text" value={redirectTo} onChange={(e) => setRedirectTo(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("util_htaccess.状态码")}</label>
                <select value={redirectCode} onChange={(e) => setRedirectCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="301">{t("util_htaccess.301永久")}</option>
                  <option value="302">{t("util_htaccess.302临时")}</option>
                </select>
              </div>
            </div>
          )}
          {ruleType === "auth" && (
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("util_htaccess.用户名")}</label>
                <input type="text" value={authUser} onChange={(e) => setAuthUser(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("util_htaccess.密码提示用")}</label>
                <input type="text" value={authPass} onChange={(e) => setAuthPass(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{t("util_htaccess.保护路径")}</label>
                <input type="text" value={protectedPath} onChange={(e) => setProtectedPath(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono" />
              </div>
            </div>
          )}
          {ruleType === "hotlink" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">{t("util_htaccess.允许的域名逗号分隔")}</label>
              <input type="text" value={hotlinkDomains} onChange={(e) => setHotlinkDomains(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
          )}
          {ruleType === "error" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">{t("util_htaccess.404错误页面路径")}</label>
              <input type="text" value={error404} onChange={(e) => setError404(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono" />
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-zinc-500">{t("util_htaccess.htaccess代码")}</span>
            <button onClick={copy} className="text-xs text-brand-600 hover:text-brand-700">
              {copied ? t("util_common.copied") : t("util_common.copy")}
            </button>
          </div>
          <pre className="rounded-lg bg-slate-900 p-4 text-xs font-mono text-green-400 overflow-x-auto">{result}</pre>
        </div>
      </div>
    </main>
  );
}
