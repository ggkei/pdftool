import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { hostname, pathname } = request.nextUrl;

  // Only process atoolx.com (English site)
  if (!hostname.includes("atoolx.com")) {
    return NextResponse.next();
  }

  // Skip API routes and static assets
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // If user has manually selected a language before, respect their preference
  const userLang = request.cookies.get("user_lang")?.value;
  if (userLang) {
    return NextResponse.next();
  }

  // Detect country from IP (Vercel Edge geo or CDN headers)
  const country =
    request.geo?.country ||
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("x-country-code") ||
    "";

  // Mainland China IP -> auto redirect to Chinese site
  if (country === "CN") {
    const targetUrl = new URL(
      `https://atoolx.cn${pathname}${request.nextUrl.search}`,
      request.url
    );
    const response = NextResponse.redirect(targetUrl);

    // Set language preference cookie so auto-redirect only happens once
    response.cookies.set("user_lang", "zh", {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
      sameSite: "lax",
    });

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
