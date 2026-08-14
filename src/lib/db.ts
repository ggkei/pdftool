import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { TOOLS, TOOL_IDS, DEFAULT_TOOL_THRESHOLDS, MEMBERSHIP_TIERS, PDF_TOOLS, UTIL_TOOLS, type ToolDef, type MembershipTier } from "./tools";

export { TOOLS, TOOL_IDS, PDF_TOOLS, UTIL_TOOLS, MEMBERSHIP_TIERS };
export type { ToolDef, MembershipTier };

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

async function initDb() {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS verification_codes (
        code TEXT PRIMARY KEY,
        used BOOLEAN NOT NULL DEFAULT false,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL,
        used_at BIGINT
      );
      CREATE TABLE IF NOT EXISTS membership_tokens (
        token TEXT PRIMARY KEY,
        tier TEXT NOT NULL DEFAULT 'year',
        active BOOLEAN NOT NULL DEFAULT true,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL,
        bound_user_id INTEGER,
        bound_at BIGINT
      );
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        login_method TEXT NOT NULL,
        email TEXT UNIQUE,
        wechat_openid TEXT UNIQUE,
        nickname TEXT,
        avatar TEXT,
        membership_tier TEXT,
        membership_expires_at BIGINT,
        created_at BIGINT NOT NULL,
        last_login_at BIGINT,
        password TEXT,
        email_verified BOOLEAN NOT NULL DEFAULT false
      );
      CREATE TABLE IF NOT EXISTS login_codes (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        purpose TEXT NOT NULL,
        used BOOLEAN NOT NULL DEFAULT false,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes(email);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    `);
    const now = Date.now();
    const defaults: Record<string, string> = {
      "verify.enabled": "true",
      "verify.mb": "8",
      "verify.minutes": "30",
      "membership.enabled": "true",
      "membership.mb": "20",
      "admin.password": "pdftool@admin2026",
    };
    for (const id of TOOL_IDS) {
      const def = DEFAULT_TOOL_THRESHOLDS[id];
      if (def) {
        defaults[`verify.mb.${id}`] = String(def.verify);
        defaults[`membership.mb.${id}`] = String(def.membership);
      } else {
        defaults[`verify.mb.${id}`] = "";
        defaults[`membership.mb.${id}`] = "";
      }
    }
    for (const [k, v] of Object.entries(defaults)) {
      await client.query(
        `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`,
        [k, v, now]
      );
    }
  } finally {
    client.release();
  }
}

let initPromise: Promise<void> | null = null;
async function ensureInit() {
  if (!initPromise) {
    initPromise = initDb();
  }
  await initPromise;
}

export async function getConfig(): Promise<Record<string, string>> {
  await ensureInit();
  const res = await getPool().query("SELECT key, value FROM config");
  const out: Record<string, string> = {};
  for (const r of res.rows) out[r.key] = r.value;
  return out;
}

export async function setConfig(key: string, value: string) {
  await ensureInit();
  await getPool().query(
    `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [key, value, Date.now()]
  );
}

export interface ToolThresholds { verifyMb: number; membershipMb: number; }
export interface PublicConfig {
  verify: { enabled: boolean; mb: number };
  membership: { enabled: boolean; mb: number };
  tools: Record<string, ToolThresholds>;
}

function parseMb(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return n > 0 ? n : fallback;
}

export async function getToolThresholds(toolId?: string): Promise<ToolThresholds> {
  const c = await getConfig();
  const gVerify = parseMb(c["verify.mb"], 8);
  const gMembership = parseMb(c["membership.mb"], 20);
  if (!toolId) return { verifyMb: gVerify, membershipMb: gMembership };
  const tool = TOOLS.find((t) => t.id === toolId);
  if (tool && !tool.requiresFileLimit) return { verifyMb: 99999, membershipMb: 99999 };
  return {
    verifyMb: parseMb(c[`verify.mb.${toolId}`], gVerify),
    membershipMb: parseMb(c[`membership.mb.${toolId}`], gMembership),
  };
}

