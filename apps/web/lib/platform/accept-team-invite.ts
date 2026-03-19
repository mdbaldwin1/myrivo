import { logAuditEvent } from "@/lib/audit/log";
import { normalizeInviteEmail } from "@/lib/stores/membership-invites";
import type { PlatformTeamInviteRole } from "@/types/database";

type AcceptInviteRow = {
  id: string;
  email: string;
  role: PlatformTeamInviteRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
};

type AcceptInviteInput = {
  admin: {
    from: (table: string) => {
      update: (
        values: Record<string, unknown>
      ) => {
        eq: (
          column: string,
          value: string
        ) => PromiseLike<{ error: { message: string } | null }> | { error: { message: string } | null };
      };
    };
  };
  userId: string;
  userEmail: string;
  invite: AcceptInviteRow;
};

type AcceptInviteResult = { ok: true; role: PlatformTeamInviteRole } | { ok: false; status: number; error: string };

export async function acceptPlatformTeamInvite(input: AcceptInviteInput): Promise<AcceptInviteResult> {
  const { admin, userId, userEmail, invite } = input;

  if (invite.status !== "pending") {
    return { ok: false, status: 404, error: "Invite is invalid or no longer available." };
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await admin.from("platform_team_invites").update({ status: "expired" }).eq("id", invite.id);
    return { ok: false, status: 400, error: "Invite has expired." };
  }

  if (normalizeInviteEmail(userEmail) !== normalizeInviteEmail(invite.email)) {
    return { ok: false, status: 403, error: "Invite email does not match signed-in account." };
  }

  const roleUpdateResponse = await admin.from("user_profiles").update({ global_role: invite.role }).eq("id", userId);
  if (roleUpdateResponse.error) {
    return { ok: false, status: 500, error: roleUpdateResponse.error.message };
  }

  const inviteUpdateResponse = await admin.from("platform_team_invites").update({
    status: "accepted",
    accepted_by_user_id: userId,
    accepted_at: new Date().toISOString()
  }).eq("id", invite.id);
  if (inviteUpdateResponse.error) {
    return { ok: false, status: 500, error: inviteUpdateResponse.error.message };
  }

  await logAuditEvent({
    actorUserId: userId,
    action: "platform_team_invite_accepted",
    entity: "platform_team_invite",
    entityId: invite.id,
    metadata: {
      email: invite.email,
      role: invite.role
    }
  });

  return { ok: true, role: invite.role };
}
