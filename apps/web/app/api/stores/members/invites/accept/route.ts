import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeInviteToken } from "@/lib/auth/invite-token";
import { getPendingStoreInviteTokenFromMetadata } from "@/lib/auth/pending-store-invite";
import { acceptStoreMembershipInvite } from "@/lib/stores/accept-membership-invite";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hashInviteToken } from "@/lib/stores/membership-invites";
import type { StoreMemberRole } from "@/types/database";

const acceptSchema = z.object({
  token: z.string()
});

export async function POST(request: NextRequest) {
  const payload = acceptSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }
  const inviteToken = sanitizeInviteToken(payload.data.token);
  if (!inviteToken) {
    return NextResponse.json({ error: "Invalid invite token." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const tokenHash = hashInviteToken(inviteToken);
  const { data: invite, error: inviteError } = await admin
    .from("store_membership_invites")
    .select("id,store_id,email,role,status,expires_at,store:stores!inner(slug)")
    .eq("token_hash", tokenHash)
    .maybeSingle<{
      id: string;
      store_id: string;
      email: string;
      role: Exclude<StoreMemberRole, "owner">;
      status: "pending" | "accepted" | "revoked" | "expired";
      expires_at: string;
      store: { slug: string } | null;
    }>();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }
  if (!invite || invite.status !== "pending") {
    return NextResponse.json({ error: "Invite is invalid or no longer available." }, { status: 404 });
  }

  const result = await acceptStoreMembershipInvite({
    admin,
    userId: user.id,
    userEmail: user.email,
    invite
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const pendingInviteToken = getPendingStoreInviteTokenFromMetadata(user.user_metadata);
  if (pendingInviteToken === inviteToken) {
    const nextMetadata = { ...(user.user_metadata ?? {}) } as Record<string, unknown>;
    delete nextMetadata.pending_store_invite_token;
    await admin.auth.admin.updateUserById(user.id, { user_metadata: nextMetadata });
  }

  return NextResponse.json({ ok: true, storeId: result.storeId, storeSlug: result.storeSlug, role: result.role });
}
