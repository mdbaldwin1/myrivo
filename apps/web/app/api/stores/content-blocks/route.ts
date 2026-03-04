import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function isValidCtaUrl(value: string) {
  if (value.startsWith("/") || value.startsWith("#") || value.startsWith("mailto:") || value.startsWith("tel:")) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const contentBlockSchema = z.object({
  id: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).default(0),
  eyebrow: z.string().max(80).nullable().optional(),
  title: z.string().min(2).max(140),
  body: z.string().min(2).max(1000),
  ctaLabel: z.string().max(50).nullable().optional(),
  ctaUrl: z
    .string()
    .trim()
    .max(500)
    .refine(isValidCtaUrl, {
      message: "CTA URL must be an absolute URL, site-relative path, or page anchor."
    })
    .nullable()
    .optional(),
  isActive: z.boolean().default(true)
});

const putSchema = z.object({
  blocks: z.array(contentBlockSchema).max(20)
});

async function getStore() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const bundle = await getOwnedStoreBundle(user.id, "staff");

  if (!bundle) {
    return { error: NextResponse.json({ error: "No store found for account" }, { status: 404 }) } as const;
  }

  return { supabase, storeId: bundle.store.id } as const;
}

export async function GET() {
  const resolved = await getStore();

  if ("error" in resolved) {
    return resolved.error;
  }

  const { data, error } = await resolved.supabase
    .from("store_content_blocks")
    .select("id,sort_order,eyebrow,title,body,cta_label,cta_url,is_active")
    .eq("store_id", resolved.storeId)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ blocks: data ?? [] });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);

  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = putSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload", details: payload.error.flatten() }, { status: 400 });
  }

  const resolved = await getStore();

  if ("error" in resolved) {
    return resolved.error;
  }

  const blocks = payload.data.blocks.map((block) => ({
    ...(block.id ? { id: block.id } : {}),
    store_id: resolved.storeId,
    sort_order: block.sortOrder,
    eyebrow: block.eyebrow ?? null,
    title: block.title,
    body: block.body,
    cta_label: block.ctaLabel ?? null,
    cta_url: block.ctaUrl ?? null,
    is_active: block.isActive
  }));

  const { data: existingBlocks, error: existingError } = await resolved.supabase
    .from("store_content_blocks")
    .select("id")
    .eq("store_id", resolved.storeId);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const incomingIds = new Set(blocks.map((block) => block.id).filter(Boolean));
  const removableIds = (existingBlocks ?? []).map((block) => block.id).filter((id) => !incomingIds.has(id));

  if (removableIds.length > 0) {
    const { error: deleteError } = await resolved.supabase
      .from("store_content_blocks")
      .delete()
      .eq("store_id", resolved.storeId)
      .in("id", removableIds);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  if (blocks.length > 0) {
    const { error: upsertError } = await resolved.supabase
      .from("store_content_blocks")
      .upsert(blocks, { onConflict: "id" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  const { data, error } = await resolved.supabase
    .from("store_content_blocks")
    .select("id,sort_order,eyebrow,title,body,cta_label,cta_url,is_active")
    .eq("store_id", resolved.storeId)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ blocks: data ?? [] });
}
