import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ACTIVE_STORE_COOKIE = "myrivo_active_store_slug";
const STOREFRONT_STORE_COOKIE = "myrivo_storefront_slug";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const dashboardMatch = pathname.match(/^\/dashboard\/stores\/([^/]+)(?:\/|$)/);
  const pathStorefrontMatch = pathname.match(/^\/s\/([^/]+)(?:\/|$)/);
  const storeQuerySlug = searchParams.get("store")?.trim().toLowerCase() ?? null;

  const dashboardStoreSlug = decodeURIComponent(dashboardMatch?.[1] ?? "").trim().toLowerCase();
  const storefrontStoreSlug = storeQuerySlug;

  const response = NextResponse.next();
  let wroteCookie = false;

  if (dashboardStoreSlug && request.cookies.get(ACTIVE_STORE_COOKIE)?.value !== dashboardStoreSlug) {
    response.cookies.set(ACTIVE_STORE_COOKIE, dashboardStoreSlug, {
      path: "/",
      sameSite: "lax",
      httpOnly: false
    });
    wroteCookie = true;
  }

  if (storefrontStoreSlug && request.cookies.get(STOREFRONT_STORE_COOKIE)?.value !== storefrontStoreSlug) {
    response.cookies.set(STOREFRONT_STORE_COOKIE, storefrontStoreSlug, {
      path: "/",
      sameSite: "lax",
      httpOnly: false
    });
    wroteCookie = true;
  }

  if (!wroteCookie) {
    return NextResponse.next();
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/stores/:path*", "/", "/about", "/products/:path*", "/cart", "/checkout", "/privacy/:path*", "/terms", "/cookies", "/policies", "/s/:path*"]
};
