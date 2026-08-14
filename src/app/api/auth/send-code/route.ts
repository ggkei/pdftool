import { NextRequest, NextResponse } from "next/server";
import { createLoginCode, findUserByEmail, createUser } from "@/lib/db";
import { sendLoginCodeEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const email = String(body?.email || "").trim().toLowerCase();
  const purpose = String(body?.purpose || "login").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, reason: "邮箱格式不正确" }, { status: 400 });
  }

  if (purpose === "register") {
    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json({
        ok: false,
        reason: "该邮箱已注册，您可以直接登录。如忘记密码，可通过邮箱找回。",
        alreadyRegistered: true,
      }, { status: 409 });
    }
  }

  if (purpose === "reset") {
    const existing = await findUserByEmail(email);
    if (!existing) {
      return NextResponse.json({ ok: false, reason: "该邮箱未注册" }, { status: 400 });
    }
  }

  const code = await createLoginCode(email, purpose);
  const result = await sendLoginCodeEmail(email, code);

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: "验证码发送失败，请稍后重试" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    devCode: result.devCode ?? undefined,
    hint: result.devCode ? "（开发模式：验证码已打印到服务器控制台）" : undefined,
  });
}
