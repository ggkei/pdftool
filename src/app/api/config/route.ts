import { NextResponse } from "next/server";
import { getPublicConfig } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = await getPublicConfig();
  return NextResponse.json(cfg);
}
