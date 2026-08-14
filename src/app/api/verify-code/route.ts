import { NextRequest, NextResponse } from "next/server";
import { verifyCode } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, reason: "无效请求" }, { status: 400 }); }
  const code = String(body?.code || "").trim().toUpperCase();
  if (!code) return NextResponse.json({ ok: false, reason: "请输入验证码" }, { status: 400 });
  const result = await verifyCode(code);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true });
}
