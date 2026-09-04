// Simple domain-aware i18n for AtoolX
// Chinese site: atoolx.cn
// English site: atoolx.com (and *.vercel.app for preview)

export type Locale = "zh" | "en";

export function getLocaleFromHostname(hostname?: string): Locale {
  const host = hostname || "";
  if (host.includes("atoolx.cn")) {
    return "zh";
  }
  return "en"; // atoolx.com, vercel.app, localhost, etc.
}

export function getLocaleFromHeaders(): Locale {
  try {
    // Server-side: import from next/headers when needed
    const { headers } = require("next/headers");
    const host = headers().get("host") || "";
    return getLocaleFromHostname(host);
  } catch {
    return "zh";
  }
}

// Home page translations
export const homeT = {
  zh: {
    metaTitle: "AtoolX - 纯浏览器端 PDF 工具箱",
    metaDescription: "去水印、合并、拆分、旋转、加水印、压缩、转图片、OCR，全部在浏览器本地处理，文件不上传服务器，隐私零风险。",
    badge: "{count} 个工具已就绪 · 浏览器本地运行",
    heroTitle: "PDF 处理 · 实用工具",
    heroSubtitle: "更安全 · 更私密 · 更全面",
    heroDesc: "PDF 去水印、合并、拆分、压缩、OCR —",
    heroDescHighlight: "所有处理都在你的浏览器本地完成",
    heroDescSuffix: "，同时提供 {extra} 免费实用小工具（编码、计算、生活服务）。",
    privacyLabels: ["文件零上传", "即用即删", "零风险"],
    privacyDescs: [
      "所有解析、处理、合成都在你的浏览器内完成",
      "关闭页面即从内存释放，不残留任何痕迹",
      "服务器仅存配置信息，无任何用户文件",
    ],
    pdfSectionTitle: "PDF 工具",
    pdfSectionSubtitle: "{count} 个专业 PDF 处理工具",
    pdfBadge: "需登录解锁高级功能",
    utilSectionTitle: "免费在线小工具",
    utilSectionSubtitle: "{count} 个免费实用工具",
    utilBadge: "完全免费",
    toolCardCta: "开始使用",
    footer: {
      brand: "纯前端架构 · 文件零上传",
      slogan: "数据安全由你的浏览器全权守护",
      icp: "粤ICP备2026125632号",
      police: "粤公网安备44030002016475号",
    },
    nav: {
      home: "首页",
      pdfTools: "PDF 工具",
      utilities: "小工具",
      items: "{n} 个",
      login: "登录",
      logout: "退出登录",
      account: "账户中心",
      user: "用户",
      forever: "永久会员",
      remainingDays: "剩余 {n} 天",
      notMember: "非会员",
    },
    lang: "zh-CN",
  },
  en: {
    metaTitle: "AtoolX - Browser-Side PDF Toolbox",
    metaDescription: "Watermark removal, merge, split, rotate, add watermark, compress, convert to image, OCR — all processed locally in your browser. Files never uploaded to server, zero privacy risk.",
    badge: "{count} tools ready · Runs entirely in your browser",
    heroTitle: "PDF Processing · Utility Tools",
    heroSubtitle: "Safer · More Private · More Complete",
    heroDesc: "PDF watermark removal, merge, split, compress, OCR —",
    heroDescHighlight: "all processing is done locally in your browser",
    heroDescSuffix: ", with {extra}+ free utility tools (encoding, calculation, daily life).",
    privacyLabels: ["Zero Upload", "Use & Delete", "Zero Risk"],
    privacyDescs: [
      "All parsing, processing, and synthesis happen inside your browser",
      "Closing the page instantly frees memory, leaves no trace",
      "Server stores only config, no user files whatsoever",
    ],
    pdfSectionTitle: "PDF Tools",
    pdfSectionSubtitle: "{count} professional PDF processing tools",
    pdfBadge: "Advanced features require login",
    utilSectionTitle: "Free Online Utilities",
    utilSectionSubtitle: "{count} free utility tools",
    utilBadge: "Completely Free",
    toolCardCta: "Get Started",
    footer: {
      brand: "Pure Frontend · Zero Upload",
      slogan: "Your browser alone guards your data security",
      icp: "粤ICP备2026125632号",
      police: "粤公网安备44030002016475号",
    },
    nav: {
      home: "Home",
      pdfTools: "PDF Tools",
      utilities: "Utilities",
      items: "{n}",
      login: "Log in",
      logout: "Log out",
      account: "Account Center",
      user: "User",
      forever: "Lifetime",
      remainingDays: "{n} days left",
      notMember: "Free User",
    },
    lang: "en",
  },
};

