import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, verifyLoginCode, updateUserPassword } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const email = String(body?.email || "").trim().toLowerCase();
  const newPassword = String(body?.newPassword || "");
  const code = String(body?.code || "").trim().toUpperCase();

  if (!email || !newPassword || !code) {
    return NextResponse.json({ ok: false, reason: "请填写邮箱、新密码和验证码" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ ok: false, reason: "密码至少 6 位" }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return NextResponse.json({ ok: false, reason: "该邮箱未注册" }, { status: 400 });
  }

  const codeResult = await verifyLoginCode(email, code, "reset");
  if (!codeResult.ok) {
    return NextResponse.json({ ok: false, reason: codeResult.reason || "验证码错误" }, { status: 400 });
  }

  const hashed = bcrypt.hashSync(newPassword, 10);
  await updateUserPassword(user.id, hashed);

  return NextResponse.json({ ok: true });
}
