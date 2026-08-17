import { MEMBERSHIP_TIERS, type MembershipTier } from "./tools";
import { createMembershipTokenInMemory } from "./inMemoryDb";

export const PAYMENT_PRICES: Record<string, number> = {
  day: 100,
  month: 1500,
  half_year: 6800,
  year: 12800,
  three_year: 29800,
  forever: 58800,
};

export interface Order {
  orderId: string;
  tier: string;
  tierName: string;
  amount: number;
  status: "pending" | "paid" | "expired";
  membershipCode?: string;
  createdAt: number;
  paidAt?: number;
  qrcode?: string;
}

declare global {
  var __orders: Map<string, Order> | undefined;
}

if (!globalThis.__orders) {
  globalThis.__orders = new Map();
}

const orders = globalThis.__orders;

export function createOrder(tier: string, qrcode?: string): Order {
  const tierDef = MEMBERSHIP_TIERS.find((t) => t.id === tier);
  const orderId = "ORD-" + Date.now() + Math.random().toString(36).slice(2, 6).toUpperCase();
  const order: Order = {
    orderId,
    tier,
    tierName: tierDef?.name || "日卡",
    amount: PAYMENT_PRICES[tier] ?? 100,
    status: "pending",
    createdAt: Date.now(),
    qrcode,
  };
  orders.set(orderId, order);
  return order;
}

export function getOrder(orderId: string): Order | undefined {
  return orders.get(orderId);
}

export function markOrderPaid(orderId: string): { ok: boolean; membershipCode?: string; reason?: string } {
  const order = orders.get(orderId);
  if (!order) return { ok: false, reason: "订单不存在" };
  if (order.status === "paid") return { ok: false, reason: "订单已支付" };
  if (order.status === "expired") return { ok: false, reason: "订单已过期" };

  const membershipCode = createMembershipTokenInMemory(order.tier as MembershipTier);
  order.status = "paid";
  order.paidAt = Date.now();
  order.membershipCode = membershipCode;
  return { ok: true, membershipCode };
}

export function getPendingOrders(): Order[] {
  const now = Date.now();
  const expired: string[] = [];
  orders.forEach((order, key) => {
    if (order.status === "pending" && now - order.createdAt > 30 * 60 * 1000) {
      order.status = "expired";
      expired.push(key);
    }
  });
  return Array.from(orders.values()).filter((o) => o.status === "pending");
}