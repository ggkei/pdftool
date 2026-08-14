import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/db";
import { loginUser } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) {
    return NextResponse.json({ ok: false, reason: "请输入邮箱和密码" }, { status: 400 });
  }

  const user = await findUserByEmail(email) as any;
  if (!user) {
    return NextResponse.json({ ok: false, reason: "邮箱未注册，请先注册" }, { status: 400 });
  }

  if (!user.password) {
    return NextResponse.json({
      ok: false,
      reason: "该账号尚未设置密码，请使用验证码登录后在账户中心设置密码",
    }, { status: 400 });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return NextResponse.json({ ok: false, reason: "密码错误" }, { status: 400 });
  }

  await loginUser(user.id);
  return NextResponse.json({ ok: true, userId: user.id });
}
