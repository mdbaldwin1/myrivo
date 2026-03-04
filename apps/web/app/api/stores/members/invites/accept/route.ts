import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hashInviteToken, normalizeInviteEmail } from "@/lib/stores/membership-invites";
import type { StoreMemberRole } from "@/types/database";

const acceptSchema = z.object({
  token: z.string().min(20).max(256)
});

export async function POST(request: NextRequest) {
  const payload = acceptSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const tokenHash = hashInviteToken(payload.data.token);
  const nowIso = new Date().toISOString();
  const { data: invite, error: inviteError } = await admin
    .from("store_membership_invites")
    .select("id,store_id,email,role,status,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle<{
      id: string;
      store_id: string;
      email: string;
      role: Exclude<StoreMemberRole, "owner">;
      status: "pending" | "accepted" | "revoked" | "expired";
      expires_at: string;
    }>();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }
  if (!invite || invite.status !== "pending") {
    return NextResponse.json({ error: "Invite is invalid or no longer available." }, { status: 404 });
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await admin.from("store_membership_invites").update({ status: "expired" }).eq("id", invite.id);
    return NextResponse.json({ error: "Invite has expired." }, { status: 400 });
  }

  if (normalizeInviteEmail(user.email) !== normalizeInviteEmail(invite.email)) {
    return NextResponse.json({ error: "Invite email does not match signed-in account." }, { status: 403 });
  }

  const { error: membershipError } = await admin.from("store_memberships").upsert(
    {
      store_id: invite.store_id,
      user_id: user.id,
      role: invite.role,
      status: "active"
    },
    { onConflict: "store_id,user_id" }
  );

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  const { error: inviteUpdateError } = await admin
    .from("store_membership_invites")
    .update({
      status: "accepted",
      accepted_by_user_id: user.id,
      accepted_at: nowIso
    })
    .eq("id", invite.id);

  if (inviteUpdateError) {
    return NextResponse.json({ error: inviteUpdateError.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: invite.store_id,
    actorUserId: user.id,
    action: "store_member_invite_accepted",
    entity: "store_membership_invite",
    entityId: invite.id,
    metadata: {
      email: invite.email,
      role: invite.role
    }
  });

  return NextResponse.json({ ok: true, storeId: invite.store_id, role: invite.role });
}

