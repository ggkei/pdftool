"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t, getLangQuery } from "@/i18n/dictionary";

/* ── SQL 词法分析 ─────────────────────────── */

type TokenType =
  | "keyword"
  | "function"
  | "string"
  | "number"
  | "comment"
  | "operator"
  | "punctuation"
  | "identifier"
  | "whitespace";

interface Token {
  type: TokenType;
  value: string;
}

const KEYWORDS = new Set([
  "SELECT","FROM","WHERE","INSERT","UPDATE","DELETE","CREATE","DROP","ALTER","TABLE",
  "JOIN","LEFT","RIGHT","INNER","OUTER","ON","AND","OR","NOT","NULL","IS","IN","EXISTS",
  "BETWEEN","LIKE","LIMIT","OFFSET","ORDER","BY","GROUP","HAVING","UNION","ALL","DISTINCT",
  "AS","ASC","DESC","VALUES","SET","INTO","IF","ELSE","WHEN","THEN","CASE","END","WITH",
  "RECURSIVE","RETURNING","PRIMARY","KEY","FOREIGN","REFERENCES","UNIQUE","INDEX","CONSTRAINT",
  "DEFAULT","AUTO_INCREMENT","SERIAL","VARCHAR","CHAR","TEXT","INT","INTEGER","BIGINT",
  "SMALLINT","TINYINT","DECIMAL","NUMERIC","FLOAT","DOUBLE","REAL","BOOLEAN","DATE","TIME",
  "DATETIME","TIMESTAMP","BLOB","JSON","ARRAY","BEGIN","COMMIT","ROLLBACK","TRANSACTION",
  "GRANT","REVOKE","PRIVILEGES","TO","FOR","FROM","DATABASE","SCHEMA","VIEW","TRIGGER",
  "PROCEDURE","FUNCTION","EXEC","EXECUTE","CALL","DECLARE","CURSOR","FETCH","OPEN","CLOSE",
]);

const FUNCTIONS = new Set([
  "COUNT","SUM","AVG","MAX","MIN","COALESCE","NVL","IFNULL","NULLIF","LENGTH","CHAR_LENGTH",
  "SUBSTRING","SUBSTR","TRIM","LTRIM","RTRIM","UPPER","LOWER","REPLACE","CONCAT","CONCAT_WS",
  "FORMAT","ROUND","CEIL","FLOOR","ABS","SIGN","MOD","POWER","SQRT","EXP","LN","LOG","LOG10",
  "SIN","COS","TAN","ASIN","ACOS","ATAN","ATAN2","RADIANS","DEGREES","PI","RAND","RANDOM",
  "NOW","CURRENT_DATE","CURRENT_TIME","CURRENT_TIMESTAMP","DATE","TIME","YEAR","MONTH","DAY",
  "HOUR","MINUTE","SECOND","EXTRACT","DATE_ADD","DATE_SUB","DATEDIFF","TIMESTAMPDIFF",
  "STR_TO_DATE","DATE_FORMAT","TO_CHAR","TO_DATE","TO_NUMBER","CAST","CONVERT","TRY_CAST",
  "JSON_OBJECT","JSON_ARRAY","JSON_EXTRACT","JSON_SET","JSON_REMOVE","JSON_MERGE","JSON_TYPE",
  "ROW_NUMBER","RANK","DENSE_RANK","NTILE","LEAD","LAG","FIRST_VALUE","LAST_VALUE","NTH_VALUE",
  "PARTITION","OVER","RANGE","ROWS","PRECEDING","FOLLOWING","UNBOUNDED","CURRENT","ROW",
]);

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  function peek(n = 1) {
    return sql.slice(i, i + n);
  }

  function consume(n: number) {
    const v = sql.slice(i, i + n);
    i += n;
    return v;
  }

  while (i < sql.length) {
    const ch = sql[i];

    // 单行注释 --
    if (ch === "-" && peek(2) === "--") {
      let v = "";
      while (i < sql.length && sql[i] !== "\n") v += consume(1);
      tokens.push({ type: "comment", value: v });
      continue;
    }

    // 多行注释 /* */
    if (ch === "/" && peek(2) === "/*") {
      let v = consume(2);
      while (i < sql.length && !(v.endsWith("*/"))) v += consume(1);
      tokens.push({ type: "comment", value: v });
      continue;
    }

    // 字符串 '...' / "..." / `...`
    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch;
      let v = consume(1);
      while (i < sql.length) {
        const c = consume(1);
        v += c;
        if (c === quote && (v.length < 2 || v[v.length - 2] !== "\\")) break;
      }
      tokens.push({ type: "string", value: v });
      continue;
    }

    // 数字
    if (/\d/.test(ch)) {
      let v = "";
      while (i < sql.length && (/\d/.test(sql[i]) || sql[i] === ".")) v += consume(1);
      tokens.push({ type: "number", value: v });
      continue;
    }

    // 空白
    if (/\s/.test(ch)) {
      let v = "";
      while (i < sql.length && /\s/.test(sql[i])) v += consume(1);
      tokens.push({ type: "whitespace", value: v });
      continue;
    }

    // 运算符 / 标点
    const two = peek(2);
    if (["!=","<>",">=","<=","||","->","->>","::","<<",">>","&&"].includes(two)) {
      tokens.push({ type: "operator", value: consume(2) });
      continue;
    }
    if (["+","-","*","/","=",">","<","!","%","&","|","^","~","?"].includes(ch)) {
      tokens.push({ type: "operator", value: consume(1) });
      continue;
    }
    if (["(",")","[","]","{","}",",",";",".",":"].includes(ch)) {
      tokens.push({ type: "punctuation", value: consume(1) });
      continue;
    }

    // 标识符 / 关键字 / 函数
    let v = "";
    while (i < sql.length && /[A-Za-z0-9_\$]/.test(sql[i])) v += consume(1);
    const upper = v.toUpperCase();
    let type: TokenType = "identifier";
    if (KEYWORDS.has(upper)) type = "keyword";
    else if (FUNCTIONS.has(upper)) type = "function";
    tokens.push({ type, value: v });
  }

  return tokens;
}

