import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnInSchemaCache } from "@/lib/supabase/error-classifiers";
import { resolveStoreSlugFromDomain } from "@/lib/stores/domain-store";
import { isStorePubliclyAccessibleStatus } from "@/lib/stores/lifecycle";

function resolveOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto")?.toLowerCase() === "http" ? "http" : "https";
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const storeSlug = await resolveStoreSlugFromDomain(host);

  if (storeSlug) {
    const admin = createSupabaseAdminClient();
    const { data: store } = await admin
      .from("stores")
      .select("id,status,white_label_enabled")
      .eq("slug", storeSlug)
      .maybeSingle<{ id: string; status: "draft" | "pending_review" | "changes_requested" | "rejected" | "suspended" | "live" | "offline" | "removed"; white_label_enabled: boolean }>();

    if (store && isStorePubliclyAccessibleStatus(store.status) && store.white_label_enabled) {
      const { data: settings, error: settingsError } = await admin
        .from("store_settings")
        .select("seo_noindex")
        .eq("store_id", store.id)
        .maybeSingle<{ seo_noindex: boolean }>();
      if (!isMissingColumnInSchemaCache(settingsError, "seo_noindex") && settings?.seo_noindex) {
        const body = `User-agent: *\nDisallow: /\n`;
        return new NextResponse(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        });
      }
      const body = `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }
  }

  const body = `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
