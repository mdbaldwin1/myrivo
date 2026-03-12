import { NextRequest, NextResponse } from "next/server";
import { resolvePostAuthReturnTo } from "@/lib/auth/pending-store-invite";
import { recordLegalAcceptances } from "@/lib/legal/consent";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  let next = resolvePostAuthReturnTo(requestedNext, null);

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    const pendingVersionIds = Array.isArray(user?.user_metadata?.signup_legal_version_ids)
      ? user.user_metadata.signup_legal_version_ids.filter((value): value is string => typeof value === "string")
      : [];

    if (user && pendingVersionIds.length > 0) {
      await recordLegalAcceptances(supabase, {
        userId: user.id,
        versionIds: pendingVersionIds,
        acceptanceSurface: "signup"
      });
    }

    next = resolvePostAuthReturnTo(requestedNext, user?.user_metadata ?? null);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
