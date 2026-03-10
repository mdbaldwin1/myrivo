import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStorePermission } from "@/lib/auth/authorization";
import { logAuditEvent } from "@/lib/audit/log";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StoreMemberRole } from "@/types/database";

const updateSchema = z.object({
  role: z.enum(["owner", "admin", "staff", "customer"]).optional(),
  status: z.enum(["active", "suspended"]).optional()
});

async function countActiveOwners(admin: ReturnType<typeof createSupabaseAdminClient>, storeId: string) {
  const { count, error } = await admin
    .from("store_memberships")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("role", "owner")
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ membershipId: string }> }) {
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

  const payload = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success || (!payload.data.role && !payload.data.status)) {
    return NextResponse.json({ error: "Invalid payload", details: payload.success ? undefined : payload.error.flatten() }, { status: 400 });
  }

  const { membershipId } = await params;
  const admin = createSupabaseAdminClient();

  const { data: membership, error: membershipError } = await admin
    .from("store_memberships")
    .select("id,store_id,user_id,role,status")
    .eq("id", membershipId)
    .eq("store_id", auth.context.storeId)
    .maybeSingle<{
      id: string;
      store_id: string;
      user_id: string;
      role: StoreMemberRole;
      status: "active" | "invited" | "suspended";
    }>();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ error: "Membership not found." }, { status: 404 });
  }

  if (membership.user_id === auth.context.userId && payload.data.role && payload.data.role !== membership.role) {
    return NextResponse.json({ error: "Use another admin account to change your own store role." }, { status: 400 });
  }

  if (
    membership.role === "owner" &&
    (payload.data.status === "suspended" || (payload.data.role && payload.data.role !== "owner"))
  ) {
    const ownerCount = await countActiveOwners(admin, auth.context.storeId);
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "At least one active owner is required." }, { status: 400 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (payload.data.role) {
    updates.role = payload.data.role;
  }
  if (payload.data.status) {
    updates.status = payload.data.status;
  }

  const { data, error } = await admin
    .from("store_memberships")
    .update(updates)
    .eq("id", membership.id)
    .eq("store_id", auth.context.storeId)
    .select("id,store_id,user_id,role,status,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: auth.context.storeId,
    actorUserId: auth.context.userId,
    action: "store_member_updated",
    entity: "store_membership",
    entityId: membership.id,
    metadata: {
      previousRole: membership.role,
      nextRole: data.role,
      previousStatus: membership.status,
      nextStatus: data.status
    }
  });

  return NextResponse.json({ membership: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ membershipId: string }> }) {
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

  const { membershipId } = await params;
  const admin = createSupabaseAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("store_memberships")
    .select("id,store_id,user_id,role,status")
    .eq("id", membershipId)
    .eq("store_id", auth.context.storeId)
    .maybeSingle<{
      id: string;
      store_id: string;
      user_id: string;
      role: StoreMemberRole;
      status: "active" | "invited" | "suspended";
    }>();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }
  if (!membership) {
    return NextResponse.json({ error: "Membership not found." }, { status: 404 });
  }
  if (membership.user_id === auth.context.userId) {
    return NextResponse.json({ error: "Use another admin account to remove your own membership." }, { status: 400 });
  }

  if (membership.role === "owner" && membership.status === "active") {
    const ownerCount = await countActiveOwners(admin, auth.context.storeId);
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "At least one active owner is required." }, { status: 400 });
    }
  }

  const { error } = await admin.from("store_memberships").delete().eq("id", membership.id).eq("store_id", auth.context.storeId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: auth.context.storeId,
    actorUserId: auth.context.userId,
    action: "store_member_removed",
    entity: "store_membership",
    entityId: membership.id,
    metadata: {
      removedUserId: membership.user_id,
      removedRole: membership.role,
      removedStatus: membership.status
    }
  });

  return NextResponse.json({ ok: true });
}
