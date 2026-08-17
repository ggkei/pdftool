import { NextRequest, NextResponse } from "next/server";
import { getOrder } from "@/lib/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId");
  if (!orderId) return NextResponse.json({ ok: false, reason: "缺少订单号" }, { status: 400 });

  const order = getOrder(orderId);
  if (!order) return NextResponse.json({ ok: false, reason: "订单不存在" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    orderId: order.orderId,
    status: order.status,
    tier: order.tier,
    tierName: order.tierName,
    amount: order.amount,
    membershipCode: order.status === "paid" ? order.membershipCode : undefined,
    paidAt: order.paidAt,
  });
}