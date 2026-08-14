interface SmtpProvider {
  name: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  dailyLimit: number;
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

  // New multi-provider format: SMTP1_*, SMTP2_*, ...
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
    });
  }

  // Backward compatibility: old single-provider format (SMTP_HOST, ...)
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
      });
    }
  }

  return providers;
}

function getAvailableProvider(providers: SmtpProvider[]): SmtpProvider | null {
  for (const p of providers) {
    const count = getDailyCount(p.name);
    if (p.dailyLimit > 0 && count >= p.dailyLimit) {
      console.log(`[EMAIL] ${p.name} 已达每日限额 (${count}/${p.dailyLimit})，跳过`);
      continue;
    }
    return p;
  }
  return null;
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
    subject: "【PDFTool】您的登录验证码",
    text: `您的验证码是：${code}，10 分钟内有效。如非本人操作请忽略此邮件。`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 12px; padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0 0 8px; font-size: 20px;">PDFTool 登录验证码</h1>
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

  // Try each provider in order until one succeeds
  for (const provider of providers) {
    // Check daily limit
    const count = getDailyCount(provider.name);
    if (provider.dailyLimit > 0 && count >= provider.dailyLimit) {
      console.log(`[EMAIL] ${provider.name} 已达每日限额 (${count}/${provider.dailyLimit})，尝试下一个`);
      continue;
    }

    try {
      console.log(`[EMAIL] 尝试通过 ${provider.name} 发送 → ${email} (今日: ${count}/${provider.dailyLimit || "∞"})`);
      await sendWithProvider(provider, email, code);
      incrementCount(provider.name);
      console.log(`[EMAIL] ${provider.name} 发送成功 → ${email}`);
      return { ok: true, provider: provider.name };
    } catch (err: any) {
      console.error(`[EMAIL] ${provider.name} 发送失败:`, err.message || err);
      // Continue to next provider
    }
  }

  // All providers failed
  console.error("[EMAIL] 所有邮件服务均发送失败");
  return { ok: false };
}

// Get status of all providers (for admin dashboard)
export function getEmailProvidersStatus() {
  const providers = getProviders();
  return providers.map((p) => ({
    name: p.name,
    host: p.host,
    dailyLimit: p.dailyLimit,
    dailySent: getDailyCount(p.name),
    remaining: p.dailyLimit > 0 ? Math.max(0, p.dailyLimit - getDailyCount(p.name)) : -1,
  }));
}
