import { NextRequest, NextResponse } from "next/server";
import { bindMembershipToUser } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, reason: "请先登录" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const token = String(body?.token || "").trim();
  if (!token) return NextResponse.json({ ok: false, reason: "请输入会员码" }, { status: 400 });

  const result = await bindMembershipToUser(user.id, token);
  if (!result.ok) return NextResponse.json(result, { status: 400 });

  return NextResponse.json({ ok: true, tier: result.tier });
}
