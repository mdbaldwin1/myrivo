import { NextRequest, NextResponse } from "next/server";
import { requireStorePermission } from "@/lib/auth/authorization";
import { logAuditEvent } from "@/lib/audit/log";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StoreMemberRole } from "@/types/database";

type MembershipRow = {
  id: string;
  store_id: string;
  user_id: string;
  role: StoreMemberRole;
  status: "active" | "invited" | "suspended";
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ membershipId: string }> }) {
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
  const context = auth.context;

  const admin = createSupabaseAdminClient();
  const { membershipId } = await params;

  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id,owner_user_id")
    .eq("id", context.storeId)
    .single<{ id: string; owner_user_id: string }>();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  if (store.owner_user_id !== context.userId) {
    return NextResponse.json({ error: "Only the current store owner can transfer ownership." }, { status: 403 });
  }

  const { data: targetMembership, error: targetMembershipError } = await admin
    .from("store_memberships")
    .select("id,store_id,user_id,role,status")
    .eq("id", membershipId)
    .eq("store_id", context.storeId)
    .maybeSingle<MembershipRow>();

  if (targetMembershipError) {
    return NextResponse.json({ error: targetMembershipError.message }, { status: 500 });
  }

  if (!targetMembership) {
    return NextResponse.json({ error: "Membership not found." }, { status: 404 });
  }

  if (targetMembership.user_id === context.userId) {
    return NextResponse.json({ error: "You already own this store." }, { status: 400 });
  }

  if (targetMembership.status !== "active") {
    return NextResponse.json({ error: "Ownership can only be transferred to an active team member." }, { status: 400 });
  }

  if (targetMembership.role === "owner") {
    return NextResponse.json({ error: "That member already owns the store." }, { status: 400 });
  }

  const { data: currentOwnerMembership, error: currentOwnerMembershipError } = await admin
    .from("store_memberships")
    .select("id,store_id,user_id,role,status")
    .eq("store_id", context.storeId)
    .eq("user_id", context.userId)
    .maybeSingle<MembershipRow>();

  if (currentOwnerMembershipError) {
    return NextResponse.json({ error: currentOwnerMembershipError.message }, { status: 500 });
  }

  const previousTargetRole = targetMembership.role;
  const previousOwnerUserId = context.userId;
  let storeOwnerUpdated = false;
  let targetMembershipUpserted = false;

  const rollbackStoreOwner = async () => {
    if (!storeOwnerUpdated) {
      return;
    }
    await admin.from("stores").update({ owner_user_id: previousOwnerUserId }).eq("id", context.storeId);
  };

  const rollbackTargetMembership = async () => {
    if (!targetMembershipUpserted) {
      return;
    }
    await admin
      .from("store_memberships")
      .upsert(
        {
          store_id: context.storeId,
          user_id: targetMembership.user_id,
          role: previousTargetRole,
          status: targetMembership.status
        },
        { onConflict: "store_id,user_id" }
      );
  };

  const { error: storeUpdateError } = await admin
    .from("stores")
    .update({ owner_user_id: targetMembership.user_id })
    .eq("id", context.storeId);

  if (storeUpdateError) {
    return NextResponse.json({ error: storeUpdateError.message }, { status: 500 });
  }
  storeOwnerUpdated = true;

  const { error: targetUpdateError } = await admin
    .from("store_memberships")
    .upsert(
      {
        store_id: context.storeId,
        user_id: targetMembership.user_id,
        role: "owner",
        status: "active"
      },
      { onConflict: "store_id,user_id" }
    );

  if (targetUpdateError) {
    await rollbackStoreOwner();
    return NextResponse.json({ error: targetUpdateError.message }, { status: 500 });
  }
  targetMembershipUpserted = true;

  const { error: currentOwnerUpdateError } = await admin
    .from("store_memberships")
    .upsert(
      {
        store_id: context.storeId,
        user_id: previousOwnerUserId,
        role: "admin",
        status: "active"
      },
      { onConflict: "store_id,user_id" }
    );

  if (currentOwnerUpdateError) {
    await rollbackTargetMembership();
    await rollbackStoreOwner();
    return NextResponse.json({ error: currentOwnerUpdateError.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: context.storeId,
    actorUserId: context.userId,
    action: "store_ownership_transferred",
    entity: "store",
    entityId: context.storeId,
    metadata: {
      previousOwnerUserId,
      nextOwnerUserId: targetMembership.user_id,
      previousTargetRole
    }
  });

  return NextResponse.json({
    ok: true,
    nextOwnerUserId: targetMembership.user_id,
    downgradedOwnerMembershipId: currentOwnerMembership?.id ?? null,
    promotedMembershipId: targetMembership.id
  });
}
