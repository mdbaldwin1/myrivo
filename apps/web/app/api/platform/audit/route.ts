import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  entity: z.string().trim().min(1).max(80).optional(),
  action: z.string().trim().min(1).max(80).optional(),
  storeId: z.string().uuid().optional(),
  actorUserId: z.string().uuid().optional()
});

type AuditEventRow = {
  id: string;
  store_id: string | null;
  actor_user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const auth = await requirePlatformRole("support");
  if (auth.response) {
    return auth.response;
  }

  const parsed = querySchema.safeParse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    entity: request.nextUrl.searchParams.get("entity") ?? undefined,
    action: request.nextUrl.searchParams.get("action") ?? undefined,
    storeId: request.nextUrl.searchParams.get("storeId") ?? undefined,
    actorUserId: request.nextUrl.searchParams.get("actorUserId") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("audit_events")
    .select("id,store_id,actor_user_id,action,entity,entity_id,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);

  if (parsed.data.entity) {
    query = query.eq("entity", parsed.data.entity);
  }
  if (parsed.data.action) {
    query = query.eq("action", parsed.data.action);
  }
  if (parsed.data.storeId) {
    query = query.eq("store_id", parsed.data.storeId);
  }
  if (parsed.data.actorUserId) {
    query = query.eq("actor_user_id", parsed.data.actorUserId);
  }

  const { data: events, error } = await query.returns<AuditEventRow[]>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const eventRows = events ?? [];
  const storeIds = Array.from(new Set(eventRows.map((event) => event.store_id).filter((id): id is string => Boolean(id))));
  const actorIds = Array.from(new Set(eventRows.map((event) => event.actor_user_id).filter((id): id is string => Boolean(id))));

  const [{ data: stores }, { data: actors }] = await Promise.all([
    storeIds.length
      ? admin
          .from("stores")
          .select("id,name,slug,status")
          .in("id", storeIds)
          .returns<Array<{ id: string; name: string; slug: string; status: "draft" | "pending_review" | "active" | "suspended" }>>()
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; slug: string; status: "draft" | "pending_review" | "active" | "suspended" }> }),
    actorIds.length
      ? admin
          .from("user_profiles")
          .select("id,email,display_name,global_role")
          .in("id", actorIds)
          .returns<Array<{ id: string; email: string | null; display_name: string | null; global_role: "user" | "support" | "admin" }>>()
      : Promise.resolve({ data: [] as Array<{ id: string; email: string | null; display_name: string | null; global_role: "user" | "support" | "admin" }> })
  ]);

  const storeById = new Map((stores ?? []).map((store) => [store.id, store]));
  const actorById = new Map((actors ?? []).map((actor) => [actor.id, actor]));

  return NextResponse.json({
    role: auth.context?.globalRole ?? "user",
    filters: parsed.data,
    events: eventRows.map((event) => ({
      id: event.id,
      action: event.action,
      entity: event.entity,
      entityId: event.entity_id,
      metadata: event.metadata ?? {},
      createdAt: event.created_at,
      store: event.store_id ? storeById.get(event.store_id) ?? null : null,
      actor: event.actor_user_id ? actorById.get(event.actor_user_id) ?? null : null
    }))
  });
}
