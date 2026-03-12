import { logAuditEvent } from "@/lib/audit/log";
import { notifyOwnersTeamInviteAccepted } from "@/lib/notifications/owner-notifications";
import { normalizeInviteEmail } from "@/lib/stores/membership-invites";
import type { StoreMemberRole } from "@/types/database";

type AcceptInviteRow = {
  id: string;
  store_id: string;
  email: string;
  role: Exclude<StoreMemberRole, "owner">;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  store: { slug: string } | null;
};

type AcceptInviteInput = {
  admin: {
    from: (table: string) => {
      upsert?: (
        values: Record<string, unknown>,
        options?: { onConflict?: string }
      ) => PromiseLike<{ error: { message: string } | null }> | { error: { message: string } | null };
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

type AcceptInviteResult =
  | { ok: true; storeId: string; storeSlug: string | null; role: Exclude<StoreMemberRole, "owner"> }
  | { ok: false; status: number; error: string };

export async function acceptStoreMembershipInvite(input: AcceptInviteInput): Promise<AcceptInviteResult> {
  const { admin, userId, userEmail, invite } = input;

  if (invite.status !== "pending") {
    return { ok: false, status: 404, error: "Invite is invalid or no longer available." };
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await admin.from("store_membership_invites").update({ status: "expired" }).eq("id", invite.id);
    return { ok: false, status: 400, error: "Invite has expired." };
  }

  if (normalizeInviteEmail(userEmail) !== normalizeInviteEmail(invite.email)) {
    return { ok: false, status: 403, error: "Invite email does not match signed-in account." };
  }

  const membershipResponse = await admin.from("store_memberships").upsert?.(
    {
      store_id: invite.store_id,
      user_id: userId,
      role: invite.role,
      status: "active"
    },
    { onConflict: "store_id,user_id" }
  );

  if (membershipResponse?.error) {
    return { ok: false, status: 500, error: membershipResponse.error.message };
  }

  const nowIso = new Date().toISOString();
  const inviteUpdateResponse = await admin.from("store_membership_invites").update({
    status: "accepted",
    accepted_by_user_id: userId,
    accepted_at: nowIso
  }).eq("id", invite.id);

  if (inviteUpdateResponse.error) {
    return { ok: false, status: 500, error: inviteUpdateResponse.error.message };
  }

  await logAuditEvent({
    storeId: invite.store_id,
    actorUserId: userId,
    action: "store_member_invite_accepted",
    entity: "store_membership_invite",
    entityId: invite.id,
    metadata: {
      email: invite.email,
      role: invite.role
    }
  });

  await notifyOwnersTeamInviteAccepted({
    storeId: invite.store_id,
    storeSlug: invite.store?.slug ?? null,
    acceptedInviteId: invite.id,
    acceptedByUserId: userId,
    acceptedEmail: invite.email,
    role: invite.role
  });

  return {
    ok: true,
    storeId: invite.store_id,
    storeSlug: invite.store?.slug ?? null,
    role: invite.role
  };
}
