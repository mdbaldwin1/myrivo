import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveStoreAnalyticsAccessByStoreId } from "@/lib/analytics/access";
import { buildCsv, shapeAnalyticsExportRows, type AnalyticsExportDataset } from "@/lib/analytics/export";
import { getStorefrontMerchandisingSummary } from "@/lib/analytics/merchandising";
import { getStorefrontAnalyticsSummary, type StorefrontAnalyticsRange } from "@/lib/analytics/query";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const querySchema = z.object({
  store: z.string().trim().min(2),
  range: z.enum(["7d", "30d", "90d"]).optional(),
  dataset: z.enum(["daily", "top-pages", "top-products", "low-conversion-products", "top-searches"])
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    store: url.searchParams.get("store"),
    range: url.searchParams.get("range") ?? undefined,
    dataset: url.searchParams.get("dataset")
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Valid store, range, and dataset are required." }, { status: 400 });
  }

  const bundle = await getOwnedStoreBundleForSlug(user.id, parsed.data.store);
  if (!bundle) {
    return NextResponse.json({ error: "Store not found." }, { status: 404 });
  }

  const analyticsAccess = await resolveStoreAnalyticsAccessByStoreId(createSupabaseAdminClient(), bundle.store.id);
  if (!analyticsAccess.dashboardEnabled) {
    return NextResponse.json({ error: "Analytics exports are not available for this store." }, { status: 403 });
  }

  const range = (parsed.data.range ?? "30d") as StorefrontAnalyticsRange;
  const dataset = parsed.data.dataset as AnalyticsExportDataset;

  const [analytics, merchandising] = await Promise.all([
    getStorefrontAnalyticsSummary({
      supabase,
      storeId: bundle.store.id,
      range,
      compare: false
    }),
    getStorefrontMerchandisingSummary({
      supabase,
      storeId: bundle.store.id,
      range
    })
  ]);

  const rows = shapeAnalyticsExportRows({
    dataset,
    analytics,
    merchandising
  });

  return new NextResponse(buildCsv(rows), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=\"${bundle.store.slug}-${dataset}-${range}.csv\"`
    }
  });
}
