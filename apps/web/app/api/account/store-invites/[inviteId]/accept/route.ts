import { NextRequest, NextResponse } from "next/server";
import { acceptStoreMembershipInvite } from "@/lib/stores/accept-membership-invite";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StoreMemberRole } from "@/types/database";

type InviteRow = {
  id: string;
  store_id: string;
  email: string;
  role: Exclude<StoreMemberRole, "owner">;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  store: { slug: string } | null;
};

export async function POST(_request: NextRequest, { params }: { params: Promise<{ inviteId: string }> }) {
  const { inviteId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: invite, error } = await admin
    .from("store_membership_invites")
    .select("id,store_id,email,role,status,expires_at,store:stores!inner(slug)")
    .eq("id", inviteId)
    .maybeSingle<InviteRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  const result = await acceptStoreMembershipInvite({
    admin,
    userId: user.id,
    userEmail: user.email,
    invite
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, storeId: result.storeId, storeSlug: result.storeSlug, role: result.role });
}
