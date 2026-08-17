import { NextRequest, NextResponse } from "next/server";
import { getPayJSConfig, verifyCallback } from "@/lib/payjs";
import { markOrderPaid } from "@/lib/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const config = getPayJSConfig();
  if (!config) {
    return NextResponse.json({ return_code: 0, return_msg: "PAYJS not configured" });
  }

  let params: Record<string, string> = {};
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("json")) {
    const body = await req.json();
    params = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)]));
  } else {
    const text = await req.text();
    const searchParams = new URLSearchParams(text);
    params = Object.fromEntries(searchParams.entries());
  }

  if (!verifyCallback(params, config.key)) {
    return NextResponse.json({ return_code: 0, return_msg: "签名验证失败" });
  }

  if (params.return_code === "1") {
    const orderId = params.out_trade_no;
    const result = markOrderPaid(orderId);
    if (result.ok) {
      return NextResponse.json({ return_code: 1, return_msg: "SUCCESS" });
    }
    return NextResponse.json({ return_code: 0, return_msg: result.reason || "处理失败" });
  }

  return NextResponse.json({ return_code: 1, return_msg: "SUCCESS" });
}

// Also handle GET (PAYJS may send GET callback)
export async function GET(req: NextRequest) {
  const config = getPayJSConfig();
  if (!config) {
    return NextResponse.json({ return_code: 0, return_msg: "PAYJS not configured" });
  }

  const url = new URL(req.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  if (!verifyCallback(params, config.key)) {
    return NextResponse.json({ return_code: 0, return_msg: "签名验证失败" });
  }

  if (params.return_code === "1") {
    const orderId = params.out_trade_no;
    const result = markOrderPaid(orderId);
    if (result.ok) {
      return NextResponse.json({ return_code: 1, return_msg: "SUCCESS" });
    }
    return NextResponse.json({ return_code: 0, return_msg: result.reason || "处理失败" });
  }

  return NextResponse.json({ return_code: 1, return_msg: "SUCCESS" });
}