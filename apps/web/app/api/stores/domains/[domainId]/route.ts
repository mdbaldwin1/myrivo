import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStoreRole } from "@/lib/auth/authorization";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  isPrimary: z.boolean().optional()
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ domainId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requireStoreRole("admin");
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = updateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const { domainId } = await params;
  const supabase = await createSupabaseServerClient();

  if (payload.data.isPrimary) {
    const { data: targetDomain, error: targetDomainError } = await supabase
      .from("store_domains")
      .select("id,verification_status")
      .eq("id", domainId)
      .eq("store_id", auth.context.storeId)
      .maybeSingle<{ id: string; verification_status: "pending" | "verified" | "failed" }>();

    if (targetDomainError) {
      return NextResponse.json({ error: targetDomainError.message }, { status: 500 });
    }

    if (!targetDomain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    if (targetDomain.verification_status !== "verified") {
      return NextResponse.json({ error: "Only verified domains can be set as primary." }, { status: 400 });
    }

    const { error: clearPrimaryError } = await supabase.from("store_domains").update({ is_primary: false }).eq("store_id", auth.context.storeId);
    if (clearPrimaryError) {
      return NextResponse.json({ error: clearPrimaryError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("store_domains")
    .update({
      is_primary: payload.data.isPrimary ?? false
    })
    .eq("id", domainId)
    .eq("store_id", auth.context.storeId)
    .select(
      "id,store_id,domain,is_primary,verification_status,verification_token,last_verification_at,verified_at,hosting_provider,hosting_status,hosting_last_checked_at,hosting_ready_at,hosting_error,hosting_metadata_json,created_at"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  return NextResponse.json({ domain: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ domainId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requireStoreRole("admin");
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { domainId } = await params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("store_domains").delete().eq("id", domainId).eq("store_id", auth.context.storeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
