import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStoreRole } from "@/lib/auth/authorization";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { normalizeDomainInput } from "@/lib/stores/domain-utils";
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

export async function GET() {
  const auth = await requireStoreRole("admin");
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
      "id,store_id,domain,is_primary,verification_status,verification_token,last_verification_at,verified_at,hosting_provider,hosting_status,hosting_last_checked_at,hosting_ready_at,hosting_error,hosting_metadata_json,created_at"
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

  const auth = await requireStoreRole("admin");
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = createSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const normalizedDomain = normalizeDomainInput(payload.data.domain);
  if (!normalizedDomain) {
    return NextResponse.json({ error: "Domain format is invalid." }, { status: 400 });
  }
  const token = createVerificationToken();

  const supabase = await createSupabaseServerClient();
  const { data: storeConfig, error: storeConfigError } = await supabase
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
      hosting_metadata_json: {}
    })
    .select(
      "id,store_id,domain,is_primary,verification_status,verification_token,last_verification_at,verified_at,hosting_provider,hosting_status,hosting_last_checked_at,hosting_ready_at,hosting_error,hosting_metadata_json,created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ domain: data }, { status: 201 });
}
