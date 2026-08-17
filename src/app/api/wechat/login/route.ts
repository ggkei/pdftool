import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, reason: "请求格式错误" }, { status: 400 }); }

  const { code } = body;
  if (!code) return NextResponse.json({ ok: false, reason: "缺少 code 参数" }, { status: 400 });

  const appid = process.env.WECHAT_MINIAPP_APPID;
  const secret = process.env.WECHAT_MINIAPP_SECRET;

  if (!appid || !secret) {
    if (process.env.NODE_ENV === "development") {
      const testOpenid = "test_" + code.slice(0, 8);
      return NextResponse.json({ ok: true, openid: testOpenid, dev: true });
    }
    return NextResponse.json({ ok: false, reason: "小程序未配置，请在环境变量中设置 WECHAT_MINIAPP_APPID 和 WECHAT_MINIAPP_SECRET" }, { status: 500 });
  }

  try {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.errcode) {
      return NextResponse.json({ ok: false, reason: data.errmsg || "微信登录失败" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, openid: data.openid });
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: e?.message || "服务器错误" }, { status: 500 });
  }
}
