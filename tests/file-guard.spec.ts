import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE = process.env.TEST_URL || "http://localhost:3001";
const ADMIN_PWD = "admin123";
const ADMIN_AUTH = "test-auth-token";
const DATA_DIR = path.join(__dirname, "fixtures");

function ensureFixtures() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const c of [
    { name: "small.pdf", mb: 5 },
    { name: "medium.pdf", mb: 10 },
    { name: "large.pdf", mb: 25 },
  ]) {
    const fp = path.join(DATA_DIR, c.name);
    if (!fs.existsSync(fp) || fs.statSync(fp).size < c.mb * 1024 * 1024 * 0.9) {
      const header = Buffer.from(
        "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
        "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n" +
        "4 0 obj<</Length 44>>stream\nBT /F1 24 Tf 100 700 Td (Test PDF) Tj ET\nendstream endobj\n" +
        "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n" +
        "xref\n0 6\ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n457\n%%EOF\n"
      );
      const targetBytes = c.mb * 1024 * 1024;
      const pad = Buffer.alloc(Math.max(0, targetBytes - header.length));
      for (let i = 0; i < pad.length; i++) pad[i] = i & 0xff;
      fs.writeFileSync(fp, Buffer.concat([header, pad]));
    }
  }
}

async function api<T = any>(
  method: "GET" | "POST",
  url: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<T> {
  const init: RequestInit = { method, headers: { ...headers } };
  if (body !== undefined) {
    (init.headers as any)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + url, init);
  return res.json();
}

async function apiAdmin<T = any>(action: string, body: any = {}): Promise<T> {
  return api<T>("POST", "/api/admin", { action, ...body }, { "x-admin-auth": ADMIN_AUTH });
}

async function resetDefaults() {
  await apiAdmin("update-config", {
    updates: {
      "verify.enabled": "true",
      "verify.mb": "8",
      "membership.enabled": "true",
      "membership.mb": "20",
    },
  });
}

async function waitForGuardConfig(page: Page) {
  await page.waitForResponse(
    (resp) => resp.url().includes("/api/config") && resp.status() === 200,
    { timeout: 10000 }
  );
  await page.waitForTimeout(800);
}

async function uploadFile(page: Page, filePath: string) {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(filePath);
}

test.describe("文件大小限制 - API 层", () => {
  test.beforeAll(() => { ensureFixtures(); });

  test("GET /api/config 返回正确阈值和开关", async () => {
    const cfg = await api<any>("GET", "/api/config");
    expect(cfg.verify).toBeDefined();
    expect(typeof cfg.verify.mb).toBe("number");
    expect(typeof cfg.membership.mb).toBe("number");
    expect(typeof cfg.verify.enabled).toBe("boolean");
    expect(typeof cfg.membership.enabled).toBe("boolean");
  });

  test("POST /api/admin 登录成功", async () => {
    const res = await api<any>("POST", "/api/admin", { action: "login", password: ADMIN_PWD });
    expect(res.ok).toBe(true);
  });

  test("POST /api/admin 登录密码错误", async () => {
    const res = await api<any>("POST", "/api/admin", { action: "login", password: "wrong" });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("密码");
  });

  test("未携带认证头调用管理接口返回未授权", async () => {
    const res = await api<any>("POST", "/api/admin", { action: "generate-codes", count: 1 });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("未授权");
  });

  test("生成验证码并验证通过 + 单次有效", async () => {
    const gen = await apiAdmin<any>("generate-codes", { count: 1, minutes: 30 });
    expect(gen.ok).toBe(true);
    expect(gen.codes).toHaveLength(1);
    const code: string = gen.codes[0];

    const verify = await api<any>("POST", "/api/verify-code", { code });
    expect(verify.ok).toBe(true);

    const reuse = await api<any>("POST", "/api/verify-code", { code });
    expect(reuse.ok).toBe(false);
    expect(reuse.reason).toContain("已使用");
  });

  test("无效验证码验证失败", async () => {
    const res = await api<any>("POST", "/api/verify-code", { code: "INVALID123" });
    expect(res.ok).toBe(false);
  });

  test("创建会员码并验证通过", async () => {
    const create = await apiAdmin<any>("create-membership", { days: 30 });
    expect(create.ok).toBe(true);
    expect(create.token).toMatch(/^MB-/);

    const verify = await api<any>("POST", "/api/verify-membership", { token: create.token });
    expect(verify.ok).toBe(true);
  });

  test("无效会员码验证失败", async () => {
    const res = await api<any>("POST", "/api/verify-membership", { token: "MB-INVALID-XXXX" });
    expect(res.ok).toBe(false);
  });

  test("管理员可修改阈值", async () => {
    await resetDefaults();
    await apiAdmin("update-config", { updates: { "verify.mb": "10", "membership.mb": "30" } });
    const cfg = await api<any>("GET", "/api/config");
    expect(cfg.verify.mb).toBe(10);
    expect(cfg.membership.mb).toBe(30);
    await resetDefaults();
  });

  test("管理员可开关限制", async () => {
    await resetDefaults();
    await apiAdmin("update-config", { updates: { "verify.enabled": "false", "membership.enabled": "false" } });
    let cfg = await api<any>("GET", "/api/config");
    expect(cfg.verify.enabled).toBe(false);
    expect(cfg.membership.enabled).toBe(false);

    await apiAdmin("update-config", { updates: { "verify.enabled": "true", "membership.enabled": "true" } });
    cfg = await api<any>("GET", "/api/config");
    expect(cfg.verify.enabled).toBe(true);
    expect(cfg.membership.enabled).toBe(true);
    await resetDefaults();
  });
});

test.describe("文件大小限制 - UI 层 (pdf-merge)", () => {
  test.beforeAll(async () => {
    ensureFixtures();
    await resetDefaults();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/pdf-merge`);
    await waitForGuardConfig(page);
  });

  test("5MB 文件 - 不触发任何弹窗", async ({ page }) => {
    await uploadFile(page, path.join(DATA_DIR, "small.pdf"));
    await expect(page.getByText("验证码验证")).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByText("会员验证")).toHaveCount(0, { timeout: 5000 });
  });

  test("10MB 文件 - 触发验证码弹窗", async ({ page }) => {
    await uploadFile(page, path.join(DATA_DIR, "medium.pdf"));
    await expect(page.locator("h3")).toContainText("验证码验证", { timeout: 8000 });
    await expect(page.getByText(/超过 8MB 需输入验证码/)).toBeVisible();
  });

  test("25MB 文件 - 触发会员弹窗", async ({ page }) => {
    await uploadFile(page, path.join(DATA_DIR, "large.pdf"));
    await expect(page.locator("h3")).toContainText("会员验证", { timeout: 8000 });
    await expect(page.getByText(/超过 20MB 需会员/)).toBeVisible();
  });

  test("输入有效验证码后继续", async ({ page }) => {
    const created = await apiAdmin<any>("generate-codes", { count: 1, minutes: 30 });
    const code: string = created.codes[0];

    await uploadFile(page, path.join(DATA_DIR, "medium.pdf"));
    await expect(page.locator("h3")).toContainText("验证码验证", { timeout: 8000 });

    await page.getByPlaceholder(/如 A1B2C3/).fill(code);
    const verifyResp = page.waitForResponse((r) => r.url().includes("/api/verify-code"), { timeout: 8000 });
    await page.getByRole("button", { name: "确认" }).click();
    await verifyResp;

    await expect(page.getByText("验证码验证")).toHaveCount(0, { timeout: 5000 });
  });

  test("输入有效会员码后继续", async ({ page }) => {
    const created = await apiAdmin<any>("create-membership", { days: 30 });
    const token: string = created.token;

    await uploadFile(page, path.join(DATA_DIR, "large.pdf"));
    await expect(page.locator("h3")).toContainText("会员验证", { timeout: 8000 });

    await page.getByPlaceholder(/如 MB-XXXX/).fill(token);
    const verifyResp = page.waitForResponse((r) => r.url().includes("/api/verify-membership"), { timeout: 8000 });
    await page.getByRole("button", { name: "确认" }).click();
    await verifyResp;

    await expect(page.getByText("会员验证")).toHaveCount(0, { timeout: 5000 });
  });

  test("输入无效验证码显示错误", async ({ page }) => {
    await uploadFile(page, path.join(DATA_DIR, "medium.pdf"));
    await expect(page.locator("h3")).toContainText("验证码验证", { timeout: 8000 });

    await page.getByPlaceholder(/如 A1B2C3/).fill("WRONG1");
    const verifyResp = page.waitForResponse((r) => r.url().includes("/api/verify-code"), { timeout: 8000 });
    await page.getByRole("button", { name: "确认" }).click();
    await verifyResp;

    await expect(page.getByText(/验证码不存在|验证码无效|无效/).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("验证码验证")).toBeVisible();
  });

  test("关闭 verify 开关后 10MB 直接通过", async ({ page }) => {
    await apiAdmin("update-config", { updates: { "verify.enabled": "false" } });
    await page.reload();
    await waitForGuardConfig(page);

    await uploadFile(page, path.join(DATA_DIR, "medium.pdf"));
    await expect(page.getByText("验证码验证")).toHaveCount(0, { timeout: 5000 });

    await resetDefaults();
  });
});

test.describe("文件大小限制 - 全部工具页面一致性", () => {
  test.beforeAll(async () => {
    ensureFixtures();
    await resetDefaults();
  });

  const tools = [
    { name: "PDF 去水印", url: "/pdf-remove-watermark" },
    { name: "PDF 合并", url: "/pdf-merge" },
    { name: "PDF 拆分", url: "/pdf-split" },
    { name: "PDF 旋转", url: "/pdf-rotate" },
    { name: "PDF 加水印", url: "/pdf-watermark" },
    { name: "PDF 提取图片", url: "/pdf-extract-image" },
    { name: "PDF 压缩", url: "/pdf-compress" },
    { name: "PDF 转图片", url: "/pdf-to-image" },
    { name: "PDF OCR", url: "/pdf-ocr" },
  ];

  for (const tool of tools) {
    test(`${tool.name} - 25MB 触发会员弹窗`, async ({ page }) => {
      await page.goto(`${BASE}${tool.url}`);
      await waitForGuardConfig(page);
      await uploadFile(page, path.join(DATA_DIR, "large.pdf"));
      await expect(page.locator("h3")).toContainText("会员验证", { timeout: 10000 });
    });
  }
});
