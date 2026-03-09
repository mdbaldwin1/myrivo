import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createVersionSchema = z.object({
  documentId: z.string().uuid(),
  versionLabel: z.string().trim().min(1).max(64),
  isRequired: z.boolean().default(true),
  contentMarkdown: z.string().min(40),
  changeSummary: z.string().trim().max(500).optional(),
  effectiveAt: z.string().datetime().optional(),
  publishNow: z.boolean().default(false)
});

const publishVersionSchema = z.object({
  versionId: z.string().uuid(),
  effectiveAt: z.string().datetime().optional()
});

export async function POST(request: Request) {
  const auth = await requirePlatformRole("admin");
  if (auth.response) {
    return auth.response;
  }

  const parsed = createVersionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const nowIso = new Date().toISOString();
  const isPublishing = payload.publishNow;
  const contentHash = createHash("sha256").update(payload.contentMarkdown).digest("hex");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("legal_document_versions")
    .insert({
      legal_document_id: payload.documentId,
      version_label: payload.versionLabel,
      status: isPublishing ? "published" : "draft",
      is_required: payload.isRequired,
      effective_at: payload.effectiveAt ?? (isPublishing ? nowIso : null),
      published_at: isPublishing ? nowIso : null,
      published_by_user_id: isPublishing ? auth.context?.userId ?? null : null,
      content_markdown: payload.contentMarkdown,
      content_hash: contentHash,
      change_summary: payload.changeSummary ?? null
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data?.id ?? null, published: isPublishing });
}

export async function PATCH(request: Request) {
  const auth = await requirePlatformRole("admin");
  if (auth.response) {
    return auth.response;
  }

  const parsed = publishVersionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const nowIso = new Date().toISOString();
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("legal_document_versions")
    .update({
      status: "published",
      effective_at: payload.effectiveAt ?? nowIso,
      published_at: nowIso,
      published_by_user_id: auth.context?.userId ?? null
    })
    .eq("id", payload.versionId)
    .eq("status", "draft");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
