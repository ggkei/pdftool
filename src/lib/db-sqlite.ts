import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { TOOLS, TOOL_IDS, DEFAULT_TOOL_THRESHOLDS, MEMBERSHIP_TIERS, PDF_TOOLS, UTIL_TOOLS, type ToolDef, type MembershipTier } from "./tools";

export { TOOLS, TOOL_IDS, PDF_TOOLS, UTIL_TOOLS, MEMBERSHIP_TIERS };
export type { ToolDef, MembershipTier };

const DB_PATH = process.env.SQLITE_PATH || "./dev.sqlite";
let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

async function initDb() {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS verification_codes (
      code TEXT PRIMARY KEY,
      used INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL,
      used_at BIGINT
    );
    CREATE TABLE IF NOT EXISTS membership_tokens (
      token TEXT PRIMARY KEY,
      tier TEXT NOT NULL DEFAULT 'year',
      active INTEGER NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL,
      bound_user_id INTEGER,
      bound_at BIGINT
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login_method TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      wechat_openid TEXT UNIQUE,
      nickname TEXT,
      avatar TEXT,
      membership_tier TEXT,
      membership_expires_at BIGINT,
      created_at BIGINT NOT NULL,
      last_login_at BIGINT,
      password TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS login_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      phone TEXT,
      code TEXT NOT NULL,
      purpose TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS verification_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT NOT NULL,
      identifier_type TEXT NOT NULL,
      ad_success INTEGER NOT NULL DEFAULT 0,
      ad_unit_id TEXT,
      code TEXT,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes(email);
    CREATE INDEX IF NOT EXISTS idx_verification_records_identifier ON verification_records(identifier);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  `);

  const now = Date.now();
  const defaults: Record<string, string> = {
    "verify.enabled": "true",
    "verify.mb": "8",
    "verify.minutes": "15",
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

  const insertConfig = d.prepare(
    `INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING`
  );
  for (const [k, v] of Object.entries(defaults)) {
    insertConfig.run(k, v, now);
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
  const rows = getDb().prepare("SELECT key, value FROM config").all() as Array<{ key: string; value: string }>;
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setConfig(key: string, value: string) {
  await ensureInit();
  getDb().prepare(
    `INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value, Date.now());
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
  const row = getDb().prepare("SELECT * FROM verification_codes WHERE code = ?").get(code) as any;
  if (!row) return { ok: false, reason: "验证码不存在" };
  if (row.used) return { ok: false, reason: "验证码已使用" };
  if (row.expires_at < Date.now()) return { ok: false, reason: "验证码已过期" };
  getDb().prepare("UPDATE verification_codes SET used = 1, used_at = ? WHERE code = ?").run(Date.now(), code);
  return { ok: true };
}

export async function createVerificationCode(minutes = 15): Promise<string> {
  await ensureInit();
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const now = Date.now();
  getDb().prepare(
    "INSERT INTO verification_codes (code, used, created_at, expires_at) VALUES (?, 0, ?, ?)"
  ).run(code, now, now + minutes * 60 * 1000);
  return code;
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
  const stmt = getDb().prepare(
    "INSERT OR IGNORE INTO verification_codes (code, used, created_at, expires_at) VALUES (?, 0, ?, ?)"
  );
  for (const c of codes) {
    stmt.run(c, now, expires);
  }
  return codes;
}

export async function cleanExpiredCodes() {
  await ensureInit();
  getDb().prepare("DELETE FROM verification_codes WHERE expires_at < ?").run(Date.now());
}

export async function createMembershipToken(tier: MembershipTier): Promise<string> {
  await ensureInit();
  const token = "MB-" + Math.random().toString(36).slice(2, 10).toUpperCase() + Math.random().toString(36).slice(2, 10).toUpperCase();
  const now = Date.now();
  const tierDef = MEMBERSHIP_TIERS.find((t) => t.id === tier) ?? MEMBERSHIP_TIERS[2];
  const expiresAt = tierDef.days === 0 ? 0 : now + tierDef.days * 86_400_000;
  getDb().prepare(
    "INSERT INTO membership_tokens (token, tier, active, created_at, expires_at) VALUES (?, ?, 1, ?, ?)"
  ).run(token, tier, now, expiresAt);
  return token;
}

export async function createTempMembershipToken(durationHours = 24): Promise<string> {
  await ensureInit();
  const token = "TEMP24-" + Math.random().toString(36).slice(2, 10).toUpperCase();
  const now = Date.now();
  getDb().prepare(
    "INSERT INTO membership_tokens (token, tier, active, created_at, expires_at) VALUES (?, 'temp24', 1, ?, ?)"
  ).run(token, now, now + durationHours * 3600_000);
  return token;
}

