import { NextRequest, NextResponse } from "next/server";
import { recordAdSuccessAndGrant } from "@/lib/db";

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

  try {
    const result = await recordAdSuccessAndGrant(identifier, identifierType, adUnitId);
    return NextResponse.json({
      ok: true,
      code: result.code,
      membershipCode: result.membershipCode,
      rewardGranted: result.rewardGranted,
      adCount: result.adCount,
    });
  } catch (error) {
    console.error("ad-reward error:", error);
    return NextResponse.json({ ok: false, reason: "处理失败" }, { status: 500 });
  }
}