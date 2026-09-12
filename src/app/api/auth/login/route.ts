import { NextRequest, NextResponse } from "next/server";
import { verifyLoginCode, findUserByEmail } from "@/lib/db";
import { loginUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const email = String(body?.email || "").trim().toLowerCase();
  const code = String(body?.code || "").trim().toUpperCase();

  if (!email || !code) {
    return NextResponse.json({ ok: false, reason: "请输入邮箱和验证码" }, { status: 400 });
  }

  const result = await verifyLoginCode(email, code, "login");
  if (!result.ok) return NextResponse.json(result, { status: 400 });

  const user = await findUserByEmail(email);
  if (!user) return NextResponse.json({ ok: false, reason: "用户不存在" }, { status: 400 });

  await loginUser(user.id);

  return NextResponse.json({ ok: true, userId: user.id });
}
