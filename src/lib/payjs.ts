import crypto from "crypto";

export interface PayJSConfig {
  mchid: string;
  key: string;
  notifyUrl: string;
}

export function getPayJSConfig(): PayJSConfig | null {
  const mchid = process.env.PAYJS_MCHID;
  const key = process.env.PAYJS_KEY;
  const notifyUrl = process.env.PAYJS_NOTIFY_URL || "";
  if (!mchid || !key) return null;
  return { mchid, key, notifyUrl };
}

export function sign(params: Record<string, string>, key: string): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== undefined && params[k] !== "")
    .sort();
  const str = sorted.map((k) => `${k}=${params[k]}`).join("&");
  return crypto.createHash("md5").update(str + "&key=" + key).digest("hex").toUpperCase();
}

export function verifyCallback(params: Record<string, string>, key: string): boolean {
  if (!params.sign) return false;
  const expectedSign = sign(params, key);
  return params.sign === expectedSign;
}

export async function createPayJSOrder(params: {
  mchid: string;
  key: string;
  amount: number;
  outTradeNo: string;
  body: string;
  notifyUrl: string;
}): Promise<{ qrcode?: string; payjsOrderId?: string; error?: string }> {
  const { mchid, key, amount, outTradeNo, body, notifyUrl } = params;
  const data: Record<string, string> = {
    mchid,
    total_fee: String(amount),
    out_trade_no: outTradeNo,
    body,
    notify_url: notifyUrl,
  };
  data.sign = sign(data, key);

  const resp = await fetch("https://payjs.cn/api/native", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await resp.json();

  if (result.return_code === 1) {
    return { qrcode: result.qrcode, payjsOrderId: result.payjs_order_id };
  }
  return { error: result.return_msg || "创建支付订单失败" };
}