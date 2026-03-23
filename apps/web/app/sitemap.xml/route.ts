import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnInSchemaCache } from "@/lib/supabase/error-classifiers";
import { resolveStoreSlugFromDomain } from "@/lib/stores/domain-store";
import { isStorePubliclyAccessibleStatus } from "@/lib/stores/lifecycle";

type SitemapUrlEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: number;
};

function resolveOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto")?.toLowerCase() === "http" ? "http" : "https";
  return `${proto}://${host}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSitemapXml(entries: SitemapUrlEntry[]) {
  const urls = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
      const changefreq = entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : "";
      const priority = typeof entry.priority === "number" ? `<priority>${entry.priority.toFixed(1)}</priority>` : "";
      return `<url><loc>${escapeXml(entry.loc)}</loc>${lastmod}${changefreq}${priority}</url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>` + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const customDomainStoreSlug = await resolveStoreSlugFromDomain(host);
  const admin = createSupabaseAdminClient();

  if (customDomainStoreSlug) {
    const { data: store } = await admin
      .from("stores")
      .select("id,status,white_label_enabled,updated_at")
      .eq("slug", customDomainStoreSlug)
      .maybeSingle<{ id: string; status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed"; white_label_enabled: boolean; updated_at: string }>();

    if (!store || !isStorePubliclyAccessibleStatus(store.status) || !store.white_label_enabled) {
      return new NextResponse(buildSitemapXml([]), {
        headers: { "Content-Type": "application/xml; charset=utf-8" }
      });
    }

    let { data: products, error: productsError } = await admin
      .from("products")
      .select("id,slug,updated_at")
      .eq("store_id", store.id)
      .eq("status", "active")
      .returns<Array<{ id: string; slug: string; updated_at: string }>>();

    if (isMissingColumnInSchemaCache(productsError, "slug")) {
      const legacy = await admin
        .from("products")
        .select("id,updated_at")
        .eq("store_id", store.id)
        .eq("status", "active")
        .returns<Array<{ id: string; updated_at: string }>>();
      products = (legacy.data ?? []).map((product) => ({ ...product, slug: product.id }));
      productsError = legacy.error;
    }

    if (productsError) {
      return new NextResponse(buildSitemapXml([]), {
        headers: { "Content-Type": "application/xml; charset=utf-8" }
      });
    }

    const entries: SitemapUrlEntry[] = [
      { loc: `${origin}/`, lastmod: store.updated_at, changefreq: "daily", priority: 1.0 },
      { loc: `${origin}/products`, lastmod: store.updated_at, changefreq: "daily", priority: 0.9 },
      { loc: `${origin}/about`, lastmod: store.updated_at, changefreq: "weekly", priority: 0.6 },
      { loc: `${origin}/policies`, lastmod: store.updated_at, changefreq: "monthly", priority: 0.5 },
      ...((products ?? []).map((product) => ({
        loc: `${origin}/products/${product.slug || product.id}`,
        lastmod: product.updated_at,
        changefreq: "weekly" as const,
        priority: 0.8
      })) satisfies SitemapUrlEntry[])
    ];

    return new NextResponse(buildSitemapXml(entries), {
      headers: { "Content-Type": "application/xml; charset=utf-8" }
    });
  }

  const platformEntries: SitemapUrlEntry[] = [
    { loc: `${origin}/`, changefreq: "weekly", priority: 1.0 },
    { loc: `${origin}/features`, changefreq: "weekly", priority: 0.8 },
    { loc: `${origin}/compare`, changefreq: "weekly", priority: 0.7 },
    { loc: `${origin}/for`, changefreq: "weekly", priority: 0.7 },
    { loc: `${origin}/for/handmade-products`, changefreq: "weekly", priority: 0.7 },
    { loc: `${origin}/for/local-pickup-orders`, changefreq: "weekly", priority: 0.7 },
    { loc: `${origin}/for/multi-store-commerce`, changefreq: "weekly", priority: 0.7 },
    { loc: `${origin}/pricing`, changefreq: "weekly", priority: 0.8 },
    { loc: `${origin}/terms`, changefreq: "monthly", priority: 0.4 },
    { loc: `${origin}/privacy`, changefreq: "monthly", priority: 0.4 },
    { loc: `${origin}/docs`, changefreq: "weekly", priority: 0.7 }
  ];

  return new NextResponse(buildSitemapXml(platformEntries), {
    headers: { "Content-Type": "application/xml; charset=utf-8" }
  });
}
