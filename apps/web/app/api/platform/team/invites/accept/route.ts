import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeInviteToken } from "@/lib/auth/invite-token";
import { acceptPlatformTeamInvite } from "@/lib/platform/accept-team-invite";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hashInviteToken } from "@/lib/stores/membership-invites";
import type { PlatformTeamInviteRecord } from "@/types/database";

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
    .from("platform_team_invites")
    .select("id,email,role,status,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle<Pick<PlatformTeamInviteRecord, "id" | "email" | "role" | "status" | "expires_at">>();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }
  if (!invite) {
    return NextResponse.json({ error: "Invite is invalid or no longer available." }, { status: 404 });
  }

  const result = await acceptPlatformTeamInvite({
    admin,
    userId: user.id,
    userEmail: user.email,
    invite
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, role: result.role, redirectPath: "/dashboard/admin/team" });
}