// Tool group names translation
export const groupT: Record<string, { zh: string; en: string }> = {
  "PDF 工具": { zh: "PDF 工具", en: "PDF Tools" },
  "编码解码": { zh: "编码解码", en: "Encoding & Decoding" },
  "开发调试": { zh: "开发调试", en: "Dev & Debug" },
  "文本处理": { zh: "文本处理", en: "Text Processing" },
  "实用工具": { zh: "实用工具", en: "Utilities" },
  "生活计算": { zh: "生活计算", en: "Life Calculators" },
};

// Tool tag translation
export const tagT: Record<string, { zh: string; en: string }> = {
  "热门": { zh: "热门", en: "Hot" },
  "免费": { zh: "免费", en: "Free" },
  "实用": { zh: "实用", en: "Useful" },
};

// Tool name translation by tool id
export const toolNameT: Record<string, { zh: string; en: string }> = {
  // PDF
  merge: { zh: "PDF 合并", en: "Merge PDF" },
  split: { zh: "PDF 拆分", en: "Split PDF" },
  rotate: { zh: "PDF 旋转排序", en: "Rotate & Sort" },
  watermark: { zh: "PDF 加水印", en: "Add Watermark" },
  "remove-watermark": { zh: "PDF 去水印", en: "Remove Watermark" },
  "extract-image": { zh: "PDF 提取图片", en: "Extract Images" },
  compress: { zh: "PDF 压缩", en: "Compress PDF" },
  "to-image": { zh: "PDF 转图片", en: "PDF to Image" },
  ocr: { zh: "OCR 文字识别", en: "OCR Text Recognition" },
  // Encoding
  "json-format": { zh: "JSON 格式化", en: "JSON Formatter" },
  base64: { zh: "Base64 编解码", en: "Base64 Encoder" },
  "url-encode": { zh: "URL 编解码", en: "URL Encoder" },
  hash: { zh: "哈希生成器", en: "Hash Generator" },
  "number-base": { zh: "进制转换", en: "Base Converter" },
  // Dev
  timestamp: { zh: "时间戳转换", en: "Timestamp Converter" },
  color: { zh: "颜色转换", en: "Color Converter" },
  regex: { zh: "正则测试", en: "Regex Tester" },
  // Text
  "text-tools": { zh: "文本工具箱", en: "Text Toolbox" },
  "unit-convert": { zh: "单位换算", en: "Unit Converter" },
  // Utilities
  qrcode: { zh: "二维码生成", en: "QR Code Generator" },
  password: { zh: "密码生成器", en: "Password Generator" },
  random: { zh: "随机数生成", en: "Random Number" },
  "cn-idcard": { zh: "身份证验证", en: "ID Card Validator" },
  // Life
  mortgage: { zh: "房贷计算器", en: "Mortgage Calculator" },
  currency: { zh: "汇率兑换", en: "Currency Converter" },
  "world-time": { zh: "世界时间", en: "World Time" },
  bmi: { zh: "BMI 计算器", en: "BMI Calculator" },
  period: { zh: "月经周期计算器", en: "Period Calculator" },
};