/* ── 格式化引擎 ────────────────────────────── */

function formatSql(sql: string): string {
  const tokens = tokenize(sql);
  let result = "";
  let indent = 0;
  let prev: Token | null = null;

  function newline() {
    result = result.trimEnd();
    result += "\n" + "  ".repeat(indent);
  }

  function needsSpaceBefore(t: Token, p: Token | null): boolean {
    if (!p) return false;
    if (p.type === "whitespace") return false;
    if (t.type === "punctuation" && [",",".",")","]","}"].includes(t.value)) return false;
    if (p.type === "punctuation" && ["(","[","{","."].includes(p.value)) return false;
    return true;
  }

  for (let idx = 0; idx < tokens.length; idx++) {
    const t = tokens[idx];
    const next = tokens[idx + 1] ?? null;

    if (t.type === "whitespace") {
      // 在适当位置保留一个空格
      if (prev && needsSpaceBefore(next ?? t, prev)) {
        if (!result.endsWith(" ") && !result.endsWith("\n")) result += " ";
      }
      continue;
    }

    if (t.type === "comment") {
      newline();
      result += t.value;
      newline();
      continue;
    }

    const upper = t.value.toUpperCase();

    // 主要关键字换行并缩进
    if (t.type === "keyword" && ["SELECT","FROM","WHERE","JOIN","LEFT","RIGHT","INNER","OUTER","CROSS","UNION","INTERSECT","EXCEPT","GROUP","ORDER","HAVING","LIMIT","OFFSET","WITH","INSERT","UPDATE","DELETE","CREATE","ALTER","DROP","VALUES","SET","ON","AND","OR"].includes(upper)) {
      if (result && !result.endsWith("\n")) result += " ";
      // 缩进调整
      if (["SELECT","INSERT","UPDATE","DELETE","WITH","CREATE","ALTER","DROP"].includes(upper)) {
        indent = 0;
      } else if (["FROM","WHERE","JOIN","LEFT","RIGHT","INNER","OUTER","CROSS","UNION","INTERSECT","EXCEPT","GROUP","ORDER","HAVING","LIMIT","OFFSET","VALUES","SET","ON"].includes(upper)) {
        indent = 1;
      } else if (["AND","OR"].includes(upper)) {
        indent = Math.max(1, indent);
      }
      newline();
      result += upper;
      prev = t;
      continue;
    }

    if (needsSpaceBefore(t, prev)) {
      if (!result.endsWith(" ") && !result.endsWith("\n")) result += " ";
    }

    if (t.value === "(") {
      indent++;
    } else if (t.value === ")") {
      indent = Math.max(0, indent - 1);
    }

    result += t.value;
    prev = t;
  }

  return result.trim();
}

function minifySql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

/* ── HTML 高亮 ─────────────────────────────── */

