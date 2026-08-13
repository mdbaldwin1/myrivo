import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AssetLifecycleError } from "@/lib/digital-products/asset-service";
import { completeOwnedAssetUpload } from "@/lib/digital-products/asset-route-service";
import { PreviewLifecycleError } from "@/lib/digital-products/preview-service";
import { resolveStoreDigitalProductsAccess } from "@/lib/digital-products/feature-gating";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({ intentId: z.string().uuid() }).strict();

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
  const access = await resolveStoreDigitalProductsAccess(createSupabaseAdminClient(), bundle.store.id)
    .catch(() => ({ enabled: false }));
  if (!access.enabled) return NextResponse.json({ error: "Digital products are not enabled for this store." }, { status: 403 });

  try {
    const result = await completeOwnedAssetUpload({
      storeId: bundle.store.id,
      storeName: bundle.store.name,
      intentId: parsed.data.intentId,
    });
    return NextResponse.json(result, { status: result.alreadyCompleted ? 200 : 201 });
  } catch (error) {
    if (error instanceof AssetLifecycleError || error instanceof PreviewLifecycleError) {
      return NextResponse.json({ error: error.publicMessage }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to complete upload." }, { status: 500 });
  }
}
