import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  context: z.string().trim().min(1).max(120),
  targetHref: z.string().trim().min(1).max(500),
  sourcePathname: z.string().trim().max(500).nullable().optional(),
  storeSlug: z.string().trim().max(120).nullable().optional()
});

export async function POST(request: Request) {
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const admin = createSupabaseAdminClient();
  let storeId: string | null = null;

  if (parsed.data.storeSlug) {
    const { data: store } = await admin
      .from("stores")
      .select("id")
      .eq("slug", parsed.data.storeSlug)
      .maybeSingle<{ id: string }>();
    storeId = store?.id ?? null;
  }

  await admin.from("audit_events").insert({
    store_id: storeId,
    actor_user_id: user.id,
    action: "open",
    entity: "context_help",
    entity_id: parsed.data.context,
    metadata: {
      source: "context_help",
      targetHref: parsed.data.targetHref,
      sourcePathname: parsed.data.sourcePathname ?? null
    }
  });

  return NextResponse.json({ ok: true });
}
