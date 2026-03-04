import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { ACTIVE_STORE_COOKIE } from "@/lib/stores/tenant-context";

const updateActiveStoreSchema = z.object({
  slug: z.string().min(3).max(63)
});

function isSecureCookieRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.toLowerCase();
  if (forwardedProto === "https") {
    return true;
  }
  const requestProtocol = request.nextUrl.protocol.toLowerCase();
  return requestProtocol === "https:";
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle) {
    return NextResponse.json({ activeStore: null, availableStores: [] });
  }

  return NextResponse.json({
    activeStore: bundle.store,
    availableStores: bundle.availableStores,
    activeRole: bundle.role
  });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = updateActiveStoreSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const slug = payload.data.slug.trim().toLowerCase();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");
  if (!bundle) {
    return NextResponse.json({ error: "No store memberships found" }, { status: 404 });
  }

  const selected = bundle.availableStores.find((store) => store.slug === slug);
  if (!selected) {
    return NextResponse.json({ error: "Store not accessible for this account" }, { status: 403 });
  }

  const response = NextResponse.json({
    activeStore: selected,
    availableStores: bundle.availableStores,
    activeRole: selected.role
  });

  response.cookies.set(ACTIVE_STORE_COOKIE, selected.slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookieRequest(request),
    path: "/",
    maxAge: 60 * 60 * 24 * 180
  });

  return response;
}
