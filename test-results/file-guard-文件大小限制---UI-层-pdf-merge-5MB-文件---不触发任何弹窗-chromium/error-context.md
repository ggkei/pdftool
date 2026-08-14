# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: file-guard.spec.ts >> 文件大小限制 - UI 层 (pdf-merge) >> 5MB 文件 - 不触发任何弹窗
- Location: tests\file-guard.spec.ts:175:7

# Error details

```
TimeoutError: page.waitForResponse: Timeout 10000ms exceeded while waiting for event "response"
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - heading "404" [level=1] [ref=e4]
  - heading "This page could not be found." [level=2] [ref=e6]
```

# Test source

```ts
  1   | import { test, expect, Page } from "@playwright/test";
  2   | import fs from "fs";
  3   | import path from "path";
  4   | 
  5   | const BASE = process.env.TEST_URL || "http://localhost:3001";
  6   | const ADMIN_PWD = "admin123";
  7   | const ADMIN_AUTH = "test-auth-token";
  8   | const DATA_DIR = path.join(__dirname, "fixtures");
  9   | 
  10  | function ensureFixtures() {
  11  |   fs.mkdirSync(DATA_DIR, { recursive: true });
  12  |   for (const c of [
  13  |     { name: "small.pdf", mb: 5 },
  14  |     { name: "medium.pdf", mb: 10 },
  15  |     { name: "large.pdf", mb: 25 },
  16  |   ]) {
  17  |     const fp = path.join(DATA_DIR, c.name);
  18  |     if (!fs.existsSync(fp) || fs.statSync(fp).size < c.mb * 1024 * 1024 * 0.9) {
  19  |       const header = Buffer.from(
  20  |         "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
  21  |         "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
  22  |         "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n" +
  23  |         "4 0 obj<</Length 44>>stream\nBT /F1 24 Tf 100 700 Td (Test PDF) Tj ET\nendstream endobj\n" +
  24  |         "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n" +
  25  |         "xref\n0 6\ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n457\n%%EOF\n"
  26  |       );
  27  |       const targetBytes = c.mb * 1024 * 1024;
  28  |       const pad = Buffer.alloc(Math.max(0, targetBytes - header.length));
  29  |       for (let i = 0; i < pad.length; i++) pad[i] = i & 0xff;
  30  |       fs.writeFileSync(fp, Buffer.concat([header, pad]));
  31  |     }
  32  |   }
  33  | }
  34  | 
  35  | async function api<T = any>(
  36  |   method: "GET" | "POST",
  37  |   url: string,
  38  |   body?: any,
  39  |   headers: Record<string, string> = {}
  40  | ): Promise<T> {
  41  |   const init: RequestInit = { method, headers: { ...headers } };
  42  |   if (body !== undefined) {
  43  |     (init.headers as any)["Content-Type"] = "application/json";
  44  |     init.body = JSON.stringify(body);
  45  |   }
  46  |   const res = await fetch(BASE + url, init);
  47  |   return res.json();
  48  | }
  49  | 
  50  | async function apiAdmin<T = any>(action: string, body: any = {}): Promise<T> {
  51  |   return api<T>("POST", "/api/admin", { action, ...body }, { "x-admin-auth": ADMIN_AUTH });
  52  | }
  53  | 
  54  | async function resetDefaults() {
  55  |   await apiAdmin("update-config", {
  56  |     updates: {
  57  |       "verify.enabled": "true",
  58  |       "verify.mb": "8",
  59  |       "membership.enabled": "true",
  60  |       "membership.mb": "20",
  61  |     },
  62  |   });
  63  | }
  64  | 
  65  | async function waitForGuardConfig(page: Page) {
> 66  |   await page.waitForResponse(
      |              ^ TimeoutError: page.waitForResponse: Timeout 10000ms exceeded while waiting for event "response"
  67  |     (resp) => resp.url().includes("/api/config") && resp.status() === 200,
  68  |     { timeout: 10000 }
  69  |   );
  70  |   await page.waitForTimeout(800);
  71  | }
  72  | 
  73  | async function uploadFile(page: Page, filePath: string) {
  74  |   const fileInput = page.locator('input[type="file"]').first();
  75  |   await fileInput.setInputFiles(filePath);
  76  | }
  77  | 
  78  | test.describe("文件大小限制 - API 层", () => {
  79  |   test.beforeAll(() => { ensureFixtures(); });
  80  | 
  81  |   test("GET /api/config 返回正确阈值和开关", async () => {
  82  |     const cfg = await api<any>("GET", "/api/config");
  83  |     expect(cfg.verify).toBeDefined();
  84  |     expect(typeof cfg.verify.mb).toBe("number");
  85  |     expect(typeof cfg.membership.mb).toBe("number");
  86  |     expect(typeof cfg.verify.enabled).toBe("boolean");
  87  |     expect(typeof cfg.membership.enabled).toBe("boolean");
  88  |   });
  89  | 
  90  |   test("POST /api/admin 登录成功", async () => {
  91  |     const res = await api<any>("POST", "/api/admin", { action: "login", password: ADMIN_PWD });
  92  |     expect(res.ok).toBe(true);
  93  |   });
  94  | 
  95  |   test("POST /api/admin 登录密码错误", async () => {
  96  |     const res = await api<any>("POST", "/api/admin", { action: "login", password: "wrong" });
  97  |     expect(res.ok).toBe(false);
  98  |     expect(res.reason).toContain("密码");
  99  |   });
  100 | 
  101 |   test("未携带认证头调用管理接口返回未授权", async () => {
  102 |     const res = await api<any>("POST", "/api/admin", { action: "generate-codes", count: 1 });
  103 |     expect(res.ok).toBe(false);
  104 |     expect(res.reason).toContain("未授权");
  105 |   });
  106 | 
  107 |   test("生成验证码并验证通过 + 单次有效", async () => {
  108 |     const gen = await apiAdmin<any>("generate-codes", { count: 1, minutes: 30 });
  109 |     expect(gen.ok).toBe(true);
  110 |     expect(gen.codes).toHaveLength(1);
  111 |     const code: string = gen.codes[0];
  112 | 
  113 |     const verify = await api<any>("POST", "/api/verify-code", { code });
  114 |     expect(verify.ok).toBe(true);
  115 | 
  116 |     const reuse = await api<any>("POST", "/api/verify-code", { code });
  117 |     expect(reuse.ok).toBe(false);
  118 |     expect(reuse.reason).toContain("已使用");
  119 |   });
  120 | 
  121 |   test("无效验证码验证失败", async () => {
  122 |     const res = await api<any>("POST", "/api/verify-code", { code: "INVALID123" });
  123 |     expect(res.ok).toBe(false);
  124 |   });
  125 | 
  126 |   test("创建会员码并验证通过", async () => {
  127 |     const create = await apiAdmin<any>("create-membership", { days: 30 });
  128 |     expect(create.ok).toBe(true);
  129 |     expect(create.token).toMatch(/^MB-/);
  130 | 
  131 |     const verify = await api<any>("POST", "/api/verify-membership", { token: create.token });
  132 |     expect(verify.ok).toBe(true);
  133 |   });
  134 | 
  135 |   test("无效会员码验证失败", async () => {
  136 |     const res = await api<any>("POST", "/api/verify-membership", { token: "MB-INVALID-XXXX" });
  137 |     expect(res.ok).toBe(false);
  138 |   });
  139 | 
  140 |   test("管理员可修改阈值", async () => {
  141 |     await resetDefaults();
  142 |     await apiAdmin("update-config", { updates: { "verify.mb": "10", "membership.mb": "30" } });
  143 |     const cfg = await api<any>("GET", "/api/config");
  144 |     expect(cfg.verify.mb).toBe(10);
  145 |     expect(cfg.membership.mb).toBe(30);
  146 |     await resetDefaults();
  147 |   });
  148 | 
  149 |   test("管理员可开关限制", async () => {
  150 |     await resetDefaults();
  151 |     await apiAdmin("update-config", { updates: { "verify.enabled": "false", "membership.enabled": "false" } });
  152 |     let cfg = await api<any>("GET", "/api/config");
  153 |     expect(cfg.verify.enabled).toBe(false);
  154 |     expect(cfg.membership.enabled).toBe(false);
  155 | 
  156 |     await apiAdmin("update-config", { updates: { "verify.enabled": "true", "membership.enabled": "true" } });
  157 |     cfg = await api<any>("GET", "/api/config");
  158 |     expect(cfg.verify.enabled).toBe(true);
  159 |     expect(cfg.membership.enabled).toBe(true);
  160 |     await resetDefaults();
  161 |   });
  162 | });
  163 | 
  164 | test.describe("文件大小限制 - UI 层 (pdf-merge)", () => {
  165 |   test.beforeAll(async () => {
  166 |     ensureFixtures();
```