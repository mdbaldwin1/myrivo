import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { logAuditEvent } from "@/lib/audit/log";
import { sendPlatformTeamInviteEmail } from "@/lib/notifications/platform-team-invites";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createInviteToken, hashInviteToken, normalizeInviteEmail, resolveInviteExpiry } from "@/lib/stores/membership-invites";
import type { GlobalUserRole, PlatformTeamInviteRecord, UserProfileRecord } from "@/types/database";

const inviteSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(["admin", "support"]),
  expiresInDays: z.number().int().min(1).max(30).optional()
});

type TeamResponse = {
  role: GlobalUserRole;
  members?: Array<Pick<UserProfileRecord, "id" | "email" | "display_name" | "global_role" | "created_at">>;
  invites?: Array<Pick<PlatformTeamInviteRecord, "id" | "email" | "role" | "status" | "expires_at" | "created_at">>;
  invite?: Pick<PlatformTeamInviteRecord, "id" | "email" | "role" | "status" | "expires_at" | "created_at">;
  inviteToken?: string;
  emailSent?: boolean;
  emailError?: string | null;
  error?: string;
};

export async function GET() {
  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  const admin = createSupabaseAdminClient();
  const [{ data: members, error: membersError }, { data: invites, error: invitesError }] = await Promise.all([
    admin
      .from("user_profiles")
      .select("id,email,display_name,global_role,created_at")
      .in("global_role", ["admin", "support"])
      .order("global_role", { ascending: false })
      .order("created_at", { ascending: true })
      .returns<Array<Pick<UserProfileRecord, "id" | "email" | "display_name" | "global_role" | "created_at">>>(),
    admin
      .from("platform_team_invites")
      .select("id,email,role,status,expires_at,created_at")
      .order("created_at", { ascending: false })
      .returns<Array<Pick<PlatformTeamInviteRecord, "id" | "email" | "role" | "status" | "expires_at" | "created_at">>>()
  ]);

  if (membersError) {
    return NextResponse.json({ role: auth.context?.globalRole ?? "user", error: membersError.message } satisfies TeamResponse, { status: 500 });
  }
  if (invitesError) {
    return NextResponse.json({ role: auth.context?.globalRole ?? "user", error: invitesError.message } satisfies TeamResponse, { status: 500 });
  }

  return NextResponse.json({
    role: auth.context?.globalRole ?? "user",
    members: members ?? [],
    invites: invites ?? []
  } satisfies TeamResponse);
}

export async function POST(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const auth = await requirePlatformRole("admin");
  if (auth.response) {
    return auth.response;
  }

  const payload = inviteSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ role: auth.context?.globalRole ?? "user", error: "Invalid payload" } satisfies TeamResponse, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const normalizedEmail = normalizeInviteEmail(payload.data.email);
  const [{ data: existingProfile }, { data: inviterProfile, error: inviterProfileError }] = await Promise.all([
    admin.from("user_profiles").select("id,email,display_name,global_role").eq("email", normalizedEmail).maybeSingle<UserProfileRecord>(),
    admin.from("user_profiles").select("display_name,email").eq("id", auth.context!.userId).maybeSingle<{ display_name: string | null; email: string | null }>()
  ]);

  if (inviterProfileError) {
    return NextResponse.json({ role: auth.context?.globalRole ?? "user", error: inviterProfileError.message } satisfies TeamResponse, { status: 500 });
  }

  if (existingProfile && existingProfile.global_role !== "user") {
    return NextResponse.json({ role: auth.context?.globalRole ?? "user", error: "User already has platform team access." } satisfies TeamResponse, { status: 400 });
  }

  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = resolveInviteExpiry(payload.data.expiresInDays ?? 7);

  const { error: revokePendingError } = await admin
    .from("platform_team_invites")
    .update({ status: "revoked" })
    .eq("email", normalizedEmail)
    .eq("status", "pending");

  if (revokePendingError) {
    return NextResponse.json({ role: auth.context?.globalRole ?? "user", error: revokePendingError.message } satisfies TeamResponse, { status: 500 });
  }

  const { data: invite, error: inviteError } = await admin
    .from("platform_team_invites")
    .insert({
      email: normalizedEmail,
      role: payload.data.role,
      status: "pending",
      token_hash: tokenHash,
      invited_by_user_id: auth.context!.userId,
      expires_at: expiresAt
    })
    .select("id,email,role,status,expires_at,created_at")
    .single<Pick<PlatformTeamInviteRecord, "id" | "email" | "role" | "status" | "expires_at" | "created_at">>();

  if (inviteError) {
    return NextResponse.json({ role: auth.context?.globalRole ?? "user", error: inviteError.message } satisfies TeamResponse, { status: 500 });
  }

  await logAuditEvent({
    actorUserId: auth.context!.userId,
    action: "platform_team_invited",
    entity: "platform_team_invite",
    entityId: invite.id,
    metadata: {
      email: invite.email,
      role: invite.role,
      expiresAt
    }
  });

  const emailResult = await sendPlatformTeamInviteEmail({
    recipientEmail: invite.email,
    inviterName: inviterProfile?.display_name ?? inviterProfile?.email ?? null,
    role: invite.role,
    inviteToken: token,
    expiresAt
  });

  return NextResponse.json(
    {
      role: auth.context?.globalRole ?? "user",
      invites: [invite],
      invite,
      inviteToken: token,
      emailSent: emailResult.ok,
      emailError: emailResult.ok ? null : emailResult.error
    },
    { status: 201 }
  );
}
