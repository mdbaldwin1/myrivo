import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStorePermission } from "@/lib/auth/authorization";
import { logAuditEvent } from "@/lib/audit/log";
import { sendStoreMembershipInviteEmail } from "@/lib/notifications/team-invites";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createInviteToken, hashInviteToken, resolveInviteExpiry } from "@/lib/stores/membership-invites";

const resendSchema = z.object({
  sendEmail: z.boolean().optional(),
  expiresInDays: z.number().int().min(1).max(30).optional()
});

type InviteRow = {
  id: string;
  store_id: string;
  email: string;
  role: "admin" | "staff";
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
};

async function loadInvite(admin: ReturnType<typeof createSupabaseAdminClient>, inviteId: string, storeId: string) {
  const { data, error } = await admin
    .from("store_membership_invites")
    .select("id,store_id,email,role,status,expires_at,created_at")
    .eq("id", inviteId)
    .eq("store_id", storeId)
    .maybeSingle<InviteRow>();

  if (error) {
    return { data: null, error };
  }

  return { data: data ?? null, error: null };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ inviteId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requireStorePermission("store.manage_members", request.nextUrl.searchParams.get("storeSlug"));
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = resendSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const { inviteId } = await params;
  const admin = createSupabaseAdminClient();
  const { data: invite, error: inviteError } = await loadInvite(admin, inviteId, auth.context.storeId);
  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }
  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }
  if (invite.status !== "pending") {
    return NextResponse.json({ error: "Only pending invites can be resent or reissued." }, { status: 400 });
  }

  const [{ data: store, error: storeError }, { data: inviterProfile, error: inviterProfileError }] = await Promise.all([
    admin.from("stores").select("id,name").eq("id", auth.context.storeId).single<{ id: string; name: string }>(),
    admin
      .from("user_profiles")
      .select("display_name,email")
      .eq("id", auth.context.userId)
      .maybeSingle<{ display_name: string | null; email: string | null }>()
  ]);

  if (storeError || !store) {
    return NextResponse.json({ error: storeError?.message ?? "Store not found." }, { status: 500 });
  }
  if (inviterProfileError) {
    return NextResponse.json({ error: inviterProfileError.message }, { status: 500 });
  }

  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = resolveInviteExpiry(payload.data.expiresInDays ?? 7);

  const { error: revokeError } = await admin
    .from("store_membership_invites")
    .update({ status: "revoked" })
    .eq("id", invite.id)
    .eq("store_id", auth.context.storeId);

  if (revokeError) {
    return NextResponse.json({ error: revokeError.message }, { status: 500 });
  }

  const { data: replacementInvite, error: replacementError } = await admin
    .from("store_membership_invites")
    .insert({
      store_id: auth.context.storeId,
      email: invite.email,
      role: invite.role,
      status: "pending",
      token_hash: tokenHash,
      invited_by_user_id: auth.context.userId,
      expires_at: expiresAt
    })
    .select("id,email,role,status,expires_at,created_at")
    .single<InviteRow>();

  if (replacementError || !replacementInvite) {
    return NextResponse.json({ error: replacementError?.message ?? "Unable to create replacement invite." }, { status: 500 });
  }

  await logAuditEvent({
    storeId: auth.context.storeId,
    actorUserId: auth.context.userId,
    action: "store_member_invite_resent",
    entity: "store_membership_invite",
    entityId: replacementInvite.id,
    metadata: {
      previousInviteId: invite.id,
      email: replacementInvite.email,
      role: replacementInvite.role,
      emailSent: payload.data.sendEmail !== false,
      expiresAt
    }
  });

  let emailSent = false;
  let emailError: string | null = null;
  if (payload.data.sendEmail !== false) {
    const emailResult = await sendStoreMembershipInviteEmail({
      recipientEmail: replacementInvite.email,
      storeName: store.name,
      inviterName: inviterProfile?.display_name ?? inviterProfile?.email ?? null,
      role: replacementInvite.role,
      inviteToken: token,
      expiresAt
    });
    emailSent = emailResult.ok;
    emailError = emailResult.ok ? null : emailResult.error;
  }

  return NextResponse.json({
    invite: replacementInvite,
    inviteToken: token,
    emailSent,
    emailError
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ inviteId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requireStorePermission("store.manage_members", request.nextUrl.searchParams.get("storeSlug"));
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { inviteId } = await params;
  const admin = createSupabaseAdminClient();
  const { data: invite, error: inviteError } = await loadInvite(admin, inviteId, auth.context.storeId);
  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }
  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }
  if (invite.status !== "pending") {
    return NextResponse.json({ error: "Only pending invites can be revoked." }, { status: 400 });
  }

  const { error: revokeError } = await admin
    .from("store_membership_invites")
    .update({ status: "revoked" })
    .eq("id", invite.id)
    .eq("store_id", auth.context.storeId);

  if (revokeError) {
    return NextResponse.json({ error: revokeError.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: auth.context.storeId,
    actorUserId: auth.context.userId,
    action: "store_member_invite_revoked",
    entity: "store_membership_invite",
    entityId: invite.id,
    metadata: {
      email: invite.email,
      role: invite.role
    }
  });

  return NextResponse.json({ ok: true });
}
