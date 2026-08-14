import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CACHE_TTL = 60 * 60 * 1000;

interface CacheEntry {
  rates: Record<string, number>;
  base: string;
  date: string;
  fetchedAt: number;
}

let memoryCache: CacheEntry | null = null;

const FALLBACK_RATES: Record<string, number> = {
  CNY: 1,
  USD: 1 / 7.25,
  EUR: 1 / 7.85,
  JPY: 1 / 0.0475,
  GBP: 1 / 9.2,
  HKD: 1 / 0.93,
  AUD: 1 / 4.78,
  CAD: 1 / 5.35,
  KRW: 1 / 0.0053,
  SGD: 1 / 5.38,
};

async function fetchRatesFromAPI(base: string): Promise<CacheEntry | null> {
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${base}`,
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.rates) return null;
    const rates: Record<string, number> = { [data.base || base]: 1, ...data.rates };
    return {
      rates,
      base: data.base || base,
      date: data.date || new Date().toISOString().slice(0, 10),
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const base = searchParams.get("base") || "CNY";

  if (memoryCache && memoryCache.base === base && Date.now() - memoryCache.fetchedAt < CACHE_TTL) {
    return NextResponse.json({ ...memoryCache, cached: true });
  }

  const fresh = await fetchRatesFromAPI(base);
  if (fresh) {
    memoryCache = fresh;
    return NextResponse.json({ ...fresh, cached: false });
  }

  if (memoryCache) {
    return NextResponse.json({ ...memoryCache, cached: true, stale: true });
  }

  const fallbackEntry: CacheEntry = {
    rates: FALLBACK_RATES,
    base: "CNY",
    date: new Date().toISOString().slice(0, 10),
    fetchedAt: Date.now(),
  };
  return NextResponse.json({ ...fallbackEntry, cached: false, fallback: true });
}
