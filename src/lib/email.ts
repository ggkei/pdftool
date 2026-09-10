interface SmtpProvider {
  name: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  dailyLimit: number;
  region?: "cn" | "global";
}

// In-memory daily counter per provider (resets at midnight)
const dailyCounts: Record<string, { date: string; count: number }> = {};

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDailyCount(name: string): number {
  const today = getToday();
  const entry = dailyCounts[name];
  if (!entry || entry.date !== today) {
    dailyCounts[name] = { date: today, count: 0 };
    return 0;
  }
  return entry.count;
}

function incrementCount(name: string): void {
  const today = getToday();
  if (!dailyCounts[name] || dailyCounts[name].date !== today) {
    dailyCounts[name] = { date: today, count: 0 };
  }
  dailyCounts[name].count++;
}

function getProviders(): SmtpProvider[] {
  const providers: SmtpProvider[] = [];

  for (let i = 1; i <= 5; i++) {
    const host = process.env[`SMTP${i}_HOST`];
    if (!host) continue;
    providers.push({
      name: process.env[`SMTP${i}_NAME`] || `Provider${i}`,
      host,
      port: Number(process.env[`SMTP${i}_PORT`] || "465"),
      user: process.env[`SMTP${i}_USER`] || "",
      pass: process.env[`SMTP${i}_PASS`] || "",
      from: process.env[`SMTP${i}_FROM`] || "no-reply@pdftool.cn",
      dailyLimit: Number(process.env[`SMTP${i}_DAILY_LIMIT`] || "0"),
      region: (process.env[`SMTP${i}_REGION`] as "cn" | "global") || "global",
    });
  }

  if (providers.length === 0) {
    const host = process.env.SMTP_HOST;
    if (host) {
      providers.push({
        name: "Default",
        host,
        port: Number(process.env.SMTP_PORT || "465"),
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
        from: process.env.SMTP_FROM || "no-reply@pdftool.cn",
        dailyLimit: Number(process.env.SMTP_DAILY_LIMIT || "0"),
        region: (process.env.SMTP_REGION as "cn" | "global") || "global",
      });
    }
  }

  return providers;
}

function isChinaEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  const chinaDomains = [
    "qq.com", "163.com", "126.com", "139.com", "189.com",
    "foxmail.com", "sina.com", "sina.cn", "sohu.com", "aliyun.com",
    "yeah.net", "tom.com", "21cn.com", "wo.cn", "wo.com.cn",
    "chinaunicom.cn", "chinatelecom.cn",
  ];
  return chinaDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

async function sendWithProvider(
  provider: SmtpProvider,
  email: string,
  code: string
): Promise<{ ok: boolean; provider: string }> {
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: provider.host,
    port: provider.port,
    secure: provider.port === 465,
    auth: { user: provider.user, pass: provider.pass },
  });

  await transporter.sendMail({
    from: provider.from,
    to: email,
    subject: "【AtoolX】您的登录验证码",
    text: `您的验证码是：${code}，10 分钟内有效。如非本人操作请忽略此邮件。`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 12px; padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0 0 8px; font-size: 20px;">AtoolX 登录验证码</h1>
          <p style="margin: 0; font-size: 13px; opacity: 0.9;">10 分钟内有效，请勿泄露给他人</p>
        </div>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; margin-top: 16px; text-align: center;">
          <div style="font-size: 40px; font-weight: 700; letter-spacing: 0.3em; color: #1f2937; font-family: monospace;">${code}</div>
        </div>
        <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 16px;">
          如非本人操作，请忽略此邮件
        </p>
      </div>
    `,
  });

  return { ok: true, provider: provider.name };
}

export async function sendLoginCodeEmail(
  email: string,
  code: string
): Promise<{ ok: boolean; devCode?: string; provider?: string }> {
  const providers = getProviders();

  // Dev mode: no providers configured
  if (providers.length === 0) {
    console.log(`[EMAIL DEV MODE] 登录验证码 → ${email}: ${code}`);
    return { ok: true, devCode: code };
  }

  const targetRegion = isChinaEmail(email) ? "cn" : "global";
  const preferred = providers.filter((p) => p.region === targetRegion);
  const fallback = providers.filter((p) => p.region !== targetRegion);
  const ordered = [...preferred, ...fallback];

  for (const provider of ordered) {
    const count = getDailyCount(provider.name);
    if (provider.dailyLimit > 0 && count >= provider.dailyLimit) {
      console.log(`[EMAIL] ${provider.name} 已达每日限额 (${count}/${provider.dailyLimit})，跳过`);
      continue;
    }

    try {
      console.log(`[EMAIL] 目标区域 ${targetRegion} → 尝试 ${provider.name} → ${email} (今日: ${count}/${provider.dailyLimit || "∞"})`);
      await sendWithProvider(provider, email, code);
      incrementCount(provider.name);
      console.log(`[EMAIL] ${provider.name} 发送成功 → ${email}`);
      return { ok: true, provider: provider.name };
    } catch (err: any) {
      console.error(`[EMAIL] ${provider.name} 发送失败:`, err.message || err);
    }
  }

  console.error("[EMAIL] 所有邮件服务均发送失败");
  return { ok: false };
}

// ==================== 阿里云短信验证码（备用能力） ====================

let _smsClient: any = null;

async function getSMSClient() {
  if (_smsClient) return _smsClient;
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("阿里云 SMS 凭证未配置");
  }
  try {
    const dysmsapi = await import("@alicloud/dysmsapi20170525");
    const $OpenApi = await import("@alicloud/openapi-client");
    const config = new $OpenApi.Config({ accessKeyId, accessKeySecret });
    config.endpoint = "dysmsapi.aliyuncs.com";
    _smsClient = new dysmsapi.default(config);
    return _smsClient;
  } catch (err: any) {
    console.error("[SMS] 初始化失败:", err.message || err);
    throw err;
  }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && /^1[3-9]\d{9}$/.test(digits)) {
    return `86${digits}`;
  }
  return digits;
}

export async function sendSMSCode(
  phone: string,
  code: string
): Promise<{ ok: boolean; message?: string }> {
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;
  if (!signName || !templateCode) {
    return { ok: false, message: "SMS 配置不完整" };
  }
  try {
    const client = await getSMSClient();
    const normalizedPhone = normalizePhone(phone);
    const dysmsapi = await import("@alicloud/dysmsapi20170525");
    const sendSmsRequest = new dysmsapi.SendSmsRequest({
      phoneNumbers: normalizedPhone,
      signName,
      templateCode,
      templateParam: JSON.stringify({ code }),
    });
    console.log(`[SMS] 发送验证码 → ${normalizedPhone}`);
    const response = await client.sendSms(sendSmsRequest);
    if (response.body?.code === "OK") {
      console.log(`[SMS] 发送成功 → ${normalizedPhone}`);
      return { ok: true };
    }
    console.error("[SMS] 发送失败:", response.body);
    return { ok: false, message: response.body?.message || "发送失败" };
  } catch (err: any) {
    console.error("[SMS] 异常:", err.message || err);
    return { ok: false, message: err.message || "网络错误" };
  }
}

export function getEmailProvidersStatus() {
  const providers = getProviders();
  return providers.map((p) => ({
    name: p.name,
    host: p.host,
    region: p.region,
    dailyLimit: p.dailyLimit,
    dailySent: getDailyCount(p.name),
    remaining: p.dailyLimit > 0 ? Math.max(0, p.dailyLimit - getDailyCount(p.name)) : -1,
  }));
}
