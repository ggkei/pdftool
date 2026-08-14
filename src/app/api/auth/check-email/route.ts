import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const email = String(body?.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ ok: false, reason: "请输入邮箱" }, { status: 400 });
  }

  const user = await findUserByEmail(email) as any;
  return NextResponse.json({
    ok: true,
    exists: !!user,
    hasPassword: !!user?.password,
  });
}
