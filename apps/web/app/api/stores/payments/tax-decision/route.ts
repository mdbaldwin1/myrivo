import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateTaxDecisionSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("stripe_tax")
  }),
  z.object({
    mode: z.literal("seller_attested_no_tax"),
    acknowledged: z.literal(true),
    note: z.string().trim().max(1000).optional()
  })
]);

export async function PATCH(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, updateTaxDecisionSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, request.nextUrl.searchParams.get("storeSlug"), "admin");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const updates =
    payload.data.mode === "stripe_tax"
      ? {
          tax_collection_mode: "stripe_tax" as const,
          tax_compliance_acknowledged_at: null,
          tax_compliance_acknowledged_by_user_id: null,
          tax_compliance_note: null
        }
      : {
          tax_collection_mode: "seller_attested_no_tax" as const,
          tax_compliance_acknowledged_at: new Date().toISOString(),
          tax_compliance_acknowledged_by_user_id: user.id,
          tax_compliance_note: payload.data.note?.trim() || null
        };

  const { data, error } = await supabase
    .from("stores")
    .update(updates)
    .eq("id", bundle.store.id)
    .select("id,tax_collection_mode,tax_compliance_acknowledged_at,tax_compliance_note")
    .single<{
      id: string;
      tax_collection_mode: "unconfigured" | "stripe_tax" | "seller_attested_no_tax";
      tax_compliance_acknowledged_at: string | null;
      tax_compliance_note: string | null;
    }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "update",
    entity: "store",
    entityId: bundle.store.id,
    metadata: {
      source: "store_payments_tax_decision",
      tax_collection_mode: data.tax_collection_mode,
      tax_compliance_acknowledged_at: data.tax_compliance_acknowledged_at,
      tax_compliance_note: data.tax_compliance_note
    }
  });

  return NextResponse.json({
    taxCollectionMode: data.tax_collection_mode,
    taxComplianceAcknowledgedAt: data.tax_compliance_acknowledged_at,
    taxComplianceNote: data.tax_compliance_note
  });
}
