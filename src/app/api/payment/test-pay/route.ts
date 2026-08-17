import { NextRequest, NextResponse } from "next/server";
import { markOrderPaid } from "@/lib/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, reason: "无效请求" }, { status: 400 }); }

  const orderId = String(body?.orderId || "").trim();
  if (!orderId) return NextResponse.json({ ok: false, reason: "缺少订单号" }, { status: 400 });

  const result = markOrderPaid(orderId);
  if (result.ok) {
    return NextResponse.json({
      ok: true,
      message: "模拟支付成功",
      membershipCode: result.membershipCode,
    });
  }
  return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
}