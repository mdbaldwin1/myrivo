import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStoreRole } from "@/lib/auth/authorization";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(3)
    .max(255)
    .regex(/^[a-z0-9.-]+$/i, "Domain may include letters, numbers, dashes, and dots only.")
});

function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

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
    .select("id,store_id,domain,is_primary,verification_status,verification_token,last_verification_at,verified_at,created_at")
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

  const normalizedDomain = normalizeDomain(payload.data.domain);
  const token = createVerificationToken();

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
      verified_at: null
    })
    .select("id,store_id,domain,is_primary,verification_status,verification_token,last_verification_at,verified_at,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ domain: data }, { status: 201 });
}
