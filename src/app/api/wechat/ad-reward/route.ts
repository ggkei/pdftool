import { NextRequest, NextResponse } from "next/server";
import { recordAdSuccessAndGrant } from "@/lib/db";
import { recordAdAndGrant } from "@/lib/inMemoryDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, reason: "请求格式错误" }, { status: 400 }); }

  const { identifier, identifierType, adUnitId } = body;
  if (!identifier || !identifierType) {
    return NextResponse.json({ ok: false, reason: "缺少必要参数" }, { status: 400 });
  }
  if (!["email", "openid"].includes(identifierType)) {
    return NextResponse.json({ ok: false, reason: "无效的标识类型" }, { status: 400 });
  }

  // Try real database first, fallback to in-memory for local testing
  try {
    const result = await recordAdSuccessAndGrant(identifier, identifierType, adUnitId);
    return NextResponse.json({
      ok: true, code: result.code, membershipCode: result.membershipCode,
      rewardGranted: result.rewardGranted, adCount: result.adCount,
    });
  } catch {
    // In-memory fallback (local testing without database)
    const result = recordAdAndGrant(identifier, identifierType, adUnitId);
    return NextResponse.json({
      ok: true, code: result.code, membershipCode: result.membershipCode,
      rewardGranted: result.rewardGranted, adCount: result.adCount,
      mode: "in-memory",
    });
  }
}