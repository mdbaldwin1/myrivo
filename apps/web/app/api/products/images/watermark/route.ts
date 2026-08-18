import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PreviewLifecycleError, watermarkProductImage } from "@/lib/digital-products/preview-service";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z
  .object({
    sourceUrl: z.string().url().max(2048),
  })
  .strict();

/**
 * Watermarks one of a store's own product images. Unlike the buyer preview,
 * this is an ordinary storefront image the merchant chose to protect, so it
 * needs no digital-products entitlement - a physical-goods store is equally
 * entitled to watermark its photographs.
 */
export async function POST(request: NextRequest) {
  const originFailure = enforceTrustedOrigin(request);
  if (originFailure) return originFailure;
  const parsed = await parseJsonRequest(request, schema);
  if (!parsed.ok) return parsed.response;

  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle) return NextResponse.json({ error: "Store unavailable." }, { status: 404 });

  try {
    const result = await watermarkProductImage({
      admin: createSupabaseAdminClient(),
      storeId: bundle.store.id,
      sourceUrl: parsed.data.sourceUrl,
      storeName: bundle.store.name,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PreviewLifecycleError) {
      return NextResponse.json({ error: error.publicMessage }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to watermark this image." }, { status: 500 });
  }
}
