import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStorePermission } from "@/lib/auth/authorization";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { removeResendDomain } from "@/lib/resend/domains";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { removeVercelProjectDomain } from "@/lib/vercel/domains";

const updateSchema = z.object({
  isPrimary: z.boolean().optional(),
  emailSenderEnabled: z.boolean().optional()
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ domainId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requireStorePermission("store.manage_domains");
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await parseJsonRequest(request, updateSchema);
  if (!payload.ok) {
    return payload.response;
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

  const updatePayload: Record<string, unknown> = {};
  if (payload.data.isPrimary !== undefined) {
    updatePayload.is_primary = payload.data.isPrimary;
  }
  if (payload.data.emailSenderEnabled !== undefined) {
    updatePayload.email_sender_enabled = payload.data.emailSenderEnabled;
    if (!payload.data.emailSenderEnabled) {
      updatePayload.email_status = "not_configured";
      updatePayload.email_domain_id = null;
      updatePayload.email_ready_at = null;
      updatePayload.email_error = null;
      updatePayload.email_metadata_json = {};
    } else {
      updatePayload.email_status = "pending";
      updatePayload.email_error = null;
    }
  }

  const { data, error } = await supabase
    .from("store_domains")
    .update(updatePayload)
    .eq("id", domainId)
    .eq("store_id", auth.context.storeId)
    .select(
      "id,store_id,domain,is_primary,verification_status,verification_token,last_verification_at,verified_at,hosting_provider,hosting_status,hosting_last_checked_at,hosting_ready_at,hosting_error,hosting_metadata_json,email_provider,email_sender_enabled,email_status,email_domain_id,email_last_checked_at,email_ready_at,email_error,email_metadata_json,created_at"
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

  const auth = await requireStorePermission("store.manage_domains");
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { domainId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: domainRecord, error: domainError } = await supabase
    .from("store_domains")
    .select("id,domain,email_domain_id")
    .eq("id", domainId)
    .eq("store_id", auth.context.storeId)
    .maybeSingle<{ id: string; domain: string; email_domain_id: string | null }>();

  if (domainError) {
    return NextResponse.json({ error: domainError.message }, { status: 500 });
  }

  if (!domainRecord) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  const removal = await removeVercelProjectDomain(domainRecord.domain);
  if (!removal.ok) {
    return NextResponse.json({ error: removal.error ?? "Unable to remove domain from Vercel." }, { status: 502 });
  }

  const resendRemoval = await removeResendDomain(domainRecord.email_domain_id);
  if (!resendRemoval.ok) {
    return NextResponse.json({ error: resendRemoval.error ?? "Unable to remove domain from Resend." }, { status: 502 });
  }

  const { error } = await supabase.from("store_domains").delete().eq("id", domainId).eq("store_id", auth.context.storeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
