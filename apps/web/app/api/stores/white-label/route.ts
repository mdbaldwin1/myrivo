import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStorePermission } from "@/lib/auth/authorization";
import { readJsonBody } from "@/lib/http/read-json-body";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  enabled: z.boolean()
});

export async function GET(request: NextRequest) {
  const auth = await requireStorePermission("store.manage_domains", request.nextUrl.searchParams.get("storeSlug"));
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("stores")
    .select("white_label_enabled")
    .eq("id", auth.context.storeId)
    .maybeSingle<{ white_label_enabled: boolean }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ enabled: Boolean(data?.white_label_enabled) });
}

export async function PUT(request: NextRequest) {
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

  const rawBody = await readJsonBody(request);
  if (!rawBody.ok) {
    return rawBody.response;
  }

  const payload = updateSchema.safeParse(rawBody.data);
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("stores")
    .update({ white_label_enabled: payload.data.enabled })
    .eq("id", auth.context.storeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ enabled: payload.data.enabled });
}
