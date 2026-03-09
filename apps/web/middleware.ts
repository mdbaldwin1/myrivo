import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ACTIVE_STORE_COOKIE = "myrivo_active_store_slug";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/dashboard\/stores\/([^/]+)(?:\/|$)/);

  if (!match) {
    return NextResponse.next();
  }

  const storeSlug = decodeURIComponent(match[1] ?? "").trim().toLowerCase();
  if (!storeSlug) {
    return NextResponse.next();
  }

  if (request.cookies.get(ACTIVE_STORE_COOKIE)?.value === storeSlug) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set(ACTIVE_STORE_COOKIE, storeSlug, {
    path: "/",
    sameSite: "lax",
    httpOnly: false
  });
  return response;
}

export const config = {
  matcher: ["/dashboard/stores/:path*"]
};