export async function getPublicConfig(): Promise<PublicConfig> {
  const c = await getConfig();
  const out: Record<string, ToolThresholds> = {};
  for (const t of TOOLS) {
    if (!t.requiresFileLimit) {
      out[t.id] = { verifyMb: 99999, membershipMb: 99999 };
    } else {
      out[t.id] = {
        verifyMb: parseMb(c[`verify.mb.${t.id}`] ?? c["verify.mb"], 8),
        membershipMb: parseMb(c[`membership.mb.${t.id}`] ?? c["membership.mb"], 20),
      };
    }
  }
  return {
    verify: { enabled: c["verify.enabled"] !== "false", mb: parseMb(c["verify.mb"], 8) },
    membership: { enabled: c["membership.enabled"] !== "false", mb: parseMb(c["membership.mb"], 20) },
    tools: out,
  };
}

export async function verifyCode(code: string): Promise<{ ok: boolean; reason?: string }> {
  await ensureInit();
  const res = await getPool().query("SELECT * FROM verification_codes WHERE code = $1", [code]);
  if (res.rows.length === 0) return { ok: false, reason: "验证码不存在" };
  const row = res.rows[0];
  if (row.used) return { ok: false, reason: "验证码已使用" };
  if (row.expires_at < Date.now()) return { ok: false, reason: "验证码已过期" };
  await getPool().query("UPDATE verification_codes SET used = true, used_at = $1 WHERE code = $2", [Date.now(), code]);
  return { ok: true };
}

export async function generateCodes(count: number, minutes: number): Promise<string[]> {
  await ensureInit();
  const now = Date.now();
  const expires = now + minutes * 60_000;
  const codes: string[] = [];
  while (codes.length < count) {
    const c = Math.random().toString(36).slice(2, 8).toUpperCase();
    if (!codes.includes(c)) codes.push(c);
  }
  for (const c of codes) {
    await getPool().query(
      "INSERT INTO verification_codes (code, used, created_at, expires_at) VALUES ($1, false, $2, $3) ON CONFLICT DO NOTHING",
      [c, now, expires]
    );
  }
  return codes;
}

export async function cleanExpiredCodes() {
  await ensureInit();
  await getPool().query("DELETE FROM verification_codes WHERE expires_at < $1", [Date.now()]);
}

export async function createMembershipToken(tier: MembershipTier): Promise<string> {
  await ensureInit();
  const token = "MB-" + Math.random().toString(36).slice(2, 10).toUpperCase() + Math.random().toString(36).slice(2, 10).toUpperCase();
  const now = Date.now();
  const tierDef = MEMBERSHIP_TIERS.find((t) => t.id === tier) ?? MEMBERSHIP_TIERS[2];
  const expiresAt = tierDef.days === 0 ? 0 : now + tierDef.days * 86_400_000;
  await getPool().query(
    "INSERT INTO membership_tokens (token, tier, active, created_at, expires_at) VALUES ($1, $2, true, $3, $4)",
    [token, tier, now, expiresAt]
  );
  return token;
}

export async function validateMembershipToken(token: string): Promise<{ ok: boolean; tier?: MembershipTier; reason?: string }> {
  await ensureInit();
  const res = await getPool().query("SELECT * FROM membership_tokens WHERE token = $1", [token]);
  if (res.rows.length === 0) return { ok: false, reason: "会员码不存在" };
  const row = res.rows[0];
  if (!row.active) return { ok: false, reason: "会员码已停用" };
  if (row.expires_at !== 0 && row.expires_at < Date.now()) return { ok: false, reason: "会员已过期" };
  return { ok: true, tier: row.tier as MembershipTier };
}

export async function listMembershipTokens(limit = 50): Promise<any[]> {
  await ensureInit();
  const res = await getPool().query("SELECT * FROM membership_tokens ORDER BY created_at DESC LIMIT $1", [limit]);
  const now = Date.now();
  return res.rows.map((r: any) => {
    const tier = MEMBERSHIP_TIERS.find((t) => t.id === r.tier) ?? MEMBERSHIP_TIERS[2];
    const isForever = r.expires_at === 0;
    const isActive = r.active && (isForever || r.expires_at >= now);
    const remaining = isForever ? -1 : Math.max(0, Math.floor((r.expires_at - now) / 86_400_000));
    return { ...r, tierInfo: tier, isForever, isActive, remaining, expiresAtFormatted: isForever ? "永久" : new Date(r.expires_at).toLocaleString("zh-CN") };
  });
}

