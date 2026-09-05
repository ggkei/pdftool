﻿﻿﻿import { NextResponse } from "next/server";
import { getCurrentUser, logout } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let user;
  try { user = await getCurrentUser(); } catch { return NextResponse.json({ user: null }); }
  if (!user) return NextResponse.json({ user: null });
  const { membership_tier, membership_expires_at, created_at, last_login_at, ...rest } = user as any;
  return NextResponse.json({
    user: {
      ...rest,
      membershipTier: user.membership_tier,
      membershipExpiresAt: user.membership_expires_at,
      isMember: user.isMember,
      remainingDays: user.remainingDays,
      tierInfo: user.tierInfo,
      createdAt: user.created_at,
      hasPassword: !!(user as any).password,
      lastLoginAt: user.last_login_at,
    },
  });
}

export async function POST() {
  await logout();
  return NextResponse.json({ ok: true });
}
