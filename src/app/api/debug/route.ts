import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const hasDbUrl = !!dbUrl;
  const dbUrlMasked = dbUrl ? dbUrl.replace(/:[^:@]+@/, ":****@") : "NOT SET";
  
  let dbTest: any = { hasDbUrl, dbUrlMasked };
  
  if (hasDbUrl) {
    try {
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString: dbUrl,
        max: 1,
        connectionTimeoutMillis: 10000,
        ssl: { rejectUnauthorized: false },
      });
      const client = await pool.connect();
      const res = await client.query("SELECT NOW() as now");
      dbTest.connected = true;
      dbTest.serverTime = res.rows[0].now;
      client.release();
      await pool.end();
    } catch (e: any) {
      dbTest.connected = false;
      dbTest.error = e.message;
    }
  }
  
  return NextResponse.json({
    ok: true,
    env: process.env.NODE_ENV,
    db: dbTest,
    smtp1: {
      hasHost: !!process.env.SMTP1_HOST,
      hasPass: !!process.env.SMTP1_PASS,
    },
  });
}
