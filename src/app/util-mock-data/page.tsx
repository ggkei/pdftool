"use client";

import { useState } from "react";
import { ToolHeader } from "@/components/ToolHeader";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";
import { t } from "@/i18n/dictionary";

type FieldType = "name" | "phone" | "email" | "idcard" | "address" | "date" | "company" | "number" | "uuid" | "boolean";

interface Field {
  type: FieldType;
  name: string;
}

const fieldLabels: Record<FieldType, string> = {
  name: t("util_common.姓名"), phone: t("util_mock_data.手机号"), email: t("auth.email_label"), idcard: t("util_mock_data.身份证号"),
  address: t("util_mock_data.地址"), date: t("util_mock_data.日期"), company: t("util_mock_data.公司"), number: t("util_mock_data.数字"),
  uuid: "UUID", boolean: t("util_mock_data.布尔值"),
};

const surnames = t("util_mock_data.赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许");
const givenNames = [t("util_common.伟"), t("util_common.芳"), t("util_common.娜"), t("util_common.敏"), t("util_mock_data.静"), t("util_common.丽"), t("util_mock_data.强"), t("util_common.磊"), t("util_common.军"), t("util_common.洋"), t("util_common.勇"), t("util_common.艳"), t("util_common.杰"), t("util_common.娟"), t("util_common.涛"), t("util_mock_data.明"), t("util_mock_data.超"), t("util_common.霞"), t("util_mock_data.平"), t("util_common.刚"), t("util_common.桂英"), t("util_common.秀兰"), t("util_common.建国"), t("util_common.建华"), t("util_common.志强")];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateValue(type: FieldType): unknown {
  switch (type) {
    case "name":
      return randomItem(surnames.split("")) + randomItem(givenNames);
    case "phone":
      return "1" + randomItem(["3", "5", "7", "8", "9"]) + Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
    case "email":
      return `user${Math.floor(Math.random() * 100000)}@${randomItem(["qq.com", "163.com", "gmail.com", "outlook.com"])}`;
    case "idcard":
      return "110101" + (1980 + Math.floor(Math.random() * 25)) + randomItem(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]) + randomItem(["01", "02", "03", "15", "20", "25", "28"]) + Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join("") + randomItem(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "X"]);
    case "address":
      return randomItem([t("util_mock_data.北京市朝阳区"), t("util_mock_data.上海市浦东新区"), t("util_mock_data.广东省深圳市"), t("util_mock_data.浙江省杭州市"), t("util_mock_data.江苏省南京市"), t("util_mock_data.四川省成都市")]) + Math.floor(Math.random() * 999) + t("util_mock_data.号");
    case "date":
      return new Date(2000 + Math.floor(Math.random() * 25), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split("T")[0];
    case "company":
      return randomItem([t("util_common.星辰"), t("util_common.天地"), t("util_common.环球"), t("util_common.盛世"), t("util_common.聚能"), t("util_common.创新"), t("util_common.智慧"), t("util_common.远景")]) + randomItem([t("util_common.科技"), t("util_common.网络"), t("util_mock_data.信息"), t("util_mock_data.数据"), t("util_mock_data.智能"), t("util_common.软件")]) + t("util_mock_data.有限公司");
    case "number":
      return Math.floor(Math.random() * 10000);
    case "uuid":
      return crypto.randomUUID();
    case "boolean":
      return Math.random() > 0.5;
  }
}

export default function UtilMockDataPage() {
  const [count, setCount] = useState(10);
  const [fields, setFields] = useState<Field[]>([
    { type: "name", name: t("util_common.姓名") },
    { type: "phone", name: t("util_mock_data.手机号") },
    { type: "email", name: t("auth.email_label") },
  ]);
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  const addField = () => {
    setFields([...fields, { type: "name", name: t("util_mock_data.字段").replace("{0}", String(fields.length + 1)) }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, key: keyof Field, value: string) => {
    setFields(fields.map((f, i) => i === index ? { ...f, [key]: value } : f));
  };

  const generate = () => {
    const data: Record<string, unknown>[] = [];
    for (let i = 0; i < count; i++) {
      const row: Record<string, unknown> = {};
      fields.forEach((f) => {
        row[f.name] = generateValue(f.type);
      });
      data.push(row);
    }

    if (format === "json") {
      setResult(JSON.stringify(data, null, 2));
    } else {
      const headers = fields.map((f) => f.name).join(",");
      const rows = data.map((row) => fields.map((f) => row[f.name]).join(","));
      setResult([headers, ...rows].join("\n"));
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tool = getToolById("mock-data")!;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ToolHeader title={tool.name} description={tool.desc} />
      <ToolUsage tool={tool} />

      <div className="mt-8 space-y-4">
        <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">{t("util_mock_data.生成条数")}</label>
              <input type="number" min="1" max="1000" value={count}
                onChange={(e) => setCount(Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">{t("pdf_compress.output_format")}</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as "json" | "csv")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {fields.map((field, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select value={field.type} onChange={(e) => updateField(i, "type", e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
                  {Object.entries(fieldLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <input type="text" value={field.name} onChange={(e) => updateField(i, "name", e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm" />
                <button onClick={() => removeField(i)} className="text-red-400 hover:text-red-600 text-sm">{t("common.delete")}</button>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={addField} className="btn-secondary text-sm">{t("util_mock_data.添加字段")}</button>
            <button onClick={generate} className="btn-primary">{t("util_mock_data.生成数据")}</button>
          </div>
        </div>

        {result && (
          <div className="rounded-2xl bg-white/60 backdrop-blur border border-slate-200/70 p-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-zinc-500">{t("util_mock_data.生成结果")}</span>
              <button onClick={copy} className="text-xs text-brand-600 hover:text-brand-700">
                {copied ? t("util_common.copied") : t("util_common.copy")}
              </button>
            </div>
            <pre className="rounded-lg bg-slate-50 p-4 text-xs font-mono overflow-x-auto max-h-96">{result}</pre>
          </div>
        )}
      </div>
    </main>
  );
}