// Tool description translation by tool id
export const toolDescT: Record<string, { zh: string; en: string }> = {
  merge: { zh: "多个 PDF 合并为一个", en: "Combine multiple PDFs into one" },
  split: { zh: "按范围拆分为多个文件", en: "Split into multiple files by range" },
  rotate: { zh: "旋转页面 / 调整顺序", en: "Rotate pages / reorder" },
  watermark: { zh: "添加文字或图片水印", en: "Add text or image watermark" },
  "remove-watermark": { zh: "自动识别并移除水印", en: "Auto-detect and remove watermarks" },
  "extract-image": { zh: "导出 PDF 中的所有图片", en: "Export all images from a PDF" },
  compress: { zh: "重编码图片减小体积", en: "Re-encode images to reduce size" },
  "to-image": { zh: "每页导出为 PNG/JPEG", en: "Export each page as PNG/JPEG" },
  ocr: { zh: "提取 PDF 中的文字", en: "Extract text from PDF" },
  "json-format": { zh: "美化 / 压缩 / 校验 JSON", en: "Beautify / minify / validate JSON" },
  base64: { zh: "文本 ↔ Base64 互转", en: "Text <-> Base64 conversion" },
  "url-encode": { zh: "URL 安全编码 / 解码", en: "URL-safe encoding / decoding" },
  hash: { zh: "MD5 / SHA1 / SHA256 计算", en: "MD5 / SHA1 / SHA256 calculator" },
  "number-base": { zh: "二 / 八 / 十 / 十六进制互转", en: "Binary / Octal / Decimal / Hex" },
  timestamp: { zh: "Unix 时间戳 ↔ 日期", en: "Unix timestamp <-> date" },
  color: { zh: "HEX / RGB / HSL 互转", en: "HEX / RGB / HSL converter" },
  regex: { zh: "在线测试正则表达式", en: "Test regex online" },
  "text-tools": { zh: "大小写转换 / 统计 / 去重", en: "Case conversion / stats / dedupe" },
  "unit-convert": { zh: "长度 / 重量 / 面积 / 温度", en: "Length / weight / area / temperature" },
  qrcode: { zh: "文字 / 链接 → 二维码", en: "Text / link -> QR code" },
  password: { zh: "安全随机密码", en: "Secure random passwords" },
  random: { zh: "指定范围随机数 / 随机抽签", en: "Random numbers / lucky draw" },
  "cn-idcard": { zh: "校验身份证号 / 提取信息", en: "Validate ID / extract info" },
  mortgage: { zh: "等额本息 / 等额本金", en: "Equal payment / equal principal" },
  currency: { zh: "实时汇率换算", en: "Real-time exchange rates" },
  "world-time": { zh: "全球主要城市时钟", en: "Clocks for major cities" },
  bmi: { zh: "身体质量指数", en: "Body mass index" },
  period: { zh: "预测经期 / 排卵期 / 安全期", en: "Predict period / ovulation / safe days" },
};

export function toolName(id: string, locale: Locale): string {
  return toolNameT[id]?.[locale] ?? toolNameT[id]?.zh ?? id;
}

export function toolDesc(id: string, locale: Locale): string {
  return toolDescT[id]?.[locale] ?? toolDescT[id]?.zh ?? "";
}

export function groupName(group: string, locale: Locale): string {
  return groupT[group]?.[locale] ?? group;
}

export function t(key: string, locale: Locale, values?: Record<string, string | number>): string {
  const dict = homeT[locale];
  let text: string | undefined;

  // Navigate nested keys like "footer.brand"
  const parts = key.split(".");
  let current: any = dict;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      current = undefined;
      break;
    }
  }
  text = typeof current === "string" ? current : undefined;

  if (!text) {
    // Fallback to Chinese
    let fallback: any = homeT["zh"];
    for (const part of parts) {
      if (fallback && typeof fallback === "object" && part in fallback) {
        fallback = fallback[part];
      } else {
        fallback = undefined;
        break;
      }
    }
    text = typeof fallback === "string" ? fallback : key;
  }

  if (values) {
    Object.entries(values).forEach(([k, v]) => {
      text = text!.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    });
  }

  return text || key;
}