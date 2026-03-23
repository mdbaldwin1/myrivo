import { NextRequest, NextResponse } from "next/server";
import { resolvePostAuthReturnTo } from "@/lib/auth/pending-store-invite";
import { recordPendingSignupLegalAcceptances } from "@/lib/legal/consent";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function looksLikeSignupCallback(userMetadata: unknown) {
  if (!userMetadata || typeof userMetadata !== "object") {
    return false;
  }

  const signupLegalVersionIds = Reflect.get(userMetadata, "signup_legal_version_ids");
  if (Array.isArray(signupLegalVersionIds) && signupLegalVersionIds.length > 0) {
    return true;
  }

  const pendingStoreInviteToken = Reflect.get(userMetadata, "pending_store_invite_token");
  return typeof pendingStoreInviteToken === "string" && pendingStoreInviteToken.trim().length > 0;
}

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

    next = requestedNext
      ? resolvePostAuthReturnTo(requestedNext, user?.user_metadata ?? null)
      : looksLikeSignupCallback(user?.user_metadata ?? null)
        ? resolvePostAuthReturnTo("/dashboard", user?.user_metadata ?? null)
        : "/reset-password";
  }

  return NextResponse.redirect(new URL(next, request.url));
}
