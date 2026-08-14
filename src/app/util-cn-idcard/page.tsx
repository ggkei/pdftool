"use client";

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
    return { date: "无效", valid: false };
  }
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return { date: "无效", valid: false };
  }
  return { date: `${year}年${month}月${day}日`, valid: true };
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
  return digit % 2 === 1 ? { name: "男", icon: "♂" } : { name: "女", icon: "♀" };
}

const PROVINCES: Record<string, string> = {
  "11": "北京", "12": "天津", "13": "河北", "14": "山西", "15": "内蒙古",
  "21": "辽宁", "22": "吉林", "23": "黑龙江",
  "31": "上海", "32": "江苏", "33": "浙江", "34": "安徽", "35": "福建", "36": "江西", "37": "山东",
  "41": "河南", "42": "湖北", "43": "湖南", "44": "广东", "45": "广西", "46": "海南",
  "50": "重庆", "51": "四川", "52": "贵州", "53": "云南", "54": "西藏",
  "61": "陕西", "62": "甘肃", "63": "青海", "64": "宁夏", "65": "新疆",
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
      return { valid: false, error: "身份证号必须为 18 位" };
    }
    if (!/^\d{17}[\dXx]$/.test(trimmed)) {
      return { valid: false, error: "格式不正确，应为 17 位数字加 1 位数字或 X" };
    }
    if (!validateChecksum(trimmed)) {
      return { valid: false, error: "校验位不正确，该身份证号不存在" };
    }

    const birth = parseBirthDate(trimmed);
    if (!birth.valid) {
      return { valid: false, error: "出生日期无效" };
    }

    const provinceCode = trimmed.slice(0, 2);
    return {
      valid: true,
      province: PROVINCES[provinceCode] || provinceCode + " (未知地区)",
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
      <ToolHeader title="身份证验证器" description="校验 18 位中国居民身份证号的合法性，提取出生日期、性别、年龄" />

      <section className="card p-6 space-y-4 animate-slide-up">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">身份证号</label>
          <input
            type="text"
            maxLength={18}
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="请输入 18 位身份证号"
            className="input-base font-mono tracking-widest text-lg uppercase"
          />
        </div>

        {!result && (
          <div className="rounded-xl bg-zinc-50 p-4 text-center text-sm text-zinc-500">
            输入完整 18 位身份证号后自动验证
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
            <span className="font-semibold text-green-700">身份证号有效</span>
            <button
              onClick={handleCopy}
              className="ml-auto rounded-lg border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              {copied ? "✓ 已复制" : "复制号码"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-primary-50 p-4">
              <div className="text-xs text-primary-600">归属地</div>
              <div className="mt-1 font-display text-xl font-bold text-primary-700">{result.province}</div>
            </div>
            <div className="rounded-xl bg-rose-50 p-4">
              <div className="text-xs text-rose-600">性别</div>
              <div className="mt-1 font-display text-xl font-bold text-rose-700 flex items-center gap-1">
                <span className="text-2xl">{result.gender.icon}</span>
                <span>{result.gender.name}</span>
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <div className="text-xs text-amber-600">出生日期</div>
              <div className="mt-1 font-display text-xl font-bold text-amber-700">{result.birthDate}</div>
            </div>
            <div className="rounded-xl bg-zinc-100 p-4">
              <div className="text-xs text-zinc-600">年龄</div>
              <div className="mt-1 font-display text-xl font-bold text-zinc-800">{result.age} 岁</div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <div className="text-xs text-zinc-500 mb-1">校验码</div>
            <div className="font-mono text-lg text-zinc-700">最后一位 {result.checkCode}</div>
          </div>
        </section>
      )}

      <p className="mt-5 text-center text-xs text-zinc-400">
        所有计算在本地浏览器完成，不会上传身份证信息
      </p>
            <ToolUsage tool={getToolById("cn-idcard")!} />
</main>
  );
}