export async function validateMembershipToken(token: string): Promise<{ ok: boolean; tier?: MembershipTier; expiresAt?: number; reason?: string }> {
  await ensureInit();
  const row = getDb().prepare("SELECT * FROM membership_tokens WHERE token = ?").get(token) as any;
  if (!row) return { ok: false, reason: "会员码不存在" };
  if (!row.active) return { ok: false, reason: "会员码已停用" };
  if (row.expires_at !== 0 && row.expires_at < Date.now()) return { ok: false, reason: "会员已过期" };
  return { ok: true, tier: row.tier as MembershipTier, expiresAt: row.expires_at };
}

export async function listMembershipTokens(limit = 50): Promise<any[]> {
  await ensureInit();
  const rows = getDb().prepare("SELECT * FROM membership_tokens ORDER BY created_at DESC LIMIT ?").all(limit) as any[];
  const now = Date.now();
  return rows.map((r: any) => {
    const tier = MEMBERSHIP_TIERS.find((t) => t.id === r.tier) ?? MEMBERSHIP_TIERS[2];
    const isForever = r.expires_at === 0;
    const isActive = r.active && (isForever || r.expires_at >= now);
    const remaining = isForever ? -1 : Math.max(0, Math.floor((r.expires_at - now) / 86_400_000));
    return { ...r, tierInfo: tier, isForever, isActive, remaining, expiresAtFormatted: isForever ? "永久" : new Date(r.expires_at).toLocaleString("zh-CN") };
  });
}

export async function revokeMembershipToken(token: string) {
  await ensureInit();
  getDb().prepare("UPDATE membership_tokens SET active = 0 WHERE token = ?").run(token);
}

export async function listVerificationCodes(limit = 100): Promise<any[]> {
  await ensureInit();
  return getDb().prepare("SELECT * FROM verification_codes ORDER BY created_at DESC LIMIT ?").all(limit) as any[];
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
  const row = getDb().prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as any;
  return row ?? null;
}

export async function findUserByPhone(phone: string): Promise<UserRow | null> {
  await ensureInit();
  const row = getDb().prepare("SELECT * FROM users WHERE phone = ?").get(phone.replace(/\D/g, "")) as any;
  return row ?? null;
}

export async function findUserByWechatOpenid(openid: string): Promise<UserRow | null> {
  await ensureInit();
  const row = getDb().prepare("SELECT * FROM users WHERE wechat_openid = ?").get(openid) as any;
  return row ?? null;
}

export async function findUserById(id: number): Promise<UserRow | null> {
  await ensureInit();
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
  return row ?? null;
}

