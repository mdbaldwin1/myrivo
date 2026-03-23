import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { logAuditEvent } from "@/lib/audit/log";
import { sendPlatformTeamInviteEmail } from "@/lib/notifications/platform-team-invites";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createInviteToken, hashInviteToken, resolveInviteExpiry } from "@/lib/stores/membership-invites";
import type { PlatformTeamInviteRecord } from "@/types/database";

const resendSchema = z.object({
  sendEmail: z.boolean().default(true),
  expiresInDays: z.number().int().min(1).max(30).optional()
});

type InviteResponse = {
  invite?: Pick<PlatformTeamInviteRecord, "id" | "email" | "role" | "status" | "expires_at" | "created_at">;
  inviteToken?: string;
  emailSent?: boolean;
  emailError?: string | null;
  ok?: boolean;
  error?: string;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ inviteId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requirePlatformRole("admin");
  if (auth.response) {
    return auth.response;
  }

  const payload = resendSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload" } satisfies InviteResponse, { status: 400 });
  }

  const { inviteId } = await params;
  const admin = createSupabaseAdminClient();
  const { data: existingInvite, error: existingInviteError } = await admin
    .from("platform_team_invites")
    .select("id,email,role,status")
    .eq("id", inviteId)
    .maybeSingle<Pick<PlatformTeamInviteRecord, "id" | "email" | "role" | "status">>();

  if (existingInviteError) {
    return NextResponse.json({ error: existingInviteError.message } satisfies InviteResponse, { status: 500 });
  }
  if (!existingInvite) {
    return NextResponse.json({ error: "Invite not found." } satisfies InviteResponse, { status: 404 });
  }

  const token = createInviteToken();
  const expiresAt = resolveInviteExpiry(payload.data.expiresInDays ?? 7);

  const { error: revokeError } = await admin
    .from("platform_team_invites")
    .update({ status: "revoked" })
    .eq("email", existingInvite.email)
    .eq("status", "pending");
  if (revokeError) {
    return NextResponse.json({ error: revokeError.message } satisfies InviteResponse, { status: 500 });
  }

  const { data: invite, error: inviteError } = await admin
    .from("platform_team_invites")
    .insert({
      email: existingInvite.email,
      role: existingInvite.role,
      status: "pending",
      token_hash: hashInviteToken(token),
      invited_by_user_id: auth.context!.userId,
      expires_at: expiresAt
    })
    .select("id,email,role,status,expires_at,created_at")
    .single<Pick<PlatformTeamInviteRecord, "id" | "email" | "role" | "status" | "expires_at" | "created_at">>();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message } satisfies InviteResponse, { status: 500 });
  }

  await logAuditEvent({
    actorUserId: auth.context!.userId,
    action: "platform_team_invite_reissued",
    entity: "platform_team_invite",
    entityId: invite.id,
    metadata: {
      email: invite.email,
      role: invite.role,
      previousInviteId: existingInvite.id,
      expiresAt
    }
  });

  if (!payload.data.sendEmail) {
    return NextResponse.json({ invite, inviteToken: token } satisfies InviteResponse);
  }

  const { data: inviterProfile } = await admin
    .from("user_profiles")
    .select("display_name,email")
    .eq("id", auth.context!.userId)
    .maybeSingle<{ display_name: string | null; email: string | null }>();

  const emailResult = await sendPlatformTeamInviteEmail({
    recipientEmail: invite.email,
    inviterName: inviterProfile?.display_name ?? inviterProfile?.email ?? null,
    role: invite.role,
    inviteToken: token,
    expiresAt
  });

  return NextResponse.json({
    invite,
    inviteToken: token,
    emailSent: emailResult.ok,
    emailError: emailResult.ok ? null : emailResult.error
  } satisfies InviteResponse);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ inviteId: string }> }) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requirePlatformRole("admin");
  if (auth.response) {
    return auth.response;
  }

  const { inviteId } = await params;
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("platform_team_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("status", "pending");

  if (error) {
    return NextResponse.json({ error: error.message } satisfies InviteResponse, { status: 500 });
  }

  await logAuditEvent({
    actorUserId: auth.context!.userId,
    action: "platform_team_invite_revoked",
    entity: "platform_team_invite",
    entityId: inviteId,
    metadata: {}
  });

  return NextResponse.json({ ok: true } satisfies InviteResponse);
}
