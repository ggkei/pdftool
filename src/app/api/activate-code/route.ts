import { NextRequest, NextResponse } from "next/server";
import { verifyCode, validateMembershipToken, bindMembershipToUser } from "@/lib/db";
import { verifyCodeInMemory, validateTokenInMemory } from "@/lib/inMemoryDb";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, reason: "请求格式错误" }, { status: 400 }); }
  const code = String(body?.code || "").trim();
  if (!code) return NextResponse.json({ ok: false, reason: "请输入激活码" }, { status: 400 });

  // Check in-memory first (instant, for local testing)
  const memVerify = verifyCodeInMemory(code);
  if (memVerify.ok) return NextResponse.json({ ok: true, type: "verify", mode: "in-memory" });

  const memMembership = validateTokenInMemory(code);
  if (memMembership.ok) {
    let user = null;
    let dbError = false;
    try { user = await getCurrentUser(); } catch { dbError = true; }
    if (user || dbError) return NextResponse.json({ ok: true, type: "membership", tier: memMembership.tier, bound: false, mode: "in-memory" });
    return NextResponse.json({ ok: true, type: "membership", tier: memMembership.tier, needLogin: true, mode: "in-memory" });
  }

  // Not in memory - try real database
  try {
    const result = await verifyCode(code);
    if (result.ok) return NextResponse.json({ ok: true, type: "verify" });
  } catch {}

  let user = null;
  try { user = await getCurrentUser(); } catch {}
  if (user) {
    try {
      const bindResult = await bindMembershipToUser(user.id, code);
      if (bindResult.ok) return NextResponse.json({ ok: true, type: "membership", tier: bindResult.tier, bound: true });
    } catch {}
  } else {
    try {
      const result = await validateMembershipToken(code);
      if (result.ok) return NextResponse.json({ ok: true, type: "membership", tier: result.tier, needLogin: true });
    } catch {}
  }

  return NextResponse.json({ ok: false, reason: "激活码无效或已过期" }, { status: 400 });
}