"use client";

import { t } from "@/i18n/dictionary";

import { useMemo, useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const CHECK_CODES = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];

function validateChecksum(id: string): boolean {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(id[i], 10) * WEIGHTS[i];
  }
  const expected = CHECK_CODES[sum % 11];
  return id[17].toUpperCase() === expected;
}

function parseBirthDate(id: string): { date: string; valid: boolean } {
  const year = parseInt(id.slice(6, 10), 10);
  const month = parseInt(id.slice(10, 12), 10);
  const day = parseInt(id.slice(12, 14), 10);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return { date: t("util_cn_idcard.invalid_date"), valid: false };
  }
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return { date: t("util_cn_idcard.invalid_date"), valid: false };
  }
  return { date: t("util_cn_idcard.出生日期格式", {y: year, m: month, d: day}), valid: true };
}

function calculateAge(id: string): number | null {
  const year = parseInt(id.slice(6, 10), 10);
  const month = parseInt(id.slice(10, 12), 10);
  const day = parseInt(id.slice(12, 14), 10);
  const birth = new Date(year, month - 1, day);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

function getGender(id: string): { name: string; icon: string } {
  const digit = parseInt(id[16], 10);
  return digit % 2 === 1 ? { name: t("util_cn_idcard.male"), icon: "♂" } : { name: t("util_cn_idcard.female"), icon: "♀" };
}

const PROVINCES: Record<string, string> = {
  "11": t("util_cn_idcard.prov_11"), "12": t("util_cn_idcard.prov_12"), "13": t("util_cn_idcard.prov_13"), "14": t("util_cn_idcard.prov_14"), "15": t("util_cn_idcard.prov_15"),
  "21": t("util_cn_idcard.prov_21"), "22": t("util_cn_idcard.prov_22"), "23": t("util_cn_idcard.prov_23"),
  "31": t("util_cn_idcard.prov_31"), "32": t("util_cn_idcard.prov_32"), "33": t("util_cn_idcard.prov_33"), "34": t("util_cn_idcard.prov_34"), "35": t("util_cn_idcard.prov_35"), "36": t("util_cn_idcard.prov_36"), "37": t("util_cn_idcard.prov_37"),
  "41": t("util_cn_idcard.prov_41"), "42": t("util_cn_idcard.prov_42"), "43": t("util_cn_idcard.prov_43"), "44": t("util_cn_idcard.prov_44"), "45": t("util_cn_idcard.prov_45"), "46": t("util_cn_idcard.prov_46"),
  "50": t("util_cn_idcard.prov_50"), "51": t("util_cn_idcard.prov_51"), "52": t("util_cn_idcard.prov_52"), "53": t("util_cn_idcard.prov_53"), "54": t("util_cn_idcard.prov_54"),
  "61": t("util_cn_idcard.prov_61"), "62": t("util_cn_idcard.prov_62"), "63": t("util_cn_idcard.prov_63"), "64": t("util_cn_idcard.prov_64"), "65": t("util_cn_idcard.prov_65"),
};

interface ValidResult {
  valid: true;
  province: string;
  birthDate: string;
  age: number | null;
  gender: { name: string; icon: string };
  checkCode: string;
}

interface InvalidResult {
  valid: false;
  error: string;
}

type ValidationResult = ValidResult | InvalidResult;

export default function Page() {
  const [id, setId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const result = useMemo<ValidationResult | null>(() => {
    const trimmed = id.trim();
    if (!trimmed) return null;

    if (trimmed.length !== 18) {
      return { valid: false, error: t("util_cn_idcard.error_length") };
    }
    if (!/^\d{17}[\dXx]$/.test(trimmed)) {
      return { valid: false, error: t("util_cn_idcard.error_format") };
    }
    if (!validateChecksum(trimmed)) {
      return { valid: false, error: t("util_cn_idcard.error_checksum") };
    }

    const birth = parseBirthDate(trimmed);
    if (!birth.valid) {
      return { valid: false, error: t("util_cn_idcard.error_birth") };
    }

    const provinceCode = trimmed.slice(0, 2);
    return {
      valid: true,
      province: PROVINCES[provinceCode] || provinceCode + t("util_cn_idcard.未知地区"),
      birthDate: birth.date,
      age: calculateAge(trimmed),
      gender: getGender(trimmed),
      checkCode: trimmed[17].toUpperCase(),
    };
  }, [id]);

  const handleCopy = () => {
    if (result?.valid) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader title={t("util_cn_idcard.title")} description={t("util_cn_idcard.desc")} />

      <section className="card p-6 space-y-4 animate-slide-up">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">{t("util_cn_idcard.label_id")}</label>
          <input
            type="text"
            maxLength={18}
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder={t("util_cn_idcard.请输入18位身份证号")}
            className="input-base font-mono tracking-widest text-lg uppercase"
          />
        </div>

        {!result && (
          <div className="rounded-xl bg-zinc-50 p-4 text-center text-sm text-zinc-500">
            {t("util_cn_idcard.输入完整18位身份证号后自动验证")}
          </div>
        )}

        {result && !result.valid && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 animate-fade-in">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{result.error}</span>
            </div>
          </div>
        )}
      </section>

      {result && result.valid && (
        <section className="mt-6 card p-6 animate-slide-up">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
              <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="font-semibold text-green-700">{t("util_cn_idcard.valid_msg")}</span>
            <button
              onClick={handleCopy}
              className="ml-auto rounded-lg border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              {copied ? t("img_ocr.copied") : t("util_cn_idcard.复制号码")}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-primary-50 p-4">
              <div className="text-xs text-primary-600">{t("util_cn_idcard.label_region")}</div>
              <div className="mt-1 font-display text-xl font-bold text-primary-700">{result.province}</div>
            </div>
            <div className="rounded-xl bg-rose-50 p-4">
              <div className="text-xs text-rose-600">{t("util_cn_idcard.label_gender")}</div>
              <div className="mt-1 font-display text-xl font-bold text-rose-700 flex items-center gap-1">
                <span className="text-2xl">{result.gender.icon}</span>
                <span>{result.gender.name}</span>
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <div className="text-xs text-amber-600">{t("util_cn_idcard.label_birth")}</div>
              <div className="mt-1 font-display text-xl font-bold text-amber-700">{result.birthDate}</div>
            </div>
            <div className="rounded-xl bg-zinc-100 p-4">
              <div className="text-xs text-zinc-600">{t("util_cn_idcard.label_age")}</div>
              <div className="mt-1 font-display text-xl font-bold text-zinc-800">{result.age} {t("util_common.岁")}</div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <div className="text-xs text-zinc-500 mb-1">{t("util_cn_idcard.label_checksum")}</div>
            <div className="font-mono text-lg text-zinc-700">{t("util_cn_idcard.最后一位")} {result.checkCode}</div>
          </div>
        </section>
      )}

      <p className="mt-5 text-center text-xs text-zinc-400">
        {t("util_cn_idcard.所有计算在本地浏览器完成不会上传身份证信")}
      </p>
            <ToolUsage tool={getToolById("cn-idcard")!} />
</main>
  );
}
