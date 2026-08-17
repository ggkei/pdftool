import { NextRequest, NextResponse } from "next/server";
import { bindMembershipToUser } from "@/lib/db";
import { validateTokenInMemory, markTokenUsedInMemory } from "@/lib/inMemoryDb";
import { getCurrentUser } from "@/lib/auth";
import { MEMBERSHIP_TIERS } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const token = String(body?.token || "").trim();
  if (!token) return NextResponse.json({ ok: false, reason: "请输入会员码" }, { status: 400 });

  // Check in-memory first (instant, for local testing)
  const memResult = validateTokenInMemory(token);
  if (memResult.ok) {
    // Mark token as used IMMEDIATELY (one-time use)
    markTokenUsedInMemory(token);
    const tierDef = MEMBERSHIP_TIERS.find(t => t.id === memResult.tier);
    let user = null;
    try { user = await getCurrentUser(); } catch {}
    return NextResponse.json({ 
      ok: true, 
      tier: memResult.tier,
      tierName: tierDef?.name || "日卡",
      tierColor: tierDef?.color || "bg-green-100 text-green-700",
      days: tierDef?.days ?? 1,
      mode: "in-memory",
      expiresAt: memResult.expiresAt 
    });
  }

  // Token exists in memory but can't be used (already used, expired, or inactive)
  // Return the error directly instead of falling through to database
  if (memResult.reason !== "会员码不存在") {
    return NextResponse.json({ ok: false, reason: memResult.reason }, { status: 400 });
  }

  // Token not in memory - try real database
  let user = null;
  try { user = await getCurrentUser(); } catch { return NextResponse.json({ ok: false, reason: "数据库连接失败" }, { status: 500 }); }
  if (!user) return NextResponse.json({ ok: false, reason: "请先登录" }, { status: 401 });

  try {
    const result = await bindMembershipToUser(user.id, token);
    if (result.ok) return NextResponse.json({ ok: true, tier: result.tier });
    return NextResponse.json(result, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, reason: "会员码无效或已过期" }, { status: 400 });
  }
}