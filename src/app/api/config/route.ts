import { NextResponse } from "next/server";
import { getPublicConfig } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cfg = await getPublicConfig();
    return NextResponse.json(cfg);
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e.message,
      stack: process.env.NODE_ENV === "development" ? e.stack : undefined,
    }, { status: 500 });
  }
}
