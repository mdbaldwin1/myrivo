import { resolveTxt } from "node:dns/promises";
import { NextRequest, NextResponse } from "next/server";
import { requireStoreRole } from "@/lib/auth/authorization";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ domainId: string }> }) {
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
    is_primary?: boolean;
  } = {
    verification_status: isVerified ? "verified" : "failed",
    last_verification_at: new Date().toISOString(),
    verified_at: isVerified ? new Date().toISOString() : null
  };
  if (isVerified && shouldSetPrimary) {
    updates.is_primary = true;
  }

  const { data, error } = await supabase
    .from("store_domains")
    .update(updates)
    .eq("id", domain.id)
    .eq("store_id", auth.context.storeId)
    .select("id,store_id,domain,is_primary,verification_status,verification_token,last_verification_at,verified_at,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ domain: data, txtRecordName, verified: isVerified });
}
