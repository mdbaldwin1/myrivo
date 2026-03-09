import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toStoreSlug, withStoreSlugSuffix } from "@/lib/stores/slug";
import { ACTIVE_STORE_COOKIE } from "@/lib/stores/tenant-context";

const bootstrapStoreSchema = z.object({
  storeName: z.string().min(2).max(80)
});

function isSecureCookieRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.toLowerCase();
  if (forwardedProto === "https") {
    return true;
  }
  return request.nextUrl.protocol.toLowerCase() === "https:";
}

function looksLikeSlugConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeCode = "code" in error ? String(error.code ?? "") : "";
  const maybeMessage = "message" in error ? String(error.message ?? "").toLowerCase() : "";
  return maybeCode === "23505" || maybeMessage.includes("slug");
}

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, bootstrapStoreSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const storeName = payload.data.storeName.trim();
  const baseSlug = toStoreSlug(storeName) || "store";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let createdStore: { id: string; name: string; slug: string; status: "draft" | "pending_review" | "active" | "suspended" } | null = null;
  let suffix = 1;
  while (!createdStore && suffix < 100) {
    const nextSlug = withStoreSlugSuffix(baseSlug, suffix);
    const { data, error } = await supabase
      .from("stores")
      .insert({
        owner_user_id: user.id,
        name: storeName,
        slug: nextSlug,
        status: "draft"
      })
      .select("id,name,slug,status")
      .single<{ id: string; name: string; slug: string; status: "draft" | "pending_review" | "active" | "suspended" }>();

    if (!error && data) {
      createdStore = data;
      break;
    }

    if (looksLikeSlugConflict(error)) {
      suffix += 1;
      continue;
    }

    return NextResponse.json({ error: error?.message ?? "Unable to create store." }, { status: 500 });
  }

  if (!createdStore) {
    return NextResponse.json({ error: "Unable to reserve a store URL. Try another name." }, { status: 409 });
  }

  const [{ error: membershipError }, { error: brandingError }, { error: settingsError }] = await Promise.all([
    supabase.from("store_memberships").upsert(
      {
        store_id: createdStore.id,
        user_id: user.id,
        role: "owner",
        status: "active"
      },
      { onConflict: "store_id,user_id" }
    ),
    supabase.from("store_branding").upsert({ store_id: createdStore.id }, { onConflict: "store_id" }),
    supabase
      .from("store_settings")
      .upsert(
        {
          store_id: createdStore.id,
          support_email: user.email ?? null
        },
        { onConflict: "store_id" }
      )
  ]);

  if (membershipError || brandingError || settingsError) {
    await supabase.from("stores").delete().eq("id", createdStore.id).eq("owner_user_id", user.id);
    return NextResponse.json(
      {
        error:
          membershipError?.message ??
          brandingError?.message ??
          settingsError?.message ??
          "Store was created, but setup failed. Please contact support."
      },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ store: createdStore }, { status: 201 });
  response.cookies.set(ACTIVE_STORE_COOKIE, createdStore.slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookieRequest(request),
    path: "/",
    maxAge: 60 * 60 * 24 * 180
  });

  return response;
}
