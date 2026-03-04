import { resolveTxt } from "node:dns/promises";
import { NextRequest, NextResponse } from "next/server";
import { requireStorePermission } from "@/lib/auth/authorization";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionVercelProjectDomain } from "@/lib/vercel/domains";

export async function POST(request: NextRequest, { params }: { params: Promise<{ domainId: string }> }) {
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

  const { data: domain, error: domainError } = await supabase
    .from("store_domains")
    .select("id,domain,verification_token")
    .eq("id", domainId)
    .eq("store_id", auth.context.storeId)
    .maybeSingle<{ id: string; domain: string; verification_token: string | null }>();

  if (domainError) {
    return NextResponse.json({ error: domainError.message }, { status: 500 });
  }

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  if (!domain.verification_token) {
    return NextResponse.json({ error: "Domain verification token is missing" }, { status: 400 });
  }

  const txtRecordName = `_myrivo-verification.${domain.domain}`;
  let isVerified = false;

  try {
    const records = await resolveTxt(txtRecordName);
    const values = records.map((entry) => entry.join("")).map((entry) => entry.trim());
    isVerified = values.includes(domain.verification_token);
  } catch {
    isVerified = false;
  }

  let shouldSetPrimary = false;
  if (isVerified) {
    const { data: existingPrimary, error: existingPrimaryError } = await supabase
      .from("store_domains")
      .select("id")
      .eq("store_id", auth.context.storeId)
      .eq("is_primary", true)
      .maybeSingle<{ id: string }>();

    if (existingPrimaryError) {
      return NextResponse.json({ error: existingPrimaryError.message }, { status: 500 });
    }

    shouldSetPrimary = !existingPrimary;
  }

  const updates: {
    verification_status: "pending" | "verified" | "failed";
    last_verification_at: string;
    verified_at: string | null;
    hosting_status?: "pending" | "provisioning" | "ready" | "failed" | "not_configured";
    hosting_last_checked_at?: string;
    hosting_ready_at?: string | null;
    hosting_error?: string | null;
    hosting_metadata_json?: Record<string, unknown>;
    is_primary?: boolean;
  } = {
    verification_status: isVerified ? "verified" : "failed",
    last_verification_at: new Date().toISOString(),
    verified_at: isVerified ? new Date().toISOString() : null
  };

  if (!isVerified) {
    updates.hosting_status = "pending";
    updates.hosting_last_checked_at = new Date().toISOString();
    updates.hosting_ready_at = null;
    updates.hosting_error = "Domain DNS verification did not pass.";
    updates.hosting_metadata_json = {};
  }

  if (isVerified && shouldSetPrimary) {
    updates.is_primary = true;
  }

  if (isVerified) {
    const provisionResult = await provisionVercelProjectDomain(domain.domain);
    updates.hosting_status = provisionResult.status;
    updates.hosting_last_checked_at = new Date().toISOString();
    updates.hosting_ready_at = provisionResult.status === "ready" ? new Date().toISOString() : null;
    updates.hosting_error = provisionResult.error;
    updates.hosting_metadata_json = provisionResult.metadata;
  }

  const { data, error } = await supabase
    .from("store_domains")
    .update(updates)
    .eq("id", domain.id)
    .eq("store_id", auth.context.storeId)
    .select(
      "id,store_id,domain,is_primary,verification_status,verification_token,last_verification_at,verified_at,hosting_provider,hosting_status,hosting_last_checked_at,hosting_ready_at,hosting_error,hosting_metadata_json,created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ domain: data, txtRecordName, verified: isVerified });
}
