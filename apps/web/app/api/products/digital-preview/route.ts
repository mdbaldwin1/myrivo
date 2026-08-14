import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  PreviewLifecycleError,
  processPreview,
  setPreviewOverride,
} from "@/lib/digital-products/preview-service";
import { resolveStoreDigitalProductsAccess } from "@/lib/digital-products/feature-gating";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("asset"),
      productId: z.string().uuid(),
      sourceAssetVersionId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("override"),
      productId: z.string().uuid(),
      sourceUrl: z.string().url().max(2048),
    })
    .strict(),
]);

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
  const admin = createSupabaseAdminClient();
  const access = await resolveStoreDigitalProductsAccess(admin, bundle.store.id).catch(() => ({ enabled: false }));
  if (!access.enabled) return NextResponse.json({ error: "Digital products are not enabled for this store." }, { status: 403 });
  try {
    const result =
      parsed.data.mode === "asset"
        ? await processPreview({
            admin,
            storeId: bundle.store.id,
            productId: parsed.data.productId,
            sourceAssetVersionId: parsed.data.sourceAssetVersionId,
            storeName: bundle.store.name,
          })
        : await setPreviewOverride({
            admin,
            storeId: bundle.store.id,
            productId: parsed.data.productId,
            sourceUrl: parsed.data.sourceUrl,
            storeName: bundle.store.name,
          });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PreviewLifecycleError) {
      return NextResponse.json({ error: error.publicMessage }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to update preview." }, { status: 500 });
  }
}
