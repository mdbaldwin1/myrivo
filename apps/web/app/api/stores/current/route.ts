import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import { ACTIVE_STORE_COOKIE } from "@/lib/stores/tenant-context";

const updateStoreSchema = z.object({
  name: z.string().min(2).max(120).optional()
});

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, request.nextUrl.searchParams.get("storeSlug"), "staff");

  if (!bundle) {
    return NextResponse.json({ store: null });
  }

  return NextResponse.json(bundle);
}

export async function PATCH(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, updateStoreSchema);
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

  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, request.nextUrl.searchParams.get("storeSlug"), "staff");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  const updates: Record<string, string> = {};

  if (payload.data.name !== undefined) {
    updates.name = payload.data.name;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("stores")
    .update(updates)
    .eq("id", bundle.store.id)
    .select("id,name,slug,status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "update",
    entity: "store",
    entityId: bundle.store.id,
    metadata: updates
  });

  return NextResponse.json({ store: data });
}

export async function DELETE(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
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

  const { count: ordersCount, error: ordersError } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", bundle.store.id);

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  if ((ordersCount ?? 0) > 0) {
    return NextResponse.json({ error: "Stores with orders cannot be permanently deleted." }, { status: 409 });
  }

  const { error } = await supabase.from("stores").delete().eq("id", bundle.store.id).eq("owner_user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "delete",
    entity: "store",
    entityId: bundle.store.id,
    metadata: {
      slug: bundle.store.slug,
      name: bundle.store.name,
      source: "store_settings_delete"
    }
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACTIVE_STORE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol.toLowerCase() === "https:",
    path: "/",
    maxAge: 0
  });
  return response;
}
