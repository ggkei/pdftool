import { NextRequest, NextResponse } from "next/server";
import { validateMembershipToken, bindMembershipToUser, validateMembershipForUser } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, loggedIn: false });
  return NextResponse.json({
    ok: user.isMember,
    loggedIn: true,
    isMember: user.isMember,
    tierInfo: user.tierInfo,
    remainingDays: user.remainingDays,
    email: user.email,
  });
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const token = String(body?.token || "").trim();
  if (!token) return NextResponse.json({ ok: false, reason: "请输入会员码" }, { status: 400 });

  const user = await getCurrentUser();
  if (user) {
    const bindResult = await bindMembershipToUser(user.id, token);
    if (bindResult.ok) {
      return NextResponse.json({ ok: true, tier: bindResult.tier, bound: true });
    }
    return NextResponse.json({ ok: false, reason: bindResult.reason || "绑定失败" }, { status: 400 });
  }

  const result = await validateMembershipToken(token);
  if (!result.ok) return NextResponse.json({ ok: false, reason: "会员码无效或已过期" }, { status: 400 });
  return NextResponse.json({ ok: true, tier: result.tier, bound: false, needLogin: true });
}
