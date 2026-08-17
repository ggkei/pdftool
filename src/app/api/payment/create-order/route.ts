import { NextRequest, NextResponse } from "next/server";
import { getPayJSConfig, createPayJSOrder } from "@/lib/payjs";
import { createOrder, PAYMENT_PRICES } from "@/lib/payment";
import { MEMBERSHIP_TIERS } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, reason: "无效请求" }, { status: 400 }); }

  const tier = String(body?.tier || "").trim();
  const validTier = MEMBERSHIP_TIERS.find((t) => t.id === tier);
  if (!validTier) return NextResponse.json({ ok: false, reason: "无效的会员类型" }, { status: 400 });

  const amount = PAYMENT_PRICES[tier] ?? 100;
  const config = getPayJSConfig();

  if (!config) {
    // Mock mode: no PAYJS credentials, generate a placeholder QR code
    const order = createOrder(tier, "mock_qrcode_" + Date.now());
    return NextResponse.json({
      ok: true,
      orderId: order.orderId,
      tier: order.tier,
      tierName: order.tierName,
      amount: order.amount,
      qrcode: null,
      mock: true,
      message: "本地测试模式，调用 /api/payment/test-pay 模拟支付",
    });
  }

  // Production: call PAYJS API
  try {
    const order = createOrder(tier);
    const result = await createPayJSOrder({
      mchid: config.mchid,
      key: config.key,
      amount,
      outTradeNo: order.orderId,
      body: `PDF工具-${validTier.name}`,
      notifyUrl: config.notifyUrl,
    });

    if (result.error) {
      return NextResponse.json({ ok: false, reason: result.error }, { status: 500 });
    }

    order.qrcode = result.qrcode;
    return NextResponse.json({
      ok: true,
      orderId: order.orderId,
      tier: order.tier,
      tierName: order.tierName,
      amount: order.amount,
      qrcode: result.qrcode,
      mock: false,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: e?.message || "创建订单失败" }, { status: 500 });
  }
}