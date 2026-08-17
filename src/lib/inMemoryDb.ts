// In-memory storage for local testing (no database needed)
// Use globalThis to share state across Next.js dev mode module instances
import { MEMBERSHIP_TIERS } from "./tools";

declare global {
  var __mockDb: {
    verifyCodes: Map<string, { used: boolean; createdAt: number; expiresAt: number }>;
    membershipTokens: Map<string, { tier: string; active: boolean; createdAt: number; expiresAt: number; bound?: boolean }>;
    adRecords: { identifier: string; adSuccess: boolean; code: string; createdAt: number }[];
  } | undefined;
}

if (!globalThis.__mockDb) {
  globalThis.__mockDb = {
    verifyCodes: new Map(),
    membershipTokens: new Map(),
    adRecords: [],
  };
}

const db = globalThis.__mockDb;

export function createVerifyCode(minutes = 15): string {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const now = Date.now();
  db.verifyCodes.set(code, { used: false, createdAt: now, expiresAt: now + minutes * 60 * 1000 });
  return code;
}

export function verifyCodeInMemory(code: string): { ok: boolean; reason?: string } {
  const row = db.verifyCodes.get(code);
  if (!row) return { ok: false, reason: "验证码不存在" };
  if (row.used) return { ok: false, reason: "验证码已使用" };
  if (row.expiresAt < Date.now()) return { ok: false, reason: "验证码已过期" };
  row.used = true;
  return { ok: true };
}

export function createMembershipTokenInMemory(tier: string = "day"): string {
  const token = "MB-" + Math.random().toString(36).slice(2, 10).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  const now = Date.now();
  const tierDef = MEMBERSHIP_TIERS.find(t => t.id === tier);
  const days = tierDef?.days ?? 1;
  const expiresAt = days === 0 ? 0 : now + days * 86_400_000;
  db.membershipTokens.set(token, { tier, active: true, createdAt: now, expiresAt, bound: false });
  return token;
}

export function validateTokenInMemory(token: string): { ok: boolean; tier?: string; expiresAt?: number; reason?: string } {
  const row = db.membershipTokens.get(token);
  if (!row) return { ok: false, reason: "会员码不存在" };
  if (!row.active) return { ok: false, reason: "会员码已停用" };
  if (row.bound) return { ok: false, reason: "会员码已被使用" };
  if (row.expiresAt !== 0 && row.expiresAt < Date.now()) return { ok: false, reason: "会员已过期" };
  return { ok: true, tier: row.tier, expiresAt: row.expiresAt };
}

export function markTokenUsedInMemory(token: string): void {
  const row = db.membershipTokens.get(token);
  if (row) {
    row.bound = true;
  }
}

export function recordAdAndGrant(identifier: string, identifierType: string, adUnitId?: string): {
  code: string; membershipCode?: string; rewardGranted: boolean; adCount: number;
} {
  const code = createVerifyCode(15);
  const now = Date.now();
  db.adRecords.push({ identifier, adSuccess: true, code, createdAt: now });

  const twelveHoursAgo = now - 12 * 3600_000;
  const count = db.adRecords.filter(r => r.identifier === identifier && r.adSuccess && r.createdAt >= twelveHoursAgo).length;

  if (count === 3) {
    const membershipCode = createMembershipTokenInMemory("day");
    return { code, membershipCode, rewardGranted: true, adCount: count };
  }
  return { code, rewardGranted: false, adCount: count };
}