export async function createUser(params: {
  loginMethod: "email" | "wechat" | "phone";
  email?: string;
  phone?: string;
  wechatOpenid?: string;
  nickname?: string;
  avatar?: string;
}): Promise<UserRow> {
  await ensureInit();
  const now = Date.now();
  const d = getDb();
  d.prepare(
    `INSERT INTO users (login_method, email, phone, wechat_openid, nickname, avatar, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    params.loginMethod,
    params.email?.toLowerCase() ?? null,
    params.phone?.replace(/\D/g, "") ?? null,
    params.wechatOpenid ?? null,
    params.nickname ?? null,
    params.avatar ?? null,
    now,
    now
  );
  const row = d.prepare("SELECT * FROM users WHERE rowid = last_insert_rowid()").get() as any;
  return row;
}

export async function touchUserLogin(userId: number) {
  await ensureInit();
  getDb().prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(Date.now(), userId);
}

export async function createLoginCode(
  identifier: string,
  purpose: string,
  type: "email" | "phone" = "email",
  expiresMinutes = 10
): Promise<string> {
  await ensureInit();
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const now = Date.now();
  getDb().prepare(
    "INSERT INTO login_codes (email, phone, code, purpose, used, created_at, expires_at) VALUES (?, ?, ?, ?, 0, ?, ?)"
  ).run(
    type === "email" ? identifier.toLowerCase() : null,
    type === "phone" ? identifier : null,
    code,
    purpose,
    now,
    now + expiresMinutes * 60_000
  );
  return code;
}

export async function verifyLoginCode(
  identifier: string,
  code: string,
  purpose: string,
  type: "email" | "phone" = "email"
): Promise<{ ok: boolean; reason?: string }> {
  await ensureInit();
  let row: any;
  if (type === "phone") {
    row = getDb().prepare("SELECT * FROM login_codes WHERE phone = ? AND code = ? AND purpose = ? AND used = 0").get(identifier, code.toUpperCase(), purpose);
  } else {
    row = getDb().prepare("SELECT * FROM login_codes WHERE email = ? AND code = ? AND purpose = ? AND used = 0").get(identifier.toLowerCase(), code.toUpperCase(), purpose);
  }
  if (!row) return { ok: false, reason: "验证码不存在" };
  if (row.expires_at < Date.now()) return { ok: false, reason: "验证码已过期" };
  getDb().prepare("UPDATE login_codes SET used = 1 WHERE id = ?").run(row.id);
  return { ok: true };
}

export async function findSession(token: string): Promise<{ userId: number } | null> {
  await ensureInit();
  const row = getDb().prepare("SELECT user_id, expires_at FROM sessions WHERE token = ?").get(token) as any;
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  return { userId: row.user_id };
}

export async function createSession(userId: number, token: string, expiresDays = 30) {
  await ensureInit();
  const now = Date.now();
  getDb().prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(token, userId, now, now + expiresDays * 86_400_000);
}

export async function deleteSession(token: string) {
  await ensureInit();
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export const MAX_SESSIONS = 3;

export async function enforceSessionLimit(userId: number, maxSessions: number = MAX_SESSIONS) {
  await ensureInit();
  const now = Date.now();
  getDb().prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at < ?").run(userId, now);
  const countRow = getDb().prepare("SELECT COUNT(*) as cnt FROM sessions WHERE user_id = ?").get(userId) as any;
  const count = countRow?.cnt ?? 0;
  if (count >= maxSessions) {
    const toDelete = count - maxSessions + 1;
    getDb().prepare(
      "DELETE FROM sessions WHERE token IN (SELECT token FROM sessions WHERE user_id = ? ORDER BY created_at ASC LIMIT ?)"
    ).run(userId, toDelete);
  }
}

export async function bindMembershipToUser(userId: number, token: string): Promise<{ ok: boolean; tier?: MembershipTier; reason?: string }> {
  await ensureInit();
  const d = getDb();
  const tx = d.transaction(() => {
    const row = d.prepare("SELECT * FROM membership_tokens WHERE token = ?").get(token) as any;
    if (!row) return { ok: false, reason: "会员码不存在" } as const;
    if (!row.active) return { ok: false, reason: "会员码已停用" } as const;
    if (row.expires_at !== 0 && row.expires_at < Date.now()) return { ok: false, reason: "会员码已过期" } as const;
    if (row.bound_user_id) return { ok: false, reason: "会员码已被绑定到其他账号" } as const;

    const tierDef = MEMBERSHIP_TIERS.find((t) => t.id === row.tier) ?? MEMBERSHIP_TIERS[2];
    const now = Date.now();
    const user = d.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    if (!user) return { ok: false, reason: "用户不存在" } as const;

    d.prepare("UPDATE membership_tokens SET bound_user_id = ?, bound_at = ? WHERE token = ?").run(userId, now, token);
    const isForever = tierDef.days === 0;
    const newExpires = isForever ? 0 : now + tierDef.days * 86_400_000;
    const currentExpires = user.membership_expires_at;
    const currentTier = user.membership_tier;
    const hasExistingMembership = currentExpires !== null && currentExpires !== undefined;
    const existingIsForever = hasExistingMembership && currentExpires === 0;
    let finalExpires: number; let finalTier: string;
    if (!hasExistingMembership) { finalExpires = newExpires; finalTier = row.tier; }
    else if (existingIsForever) { finalExpires = 0; finalTier = currentTier || row.tier; }
    else if ((currentExpires as number) > now) { finalExpires = isForever ? 0 : (currentExpires as number) + tierDef.days * 86_400_000; finalTier = row.tier; }
    else { finalExpires = newExpires; finalTier = row.tier; }
    d.prepare("UPDATE users SET membership_tier = ?, membership_expires_at = ? WHERE id = ?").run(finalTier, finalExpires, userId);
    return { ok: true, tier: row.tier as MembershipTier };
  });
  return tx() as { ok: boolean; tier?: MembershipTier; reason?: string };
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
  getDb().prepare("UPDATE users SET password = ?, email_verified = 1 WHERE id = ?").run(hashedPassword, userId);
}

export async function updateUserPassword(userId: number, hashedPassword: string) {
  await ensureInit();
  getDb().prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, userId);
}

export async function hasPassword(userId: number): Promise<boolean> {
  await ensureInit();
  const row = getDb().prepare("SELECT password FROM users WHERE id = ?").get(userId) as any;
  return !!row?.password;
}

export async function recordAdSuccessAndGrant(
  identifier: string,
  identifierType: string,
  adUnitId?: string
): Promise<{ code: string; membershipCode?: string; rewardGranted: boolean; adCount: number }> {
  await ensureInit();
  const now = Date.now();
  const code = await createVerificationCode(15);

  getDb().prepare(
    "INSERT INTO verification_records (identifier, identifier_type, ad_success, ad_unit_id, code, created_at) VALUES (?, ?, 1, ?, ?, ?)"
  ).run(identifier, identifierType, adUnitId || null, code, now);

  const twelveHoursAgo = now - 12 * 3600_000;
  const countRow = getDb().prepare(
    "SELECT COUNT(*) as cnt FROM verification_records WHERE identifier = ? AND ad_success = 1 AND created_at >= ?"
  ).get(identifier, twelveHoursAgo) as any;
  const adCount = countRow?.cnt ?? 0;

  if (adCount === 3) {
    const membershipCode = await createMembershipToken("day");
    return { code, membershipCode, rewardGranted: true, adCount };
  }

  return { code, rewardGranted: false, adCount };
}
