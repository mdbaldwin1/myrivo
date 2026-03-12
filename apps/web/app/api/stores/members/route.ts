import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStorePermission } from "@/lib/auth/authorization";
import { logAuditEvent } from "@/lib/audit/log";
import { sendStoreMembershipInviteEmail } from "@/lib/notifications/team-invites";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createInviteToken, hashInviteToken, normalizeInviteEmail, resolveInviteExpiry } from "@/lib/stores/membership-invites";
import type { StoreMemberRole } from "@/types/database";

const inviteSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(["admin", "staff"]),
  expiresInDays: z.number().int().min(1).max(30).optional()
});

type MemberRow = {
  id: string;
  user_id: string;
  role: StoreMemberRole;
  status: "active" | "invited" | "suspended";
  created_at: string;
  updated_at: string;
};

type InviteRow = {
  id: string;
  email: string;
  role: "admin" | "staff";
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  invited_by_user_id: string;
  accepted_by_user_id: string | null;
  accepted_at: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireStorePermission("store.manage_members", request.nextUrl.searchParams.get("storeSlug"));
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const [{ data: members, error: membersError }, { data: invites, error: invitesError }] = await Promise.all([
    admin
      .from("store_memberships")
      .select("id,user_id,role,status,created_at,updated_at")
      .eq("store_id", auth.context.storeId)
      .returns<MemberRow[]>(),
    admin
      .from("store_membership_invites")
      .select("id,email,role,status,expires_at,invited_by_user_id,accepted_by_user_id,accepted_at,created_at")
      .eq("store_id", auth.context.storeId)
      .order("created_at", { ascending: false })
      .returns<InviteRow[]>()
  ]);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }
  if (invitesError) {
    return NextResponse.json({ error: invitesError.message }, { status: 500 });
  }

  const userIds = [...new Set((members ?? []).map((member) => member.user_id).filter(Boolean))];
  const { data: profiles, error: profilesError } = userIds.length
    ? await admin
        .from("user_profiles")
        .select("id,email,display_name,global_role")
        .in("id", userIds)
        .returns<Array<{ id: string; email: string | null; display_name: string | null; global_role: "user" | "support" | "admin" }>>()
    : { data: [], error: null };

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return NextResponse.json({
    members: (members ?? []).map((member) => ({
      ...member,
      profile: profileById.get(member.user_id) ?? null
    })),
    invites: invites ?? []
  });
}

export async function POST(request: NextRequest) {
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

  const payload = inviteSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const normalizedEmail = normalizeInviteEmail(payload.data.email);
  const [{ data: existingProfile }, { data: store, error: storeError }, { data: inviterProfile, error: inviterProfileError }] = await Promise.all([
    admin.from("user_profiles").select("id,email").eq("email", normalizedEmail).maybeSingle<{ id: string; email: string | null }>(),
    admin.from("stores").select("id,name,owner_user_id").eq("id", auth.context.storeId).single<{ id: string; name: string; owner_user_id: string }>(),
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

  if (existingProfile?.id === store.owner_user_id) {
    return NextResponse.json({ error: "The store owner already has access." }, { status: 400 });
  }

  if (existingProfile?.id) {
    const { data: existingMembership, error: membershipLookupError } = await admin
      .from("store_memberships")
      .select("id,user_id,role,status")
      .eq("store_id", auth.context.storeId)
      .eq("user_id", existingProfile.id)
      .maybeSingle<{ id: string; user_id: string; role: StoreMemberRole; status: "active" | "invited" | "suspended" }>();

    if (membershipLookupError) {
      return NextResponse.json({ error: membershipLookupError.message }, { status: 500 });
    }

    if (existingMembership && existingMembership.status === "active") {
      return NextResponse.json({ error: "User already has active access to this store." }, { status: 400 });
    }
  }

  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = resolveInviteExpiry(payload.data.expiresInDays ?? 7);

  const { error: revokePendingError } = await admin
    .from("store_membership_invites")
    .update({ status: "revoked" })
    .eq("store_id", auth.context.storeId)
    .eq("email", normalizedEmail)
    .eq("status", "pending");

  if (revokePendingError) {
    return NextResponse.json({ error: revokePendingError.message }, { status: 500 });
  }

  const { data: invite, error: inviteError } = await admin
    .from("store_membership_invites")
    .insert({
      store_id: auth.context.storeId,
      email: normalizedEmail,
      role: payload.data.role,
      status: "pending",
      token_hash: tokenHash,
      invited_by_user_id: auth.context.userId,
      expires_at: expiresAt
    })
    .select("id,email,role,status,expires_at,created_at")
    .single();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: auth.context.storeId,
    actorUserId: auth.context.userId,
    action: "store_member_invited",
    entity: "store_membership_invite",
    entityId: invite.id,
    metadata: {
      email: invite.email,
      role: invite.role,
      expiresAt
    }
  });

  const emailResult = await sendStoreMembershipInviteEmail({
    recipientEmail: invite.email,
    storeName: store.name,
    inviterName: inviterProfile?.display_name ?? inviterProfile?.email ?? null,
    role: invite.role,
    inviteToken: token,
    expiresAt
  });

  return NextResponse.json(
    {
      invite,
      inviteToken: token,
      emailSent: emailResult.ok,
      emailError: emailResult.ok ? null : emailResult.error
    },
    { status: 201 }
  );
}
