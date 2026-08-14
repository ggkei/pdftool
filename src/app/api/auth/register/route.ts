import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, createUser, verifyLoginCode, setUserPassword } from "@/lib/db";
import { loginUser } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const code = String(body?.code || "").trim().toUpperCase();

  if (!email || !password || !code) {
    return NextResponse.json({ ok: false, reason: "请填写邮箱、密码和验证码" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, reason: "邮箱格式不正确" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ ok: false, reason: "密码至少 6 位" }, { status: 400 });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({
      ok: false,
      reason: "该邮箱已注册，您可以直接登录。如忘记密码，可通过邮箱找回。",
      alreadyRegistered: true,
    }, { status: 409 });
  }

  const codeResult = await verifyLoginCode(email, code, "register");
  if (!codeResult.ok) {
    return NextResponse.json({ ok: false, reason: codeResult.reason || "验证码错误" }, { status: 400 });
  }

  const user = await createUser({ loginMethod: "email", email });
  const hashed = bcrypt.hashSync(password, 10);
  await setUserPassword(user.id, hashed);

  await loginUser(user.id);

  return NextResponse.json({ ok: true, userId: user.id });
}