function highlightSql(sql: string): string {
  const tokens = tokenize(sql);
  return tokens
    .map((t) => {
      const esc = t.value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      switch (t.type) {
        case "keyword":
          return `<span class="text-purple-600 font-semibold">${esc}</span>`;
        case "function":
          return `<span class="text-blue-600">${esc}</span>`;
        case "string":
          return `<span class="text-green-600">${esc}</span>`;
        case "number":
          return `<span class="text-amber-600">${esc}</span>`;
        case "comment":
          return `<span class="text-slate-400 italic">${esc}</span>`;
        case "operator":
          return `<span class="text-red-500">${esc}</span>`;
        case "punctuation":
          return `<span class="text-slate-500">${esc}</span>`;
        default:
          return esc;
      }
    })
    .join("");
}

/* ── 页面组件 ────────────────────────────── */

export default function Page() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"format" | "minify">("format");
  const [copied, setCopied] = useState(false);

  const lineCount = useMemo(() => (output ? output.split("\n").length : 0), [output]);
  const charCount = useMemo(() => output.length, [output]);

  function doFormat() {
    if (!input.trim()) { setOutput(""); return; }
    setMode("format");
    setOutput(formatSql(input));
  }

  function doMinify() {
    if (!input.trim()) { setOutput(""); return; }
    setMode("minify");
    setOutput(minifySql(input));
  }

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function clearAll() {
    setInput(""); setOutput(""); setMode("format");
  }

  function sampleInput() {
    setInput(
`SELECT u.id, u.name, u.email, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active'
  AND u.created_at >= '2024-01-01'
GROUP BY u.id, u.name, u.email
HAVING COUNT(o.id) > 5
ORDER BY order_count DESC
LIMIT 20 OFFSET 0;`
    );
  }

  const highlighted = useMemo(() => {
    if (!output) return "";
    return highlightSql(output);
  }, [output]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-10 animate-fade-in">
        <Link href={"/" + getLangQuery()} className="group mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-brand-600">
          <svg className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("util_common.back_to_toolbox")}
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">{t("util_sql_format.SQL格式化")}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">{t("util_json_format.btn_format")}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 输入区 */}
        <section className="rounded-2xl border border-slate-200/70 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-600 text-xs font-semibold">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </span>
              <h2 className="text-sm font-semibold text-zinc-800">{t("util_base64.输入")}</h2>
              <span className="text-[11px] text-zinc-400">{input.length} {t("util_common.字符")}</span>
            </div>
            <button onClick={sampleInput} className="text-xs text-brand-600 hover:text-brand-700 font-medium">{t("util_url_encode.填充示例")}</button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("util_common.粘贴SQL语句例如SELECT")}
            spellCheck={false}
            className="h-[420px] w-full resize-none bg-transparent px-5 py-4 font-mono text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-none scrollbar-thin"
          />
        </section>

        {/* 输出区 */}
        <section className="rounded-2xl border border-slate-200/70 bg-white shadow-soft flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-green-50 text-green-600 text-xs font-semibold">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <h2 className="text-sm font-semibold text-zinc-800">{t("util_base64.输出")}</h2>
              <span className="text-[11px] text-zinc-400">{lineCount} {t("util_common.行")} · {charCount} {t("util_common.字符")}</span>
            </div>
            <button onClick={copyOutput} disabled={!output}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:bg-slate-50 disabled:opacity-40">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? t("util_common.copied") : t("util_common.copy")}
            </button>
          </div>

          {/* 语法高亮输出 */}
          <div className="flex-1 overflow-auto">
            {output ? (
              <pre
                className="px-5 py-4 font-mono text-[13px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: highlighted }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-300">
                {t("util_sql_format.格式化结果将显示在这里")}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 操作栏 */}
      <div className="mt-5 rounded-2xl border border-slate-200/70 bg-white shadow-soft p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={doFormat}
            className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-card active:scale-[0.98] transition-all ${
              mode === "format"
                ? "bg-brand-600 text-white hover:bg-brand-700 hover:shadow-glow"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            {t("util_json_format.btn_format")}
          </button>
          <button onClick={doMinify}
            className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-soft active:scale-[0.98] transition-all ${
              mode === "minify"
                ? "bg-brand-600 text-white hover:bg-brand-700 hover:shadow-glow"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            {t("util_json_format.btn_minify")}
          </button>
          <div className="ml-auto flex items-center gap-3 text-xs text-zinc-400">
            <span>{t("util_sql_format.支持SELECTINSERTUPDATE")}</span>
            <button onClick={clearAll} className="text-zinc-400 hover:text-red-500 transition-colors font-medium">{t("util_common.clear")}</button>
          </div>
        </div>
      </div>

      <ToolUsage tool={getToolById("sql-format")!} />
    </main>
  );
}
