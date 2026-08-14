"use client";

import { useMemo, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";
const AMBIGUOUS = /[O0Il1|]/g;

function pickRandom(chars: string, len: number): string {
  let s = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) {
    s += chars[arr[i] % chars.length];
  }
  return s;
}

function generatePwd(
  length: number,
  opts: { upper: boolean; lower: boolean; digits: boolean; symbols: boolean; excludeAmbiguous: boolean }
): string {
  let pool = "";
  let required: string[] = [];
  if (opts.upper) {
    const s = opts.excludeAmbiguous ? UPPER.replace(AMBIGUOUS, "") : UPPER;
    pool += s;
    required.push(pickRandom(s, 1));
  }
  if (opts.lower) {
    const s = opts.excludeAmbiguous ? LOWER.replace(AMBIGUOUS, "") : LOWER;
    pool += s;
    required.push(pickRandom(s, 1));
  }
  if (opts.digits) {
    const s = opts.excludeAmbiguous ? DIGITS.replace(AMBIGUOUS, "") : DIGITS;
    pool += s;
    required.push(pickRandom(s, 1));
  }
  if (opts.symbols) {
    pool += SYMBOLS;
    required.push(pickRandom(SYMBOLS, 1));
  }
  if (!pool) pool = LOWER;
  const extraLen = Math.max(0, length - required.length);
  const extra = pickRandom(pool, extraLen);
  const combined = [...required.join(""), ...extra];
  const arr = new Uint32Array(combined.length);
  crypto.getRandomValues(arr);
  for (let i = combined.length - 1; i > 0; i--) {
    const j = arr[i] % (i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join("").slice(0, length);
}

function calcStrength(pwd: string, opts: { upper: boolean; lower: boolean; digits: boolean; symbols: boolean }): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: "—", color: "bg-slate-300" };
  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (pwd.length >= 12) score += 1;
  if (pwd.length >= 16) score += 1;
  let variety = 0;
  if (opts.upper) variety++;
  if (opts.lower) variety++;
  if (opts.digits) variety++;
  if (opts.symbols) variety++;
  score += Math.min(variety - 1, 3);

  if (score <= 2) return { score: 25, label: "弱", color: "bg-red-500" };
  if (score <= 4) return { score: 55, label: "中", color: "bg-amber-500" };
  if (score <= 6) return { score: 80, label: "强", color: "bg-emerald-500" };
  return { score: 100, label: "极强", color: "bg-green-600" };
}

export default function UtilPasswordPage() {
  const [length, setLength] = useState(16);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  const opts = { upper, lower, digits, symbols, excludeAmbiguous };
  const strength = useMemo(
    () => calcStrength(password, { upper, lower, digits, symbols }),
    [password, upper, lower, digits, symbols]
  );

  const doGenerate = () => {
    const pwd = generatePwd(length, opts);
    setPassword(pwd);
    setCopied(false);
  };

  const copy = async () => {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const Checkbox = ({
    checked,
    onChange,
    label,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
  }) => (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <span
        onClick={() => onChange(!checked)}
        className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
          checked ? "border-primary-600 bg-primary-600" : "border-slate-300 bg-white"
        }`}
      >
        {checked && (
          <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span className="text-sm text-zinc-700">{label}</span>
    </label>
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ToolHeader title="密码生成器" description="自定义长度与字符类型，生成高强度随机密码" />

      <div className="rounded-2xl bg-white/60 backdrop-blur shadow-soft border border-slate-200/70 p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-inner">
          <div className="flex items-center gap-3">
            <code className="flex-1 break-all font-mono text-lg text-zinc-900 tracking-wider">
              {password
                ? visible
                  ? password
                  : "•".repeat(password.length)
                : "点击下方按钮生成密码"}
            </code>
            {password && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setVisible((v) => !v)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:border-primary-400 hover:text-primary-600"
                  title={visible ? "隐藏" : "显示"}
                >
                  {visible ? "🙈" : "👁"}
                </button>
                <button
                  onClick={copy}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-primary-600 hover:border-primary-400"
                >
                  {copied ? "✓ 已复制" : "复制"}
                </button>
              </div>
            )}
          </div>
          {password && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-500">密码强度</span>
                <span className="font-semibold text-zinc-700">{strength.label}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                  style={{ width: `${strength.score}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 grid md:grid-cols-2 gap-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              密码长度: <span className="text-primary-600 font-semibold">{length}</span>
            </label>
            <input
              type="range"
              min={4}
              max={64}
              value={length}
              onChange={(e) => setLength(+e.target.value)}
              className="w-full"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
              <span>4</span>
              <span>64</span>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-500">字符类型</label>
            <div className="grid grid-cols-2 gap-2">
              <Checkbox checked={upper} onChange={setUpper} label="大写 A-Z" />
              <Checkbox checked={lower} onChange={setLower} label="小写 a-z" />
              <Checkbox checked={digits} onChange={setDigits} label="数字 0-9" />
              <Checkbox checked={symbols} onChange={setSymbols} label="特殊符号" />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Checkbox
            checked={excludeAmbiguous}
            onChange={setExcludeAmbiguous}
            label="排除易混淆字符 (O / 0 / I / l / 1)"
          />
        </div>

        <button
          onClick={doGenerate}
          className="mt-5 w-full rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-primary-700 hover:shadow-glow active:scale-[0.98] transition"
        >
          🎲 生成随机密码
        </button>
      </div>
            <ToolUsage tool={getToolById("password")!} />
</main>
  );
}
