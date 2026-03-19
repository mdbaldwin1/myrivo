import { NextRequest, NextResponse } from "next/server";
import { resolvePostAuthReturnTo } from "@/lib/auth/pending-store-invite";
import { recordPendingSignupLegalAcceptances } from "@/lib/legal/consent";
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

    if (user) {
      await recordPendingSignupLegalAcceptances(supabase, {
        userId: user.id,
        userMetadata: user.user_metadata
      });
    }

    next = resolvePostAuthReturnTo(requestedNext, user?.user_metadata ?? null);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
