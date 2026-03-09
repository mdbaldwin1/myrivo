import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { isMissingRelationInSchemaCache } from "@/lib/supabase/error-classifiers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().trim().min(1).max(60).optional(),
  entity: z.string().trim().min(1).max(60).optional()
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    action: request.nextUrl.searchParams.get("action") ?? undefined,
    entity: request.nextUrl.searchParams.get("entity") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");

  if (!bundle) {
    return NextResponse.json({ error: "No store found for account" }, { status: 404 });
  }

  let query = supabase
    .from("audit_events")
    .select("id,action,entity,entity_id,metadata,created_at")
    .eq("store_id", bundle.store.id)
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);

  if (parsed.data.action) {
    query = query.eq("action", parsed.data.action);
  }

  if (parsed.data.entity) {
    query = query.eq("entity", parsed.data.entity);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingRelationInSchemaCache(error)) {
      return NextResponse.json({ events: [] });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}
