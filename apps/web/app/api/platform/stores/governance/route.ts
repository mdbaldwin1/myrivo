import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { STORE_GOVERNANCE_REASON_LABELS, type StoreGovernanceReasonCode } from "@/lib/platform/store-governance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PendingStoreRow = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "pending_review" | "active" | "suspended";
  created_at: string;
};

type GovernanceAuditRow = {
  id: string;
  store_id: string | null;
  actor_user_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export async function GET() {
  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  const admin = createSupabaseAdminClient();
  const [{ data: pendingStores, error: pendingError }, { data: recentAudit, error: auditError }] = await Promise.all([
    admin
      .from("stores")
      .select("id,name,slug,status,created_at")
      .eq("status", "pending_review")
      .order("created_at", { ascending: true })
      .limit(100)
      .returns<PendingStoreRow[]>(),
    admin
      .from("audit_events")
      .select("id,store_id,actor_user_id,created_at,metadata")
      .eq("entity", "store")
      .eq("action", "update")
      .order("created_at", { ascending: false })
      .limit(300)
      .returns<GovernanceAuditRow[]>()
  ]);

  if (pendingError) {
    return NextResponse.json({ error: pendingError.message }, { status: 500 });
  }
  if (auditError) {
    return NextResponse.json({ error: auditError.message }, { status: 500 });
  }

  const governanceAudit = (recentAudit ?? []).filter((row) => row.metadata?.source === "platform_store_status");

  const [storeIds, actorIds] = governanceAudit.reduce<[Set<string>, Set<string>]>(
    (acc, row) => {
      if (row.store_id) {
        acc[0].add(row.store_id);
      }
      if (row.actor_user_id) {
        acc[1].add(row.actor_user_id);
      }
      return acc;
    },
    [new Set<string>(), new Set<string>()]
  );

  const [{ data: stores }, { data: actors }] = await Promise.all([
    storeIds.size
      ? admin
          .from("stores")
          .select("id,name,slug,status")
          .in("id", Array.from(storeIds))
          .returns<Array<{ id: string; name: string; slug: string; status: "draft" | "pending_review" | "active" | "suspended" }>>()
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; slug: string; status: "draft" | "pending_review" | "active" | "suspended" }> }),
    actorIds.size
      ? admin
          .from("user_profiles")
          .select("id,email,display_name")
          .in("id", Array.from(actorIds))
          .returns<Array<{ id: string; email: string | null; display_name: string | null }>>()
      : Promise.resolve({ data: [] as Array<{ id: string; email: string | null; display_name: string | null }> })
  ]);

  const storeById = new Map((stores ?? []).map((store) => [store.id, store]));
  const actorById = new Map((actors ?? []).map((actor) => [actor.id, actor]));

  const decisions = governanceAudit.slice(0, 100).map((row) => {
    const metadata = row.metadata ?? {};
    const action = (metadata.reviewAction as string | undefined) ?? "unknown";
    const reasonCode = (metadata.reviewReasonCode as StoreGovernanceReasonCode | undefined) ?? null;
    const reasonDetail = (metadata.reviewReason as string | null | undefined) ?? null;
    const store = row.store_id ? storeById.get(row.store_id) : null;
    const actor = row.actor_user_id ? actorById.get(row.actor_user_id) : null;

    return {
      id: row.id,
      at: row.created_at,
      action,
      reasonCode,
      reasonLabel: reasonCode ? STORE_GOVERNANCE_REASON_LABELS[reasonCode] : null,
      reasonDetail,
      store: store
        ? { id: store.id, name: store.name, slug: store.slug, status: store.status }
        : { id: row.store_id ?? "", name: "Unknown store", slug: "unknown", status: "draft" as const },
      actor: actor
        ? { id: actor.id, displayName: actor.display_name, email: actor.email }
        : { id: row.actor_user_id ?? "", displayName: null, email: null }
    };
  });

  return NextResponse.json({
    role: auth.context?.globalRole ?? "user",
    pendingStores: pendingStores ?? [],
    decisions
  });
}