export async function revokeMembershipToken(token: string) {
  await ensureInit();
  await getPool().query("UPDATE membership_tokens SET active = false WHERE token = $1", [token]);
}

export async function listVerificationCodes(limit = 100): Promise<any[]> {
  await ensureInit();
  const res = await getPool().query("SELECT * FROM verification_codes ORDER BY created_at DESC LIMIT $1", [limit]);
  return res.rows;
}

export async function adminLogin(password: string): Promise<boolean> {
  const c = await getConfig();
  return c["admin.password"] === password;
}

export async function setAdminPassword(password: string) {
  await setConfig("admin.password", password);
}

export interface UserRow {
  id: number;
  login_method: string;
  email?: string | null;
  wechat_openid?: string | null;
  nickname?: string | null;
  avatar?: string | null;
  membership_tier?: string | null;
  membership_expires_at?: number | null;
  created_at: number;
  last_login_at?: number | null;
  password?: string | null;
  email_verified?: boolean;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  await ensureInit();
  const res = await getPool().query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
  return res.rows.length > 0 ? res.rows[0] : null;
}

export async function findUserByWechatOpenid(openid: string): Promise<UserRow | null> {
  await ensureInit();
  const res = await getPool().query("SELECT * FROM users WHERE wechat_openid = $1", [openid]);
  return res.rows.length > 0 ? res.rows[0] : null;
}

export async function findUserById(id: number): Promise<UserRow | null> {
  await ensureInit();
  const res = await getPool().query("SELECT * FROM users WHERE id = $1", [id]);
  return res.rows.length > 0 ? res.rows[0] : null;
}

