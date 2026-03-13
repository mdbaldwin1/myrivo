import type { MarketingPageKey } from "@/lib/marketing/analytics";

export function resolveMarketingPageKey(pathname: string): MarketingPageKey | null {
  const normalized = pathname.replace(/\/$/, "") || "/";

  if (normalized === "/") {
    return "home";
  }
  if (normalized === "/features") {
    return "features";
  }
  if (normalized === "/pricing") {
    return "pricing";
  }
  if (normalized === "/compare") {
    return "compare";
  }
  if (normalized === "/for") {
    return "solutions";
  }
  if (normalized === "/for/handmade-products") {
    return "solutions_handmade_products";
  }
  if (normalized === "/for/local-pickup-orders") {
    return "solutions_local_pickup_orders";
  }
  if (normalized === "/for/multi-store-commerce") {
    return "solutions_multi_store_commerce";
  }

  return null;
}
