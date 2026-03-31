import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStorePermission } from "@/lib/auth/authorization";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { normalizeDomainInput } from "@/lib/stores/domain-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(3)
    .max(255)
    .regex(/^[a-z0-9.-]+$/i, "Domain may include letters, numbers, dashes, and dots only.")
});

function createVerificationToken() {
  return `myrivo-${randomBytes(12).toString("hex")}`;
}

export async function GET(request: NextRequest) {
  const auth = await requireStorePermission("store.manage_domains", request.nextUrl.searchParams.get("storeSlug"));
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("store_domains")
    .select(
      "id,store_id,domain,is_primary,verification_status,verification_token,last_verification_at,verified_at,hosting_provider,hosting_status,hosting_last_checked_at,hosting_ready_at,hosting_error,hosting_metadata_json,email_provider,email_sender_enabled,email_status,email_domain_id,email_last_checked_at,email_ready_at,email_error,email_metadata_json,created_at"
    )
    .eq("store_id", auth.context.storeId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ domains: data ?? [] });
}

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requireStorePermission("store.manage_domains", request.nextUrl.searchParams.get("storeSlug"));
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await parseJsonRequest(request, createSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const normalizedDomain = normalizeDomainInput(payload.data.domain);
  if (!normalizedDomain) {
    return NextResponse.json({ error: "Domain format is invalid." }, { status: 400 });
  }
  const token = createVerificationToken();

  const admin = createSupabaseAdminClient();
  const { data: storeConfig, error: storeConfigError } = await admin
    .from("stores")
    .select("white_label_enabled")
    .eq("id", auth.context.storeId)
    .maybeSingle<{ white_label_enabled: boolean }>();

  if (storeConfigError) {
    return NextResponse.json({ error: storeConfigError.message }, { status: 500 });
  }

  if (!storeConfig?.white_label_enabled) {
    return NextResponse.json({ error: "Enable white-label before adding custom domains." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("store_domains")
    .insert({
      store_id: auth.context.storeId,
      domain: normalizedDomain,
      is_primary: false,
      verification_status: "pending",
      verification_token: token,
      last_verification_at: null,
      verified_at: null,
      hosting_provider: "vercel",
      hosting_status: "pending",
      hosting_last_checked_at: null,
      hosting_ready_at: null,
      hosting_error: null,
      hosting_metadata_json: {},
      email_provider: "resend",
      email_sender_enabled: false,
      email_status: "pending",
      email_domain_id: null,
      email_last_checked_at: null,
      email_ready_at: null,
      email_error: null,
      email_metadata_json: {}
    })
    .select(
      "id,store_id,domain,is_primary,verification_status,verification_token,last_verification_at,verified_at,hosting_provider,hosting_status,hosting_last_checked_at,hosting_ready_at,hosting_error,hosting_metadata_json,email_provider,email_sender_enabled,email_status,email_domain_id,email_last_checked_at,email_ready_at,email_error,email_metadata_json,created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ domain: data }, { status: 201 });
}
