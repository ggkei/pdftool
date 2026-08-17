"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const TIERS = [
  { id: "day", name: "日卡", price: 1, days: 1, color: "bg-green-100 text-green-700 border-green-300", badge: "日" },
  { id: "month", name: "月卡", price: 15, days: 30, color: "bg-blue-100 text-blue-700 border-blue-300", badge: "月" },
  { id: "half_year", name: "半年卡", price: 68, days: 180, color: "bg-cyan-100 text-cyan-700 border-cyan-300", badge: "半年" },
  { id: "year", name: "年卡", price: 128, days: 365, color: "bg-violet-100 text-violet-700 border-violet-300", badge: "年", hot: true },
  { id: "three_year", name: "3年卡", price: 298, days: 1095, color: "bg-purple-100 text-purple-700 border-purple-300", badge: "3年" },
  { id: "forever", name: "永久会员", price: 588, days: 0, color: "bg-amber-100 text-amber-700 border-amber-300", badge: "永久" },
];

interface Props {
  onClose: () => void;
  onCodeReceived: (code: string) => void;
}

export function PaymentModal({ onClose, onCodeReceived }: Props) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [step, setStep] = useState<"select" | "paying" | "success">("select");
  const [orderInfo, setOrderInfo] = useState<{ orderId: string; qrcode: string | null; mock: boolean; tierName: string; amount: number } | null>(null);
  const [membershipCode, setMembershipCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollStatus = useCallback(async (orderId: string) => {
    try {
      const r = await fetch(`/api/payment/status?orderId=${orderId}`);
      const data = await r.json();
      if (data.ok && data.status === "paid" && data.membershipCode) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setMembershipCode(data.membershipCode);
        setStep("success");
      }
    } catch {}
  }, []);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleCreateOrder = async () => {
    if (!selectedTier) return;
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: selectedTier }),
      });
      const data = await r.json();
      if (data.ok) {
        setOrderInfo({
          orderId: data.orderId,
          qrcode: data.qrcode,
          mock: data.mock,
          tierName: data.tierName,
          amount: data.amount,
        });
        setStep("paying");
        if (!data.mock) {
          pollRef.current = setInterval(() => pollStatus(data.orderId), 2000);
        }
      } else {
        setErr(data.reason || "创建订单失败");
      }
    } catch (e: any) {
      setErr(e?.message || "网络错误");
    } finally {
      setLoading(false);
    }
  };

  const handleMockPay = async () => {
    if (!orderInfo) return;
    setLoading(true);
    try {
      const r = await fetch("/api/payment/test-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderInfo.orderId }),
      });
      const data = await r.json();
      if (data.ok && data.membershipCode) {
        setMembershipCode(data.membershipCode);
        setStep("success");
      } else {
        setErr(data.reason || "模拟支付失败");
      }
    } catch (e: any) {
      setErr(e?.message || "网络错误");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(membershipCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUse = () => {
    onCodeReceived(membershipCode);
    onClose();
  };

  const qrImageUrl = orderInfo?.qrcode
    ? orderInfo.qrcode.startsWith("http")
      ? orderInfo.qrcode
      : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(orderInfo.qrcode)}`
    : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md animate-scale-in overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_-12px_rgba(15,23,42,0.3)]">
        <div className="relative px-6 pt-6 pb-4">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-amber-400" />
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">
                  {step === "select" ? "购买会员" : step === "paying" ? "扫码支付" : "支付成功"}
                </h3>
                <p className="text-xs text-zinc-500">
                  {step === "select" ? "选择会员套餐" : step === "paying" ? "微信/支付宝扫码" : "会员码已生成"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
              aria-label="关闭"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 pb-6">
          {/* Step 1: Select Tier */}
          {step === "select" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedTier(tier.id)}
                    className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                      selectedTier === tier.id
                        ? "border-amber-400 bg-amber-50 shadow-sm"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    {tier.hot && (
                      <span className="absolute -top-2 -right-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">热门</span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${tier.color}`}>{tier.badge}</span>
                      <span className="text-sm font-semibold text-zinc-900">{tier.name}</span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-0.5">
                      <span className="text-xs text-zinc-500">¥</span>
                      <span className="text-xl font-bold text-zinc-900">{tier.price}</span>
                    </div>
                    {tier.days > 0 && (
                      <div className="mt-0.5 text-[10px] text-zinc-400">{tier.days} 天</div>
                    )}
                  </button>
                ))}
              </div>

              {err && (
                <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
              )}

              <button
                onClick={handleCreateOrder}
                disabled={!selectedTier || loading}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "创建订单中..." : selectedTier ? `立即支付 ¥${TIERS.find(t => t.id === selectedTier)?.price}` : "请选择套餐"}
              </button>
              <p className="mt-3 text-center text-[11px] text-zinc-400">会员权益跟随账号，购买后最多 3 台设备同时登录</p>
            </>
          )}

          {/* Step 2: Paying */}
          {step === "paying" && orderInfo && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="text-sm text-zinc-700">
                {orderInfo.tierName} · <span className="font-bold text-amber-600">¥{(orderInfo.amount / 100).toFixed(2)}</span>
              </div>

              {qrImageUrl ? (
                <div className="rounded-xl border-2 border-zinc-200 bg-white p-3">
                  <img src={qrImageUrl} alt="支付二维码" className="h-48 w-48" />
                </div>
              ) : (
                <div className="flex h-48 w-48 flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-300 bg-amber-50">
                  <svg className="h-12 w-12 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 14h3M14 18h3M18 18v3" />
                  </svg>
                  <span className="mt-2 text-xs text-amber-600 font-medium">测试模式</span>
                </div>
              )}

              <p className="text-xs text-zinc-500 text-center">
                {orderInfo.mock
                  ? "本地测试模式 · 点击下方按钮模拟支付成功"
                  : "请用微信或支付宝扫码支付"}
              </p>

              {orderInfo.mock && (
                <button
                  onClick={handleMockPay}
                  disabled={loading}
                  className="w-full rounded-xl bg-green-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                >
                  {loading ? "处理中..." : "模拟支付成功"}
                </button>
              )}

              {err && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
              )}

              <button
                onClick={() => { setStep("select"); setOrderInfo(null); if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }}
                className="text-xs text-zinc-400 hover:text-zinc-600"
              >
                ← 返回选择套餐
              </button>
            </div>
          )}

          {/* Step 3: Success */}
          {step === "success" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-center">
                <div className="text-base font-semibold text-zinc-900">支付成功</div>
                <div className="mt-1 text-xs text-zinc-500">请复制下方会员码，在激活框中输入</div>
              </div>
              <div className="w-full rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-center">
                <div className="text-xs text-zinc-500 mb-1">您的会员码</div>
                <div className="font-mono text-lg font-bold tracking-wider text-amber-700 select-all">{membershipCode}</div>
              </div>
              <div className="flex w-full gap-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  {copied ? "已复制 ✓" : "复制会员码"}
                </button>
                <button
                  onClick={handleUse}
                  className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
                >
                  立即使用
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}