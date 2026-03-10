import { NextRequest, NextResponse } from "next/server";
import { requireStoreRole } from "@/lib/auth/authorization";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ blackoutId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requireStoreRole("staff", request.nextUrl.searchParams.get("storeSlug"));
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { blackoutId } = await params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("pickup_blackout_dates")
    .delete()
    .eq("id", blackoutId)
    .eq("store_id", auth.context.storeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
