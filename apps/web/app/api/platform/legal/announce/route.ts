import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformRole } from "@/lib/auth/authorization";
import { buildLegalUpdateContent } from "@/lib/legal/communications";
import { dispatchNotification } from "@/lib/notifications/dispatcher";
import { resolvePlatformNotificationFromAddress, resolvePlatformNotificationReplyTo } from "@/lib/notifications/sender";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const announceSchema = z.object({
  versionId: z.string().uuid(),
  audience: z.enum(["all", "merchant", "customer", "platform"]).optional()
});

type VersionRow = {
  id: string;
  version_label: string;
  effective_at: string | null;
  legal_documents: {
    key: string;
    title: string;
    audience: "all" | "merchant" | "customer" | "platform";
  } | null;
};

async function resolveRecipientUserIds(admin: ReturnType<typeof createSupabaseAdminClient>, audience: "all" | "merchant" | "customer" | "platform") {
  if (audience === "merchant") {
    const { data, error } = await admin.from("stores").select("owner_user_id").not("owner_user_id", "is", null).returns<Array<{ owner_user_id: string }>>();
    if (error) {
      throw new Error(error.message);
    }
    return Array.from(new Set((data ?? []).map((row) => row.owner_user_id)));
  }

  if (audience === "platform") {
    const { data, error } = await admin
      .from("user_profiles")
      .select("id")
      .in("global_role", ["support", "admin"])
      .returns<Array<{ id: string }>>();
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => row.id);
  }

  if (audience === "customer") {
    const { data, error } = await admin.from("user_profiles").select("id").eq("global_role", "user").returns<Array<{ id: string }>>();
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => row.id);
  }

  const { data, error } = await admin.from("user_profiles").select("id").returns<Array<{ id: string }>>();
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => row.id);
}

export async function POST(request: Request) {
  const auth = await requirePlatformRole("admin");
  if (auth.response) {
    return auth.response;
  }

  const parsed = announceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: version, error: versionError } = await admin
    .from("legal_document_versions")
    .select("id,version_label,effective_at,legal_documents!inner(key,title,audience)")
    .eq("id", parsed.data.versionId)
    .maybeSingle<VersionRow>();

  if (versionError) {
    return NextResponse.json({ error: versionError.message }, { status: 500 });
  }
  if (!version?.legal_documents) {
    return NextResponse.json({ error: "Legal version not found." }, { status: 404 });
  }

  const audience = parsed.data.audience ?? version.legal_documents.audience;
  const recipientUserIds = await resolveRecipientUserIds(admin, audience);
  if (recipientUserIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, audience });
  }

  const actionUrl = "/legal/consent";
  const content = buildLegalUpdateContent({
    documentTitle: version.legal_documents.title,
    documentKey: version.legal_documents.key,
    versionLabel: version.version_label,
    effectiveAt: version.effective_at,
    actionUrl
  });

  let sent = 0;
  let skipped = 0;

  for (const recipientUserId of recipientUserIds) {
    try {
      const result = await dispatchNotification({
        recipientUserId,
        eventType: "legal.update.required",
        title: content.title,
        body: content.body,
        actionUrl,
        severity: "warning",
        channelTargets: ["in_app", "email"],
        dedupeKey: `legal-update:${version.id}:${recipientUserId}`,
        metadata: {
          source: "legal_update_announcement",
          audience,
          legalVersionId: version.id,
          legalDocumentKey: version.legal_documents.key
        },
        email: {
          from: resolvePlatformNotificationFromAddress(),
          replyTo: resolvePlatformNotificationReplyTo(),
          subject: content.emailSubject,
          text: content.emailText
        }
      });

      if (result.skipped) {
        skipped += 1;
      } else if (result.ok) {
        sent += 1;
      }
    } catch {
      skipped += 1;
    }
  }

  await admin.from("audit_events").insert({
    store_id: null,
    actor_user_id: auth.context?.userId ?? null,
    action: "announce",
    entity: "legal_update",
    entity_id: version.id,
    metadata: {
      audience,
      recipients: recipientUserIds.length,
      sent,
      skipped,
      documentKey: version.legal_documents.key,
      versionLabel: version.version_label
    }
  });

  return NextResponse.json({ ok: true, sent, skipped, audience, recipients: recipientUserIds.length });
}
