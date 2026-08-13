import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AssetLifecycleError, replaceAssetVersion } from "@/lib/digital-products/asset-service";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(100),
    sizeBytes: z.number().int().positive(),
  })
  .strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> },
) {
  const originFailure = enforceTrustedOrigin(request);
  if (originFailure) return originFailure;
  const parsed = await parseJsonRequest(request, schema);
  if (!parsed.ok) return parsed.response;
  const { assetId } = await context.params;
  if (!z.string().uuid().safeParse(assetId).success) {
    return NextResponse.json({ error: "Invalid asset." }, { status: 400 });
  }
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle) return NextResponse.json({ error: "Store unavailable." }, { status: 404 });
  try {
    const result = await replaceAssetVersion({
      admin: createSupabaseAdminClient(),
      storeId: bundle.store.id,
      assetId,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AssetLifecycleError) {
      return NextResponse.json({ error: error.publicMessage }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to prepare replacement." }, { status: 500 });
  }
}