export async function createUser(params: {
  loginMethod: "email" | "wechat";
  email?: string;
  wechatOpenid?: string;
  nickname?: string;
  avatar?: string;
}): Promise<UserRow> {
  await ensureInit();
  const now = Date.now();
  const res = await getPool().query(
    `INSERT INTO users (login_method, email, wechat_openid, nickname, avatar, created_at, last_login_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [params.loginMethod, params.email?.toLowerCase() ?? null, params.wechatOpenid ?? null, params.nickname ?? null, params.avatar ?? null, now, now]
  );
  return res.rows[0];
}

export async function touchUserLogin(userId: number) {
  await ensureInit();
  await getPool().query("UPDATE users SET last_login_at = $1 WHERE id = $2", [Date.now(), userId]);
}

export async function createLoginCode(email: string, purpose: string, expiresMinutes = 10): Promise<string> {
  await ensureInit();
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const now = Date.now();
  await getPool().query(
    "INSERT INTO login_codes (email, code, purpose, used, created_at, expires_at) VALUES ($1, $2, $3, false, $4, $5)",
    [email.toLowerCase(), code, purpose, now, now + expiresMinutes * 60_000]
  );
  return code;
}

export async function verifyLoginCode(email: string, code: string, purpose: string): Promise<{ ok: boolean; reason?: string }> {
  await ensureInit();
  const res = await getPool().query(
    "SELECT * FROM login_codes WHERE email = $1 AND code = $2 AND purpose = $3 AND used = false",
    [email.toLowerCase(), code.toUpperCase(), purpose]
  );
  if (res.rows.length === 0) return { ok: false, reason: "验证码不存在" };
  const row = res.rows[0];
  if (row.expires_at < Date.now()) return { ok: false, reason: "验证码已过期" };
  await getPool().query("UPDATE login_codes SET used = true WHERE id = $1", [row.id]);
  return { ok: true };
}

export async function findSession(token: string): Promise<{ userId: number } | null> {
  await ensureInit();
  const res = await getPool().query("SELECT user_id, expires_at FROM sessions WHERE token = $1", [token]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  if (row.expires_at < Date.now()) {
    await getPool().query("DELETE FROM sessions WHERE token = $1", [token]);
    return null;
  }
  return { userId: row.user_id };
}

export async function createSession(userId: number, token: string, expiresDays = 30) {
  await ensureInit();
  const now = Date.now();
  await getPool().query("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)", [token, userId, now, now + expiresDays * 86_400_000]);
}

export async function deleteSession(token: string) {
  await ensureInit();
  await getPool().query("DELETE FROM sessions WHERE token = $1", [token]);
}

export async function bindMembershipToUser(userId: number, token: string): Promise<{ ok: boolean; tier?: MembershipTier; reason?: string }> {
  await ensureInit();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query("SELECT * FROM membership_tokens WHERE token = $1 FOR UPDATE", [token]);
    if (res.rows.length === 0) { await client.query("ROLLBACK"); return { ok: false, reason: "会员码不存在" }; }
    const row = res.rows[0];
    if (!row.active) { await client.query("ROLLBACK"); return { ok: false, reason: "会员码已停用" }; }
    if (row.expires_at !== 0 && row.expires_at < Date.now()) { await client.query("ROLLBACK"); return { ok: false, reason: "会员码已过期" }; }
    if (row.bound_user_id) { await client.query("ROLLBACK"); return { ok: false, reason: "会员码已被绑定到其他账号" }; }
    const tierDef = MEMBERSHIP_TIERS.find((t) => t.id === row.tier) ?? MEMBERSHIP_TIERS[2];
    const now = Date.now();
    const userRes = await client.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) { await client.query("ROLLBACK"); return { ok: false, reason: "用户不存在" }; }
    const user = userRes.rows[0];
    await client.query("UPDATE membership_tokens SET bound_user_id = $1, bound_at = $2 WHERE token = $3", [userId, now, token]);
    const isForever = tierDef.days === 0;
    const newExpires = isForever ? 0 : now + tierDef.days * 86_400_000;
    const currentExpires = user.membership_expires_at;
    const currentTier = user.membership_tier;
    const hasExistingMembership = currentExpires !== null && currentExpires !== undefined;
    const existingIsForever = hasExistingMembership && currentExpires === 0;
    let finalExpires: number; let finalTier: string;
    if (!hasExistingMembership) { finalExpires = newExpires; finalTier = row.tier; }
    else if (existingIsForever) { finalExpires = 0; finalTier = currentTier || row.tier; }
    else if ((currentExpires as number) > now) { finalExpires = isForever ? 0 : Math.max(currentExpires as number, newExpires); finalTier = row.tier; }
    else { finalExpires = newExpires; finalTier = row.tier; }
    await client.query("UPDATE users SET membership_tier = $1, membership_expires_at = $2 WHERE id = $3", [finalTier, finalExpires, userId]);
    await client.query("COMMIT");
    return { ok: true, tier: row.tier as MembershipTier };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export function getUser(user: UserRow): UserRow & { isMember: boolean; tierInfo?: typeof MEMBERSHIP_TIERS[number]; remainingDays: number } {
  const isForever = user.membership_expires_at === 0;
  const isMember = !!(user.membership_tier && (isForever || (user.membership_expires_at ?? 0) > Date.now()));
  const tierInfo = user.membership_tier ? MEMBERSHIP_TIERS.find((t) => t.id === user.membership_tier) : undefined;
  const remainingDays = isForever ? -1 : user.membership_expires_at ? Math.max(0, Math.floor((user.membership_expires_at - Date.now()) / 86_400_000)) : 0;
  return { ...user, isMember, tierInfo, remainingDays };
}

export async function validateMembershipForUser(userId: number): Promise<{ ok: boolean; tier?: MembershipTier; reason?: string }> {
  const user = await findUserById(userId);
  if (!user) return { ok: false, reason: "用户不存在" };
  if (!user.membership_tier) return { ok: false, reason: "非会员" };
  if (user.membership_expires_at !== 0 && (user.membership_expires_at ?? 0) < Date.now()) return { ok: false, reason: "会员已过期" };
  return { ok: true, tier: user.membership_tier as MembershipTier };
}

export async function setUserPassword(userId: number, hashedPassword: string) {
  await ensureInit();
  await getPool().query("UPDATE users SET password = $1, email_verified = true WHERE id = $2", [hashedPassword, userId]);
}

export async function updateUserPassword(userId: number, hashedPassword: string) {
  await ensureInit();
  await getPool().query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, userId]);
}

export async function hasPassword(userId: number): Promise<boolean> {
  await ensureInit();
  const res = await getPool().query("SELECT password FROM users WHERE id = $1", [userId]);
  return !!res.rows[0]?.password;
}
