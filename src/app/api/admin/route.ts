import { NextRequest, NextResponse } from "next/server";
import { adminLogin, getPublicConfig, getConfig, setConfig, generateCodes, listVerificationCodes, createMembershipToken, listMembershipTokens, revokeMembershipToken, MEMBERSHIP_TIERS, type MembershipTier } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("x-admin-auth");
  if (!auth) return false;
  const expected = process.env.ADMIN_TOKEN;
  if (expected) return auth === expected;
  const cfg = await getConfig();
  return auth === cfg["admin.password"];
}

function ok() { return NextResponse.json({ ok: true }); }

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ ok: false, reason: "未授权" }, { status: 401 });
  const cfg = await getConfig();
  const codes = await listVerificationCodes(50);
  const tokens = await listMembershipTokens(50);
  const pub = await getPublicConfig();
  return NextResponse.json({ ok: true, config: cfg, public: pub, codes, tokens, tiers: MEMBERSHIP_TIERS });
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const action = body?.action;

  if (action === "login") {
    const pwd = String(body?.password || "");
    if (await adminLogin(pwd)) return NextResponse.json({ ok: true });
    return NextResponse.json({ ok: false, reason: "密码错误" }, { status: 401 });
  }

  if (!(await requireAdmin(req))) return NextResponse.json({ ok: false, reason: "未授权" }, { status: 401 });

  if (action === "update-config") {
    const updates = body?.updates as Record<string, string> | undefined;
    if (!updates) return NextResponse.json({ ok: false }, { status: 400 });
    for (const [k, v] of Object.entries(updates)) await setConfig(k, String(v));
    return ok();
  }

  if (action === "generate-codes") {
    const count = Math.min(500, Math.max(1, parseInt(body?.count || "20", 10)));
    const minutes = Math.max(5, parseInt(body?.minutes || "30", 10));
    const codes = await generateCodes(count, minutes);
    return NextResponse.json({ ok: true, codes });
  }

  if (action === "create-membership") {
    const tier = (body?.tier as MembershipTier) || "year";
    const tierDef = MEMBERSHIP_TIERS.find((t) => t.id === tier);
    if (!tierDef) return NextResponse.json({ ok: false, reason: "无效套餐" }, { status: 400 });
    const token = await createMembershipToken(tier);
    return NextResponse.json({ ok: true, token, tier, tierName: tierDef.name, days: tierDef.days });
  }

  if (action === "revoke-membership") {
    const token = String(body?.token || "");
    if (!token) return NextResponse.json({ ok: false, reason: "缺少 token" }, { status: 400 });
    await revokeMembershipToken(token);
    return ok();
  }

  if (action === "set-password") {
    const pwd = String(body?.password || "");
    if (!pwd) return NextResponse.json({ ok: false, reason: "密码不能为空" }, { status: 400 });
    await setConfig("admin.password", pwd);
    return ok();
  }

  return NextResponse.json({ ok: false, reason: "未知 action" }, { status: 400 });
}
