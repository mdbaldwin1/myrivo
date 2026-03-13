import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import {
  areStoreLegalDocumentSnapshotsEquivalent,
  getDraftStoreLegalDocumentSnapshot,
  getPublishedStoreLegalDocumentSnapshot,
  getStoreLegalDocumentsByStoreId,
  type StoreLegalDocumentRow
} from "@/lib/legal/store-documents";
import { resolveStorePrivacyProfile } from "@/lib/privacy/store-privacy";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { storeLegalDocumentsEditorSchema } from "@/lib/store-editor/schemas";
import { getStoreLegalDocument, type StoreLegalDocumentKey } from "@/lib/storefront/store-legal-documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";
import type { StorePrivacyProfileRecord } from "@/types/database";

type StoreLegalDocumentApiSnapshot = z.infer<typeof storeLegalDocumentsEditorSchema>;
const publishStoreLegalDocumentSchema = z.object({
  key: z.enum(["privacy", "terms"]),
  changeSummary: z.string().trim().min(8).max(500),
  effectiveAt: z.string().datetime().nullable().optional()
});

function buildDocumentEntry(
  key: StoreLegalDocumentKey,
  record: StoreLegalDocumentRow | undefined
) {
  const definition = getStoreLegalDocument(key);
  return {
    source_mode: record?.source_mode ?? "template",
    title_override: record?.title_override ?? definition.title,
    body_markdown: record?.body_markdown?.trim() || definition.defaultBodyMarkdown,
    variables_json: Object.fromEntries(
      Object.entries(record?.variables_json ?? {}).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : []))
    ),
    published_source_mode: record?.published_source_mode ?? "template",
    published_template_version: record?.published_template_version ?? "v1",
    published_title: record?.published_title?.trim() || definition.title,
    published_body_markdown: record?.published_body_markdown?.trim() || definition.defaultBodyMarkdown,
    published_variables_json: Object.fromEntries(
      Object.entries(record?.published_variables_json ?? {}).flatMap(([entryKey, value]) =>
        typeof value === "string" ? [[entryKey, value]] : []
      )
    ),
    published_version: record?.published_version ?? 1,
    published_change_summary: record?.published_change_summary ?? null,
    effective_at: record?.effective_at ?? null,
    published_at: record?.published_at ?? null
  };
}

function buildPrivacyComplianceEntry(
  profile: StorePrivacyProfileRecord | null | undefined,
  supportEmail: string | null
) {
  const resolved = resolveStorePrivacyProfile(profile, { support_email: supportEmail });
  return {
    notice_at_collection_enabled: resolved.noticeAtCollectionEnabled,
    checkout_notice_enabled: resolved.checkoutNoticeEnabled,
    newsletter_notice_enabled: resolved.newsletterNoticeEnabled,
    review_notice_enabled: resolved.reviewNoticeEnabled,
    show_california_notice: resolved.showCaliforniaNotice,
    show_do_not_sell_link: resolved.showDoNotSellLink,
    privacy_contact_email: resolved.privacyContactEmail,
    privacy_rights_email: resolved.privacyRightsEmail,
    privacy_contact_name: resolved.privacyContactName,
    collection_notice_addendum_markdown: resolved.collectionNoticeAddendumMarkdown,
    california_notice_markdown: resolved.californiaNoticeMarkdown,
    do_not_sell_markdown: resolved.doNotSellMarkdown,
    request_page_intro_markdown: resolved.requestPageIntroMarkdown
  };
}

async function resolveOwnerContext(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const bundle = await getOwnedStoreBundleForOptionalSlug(user.id, request.nextUrl.searchParams.get("storeSlug"), "admin");
  if (!bundle) {
    return { error: NextResponse.json({ error: "Store not found or insufficient access." }, { status: 404 }) } as const;
  }

  return { supabase, bundle, user } as const;
}

export async function GET(request: NextRequest) {
  const resolved = await resolveOwnerContext(request);
  if ("error" in resolved) {
    return resolved.error;
  }

  const { supabase, bundle } = resolved;
  const [documents, privacyProfileResult] = await Promise.all([
    getStoreLegalDocumentsByStoreId(supabase, bundle.store.id),
    supabase.from("store_privacy_profiles").select("*").eq("store_id", bundle.store.id).maybeSingle<StorePrivacyProfileRecord>()
  ]);
  if (privacyProfileResult.error) {
    return NextResponse.json({ error: privacyProfileResult.error.message }, { status: 500 });
  }
  const privacy = documents.find((entry) => entry.key === "privacy");
  const terms = documents.find((entry) => entry.key === "terms");

  const snapshot: StoreLegalDocumentApiSnapshot = {
    privacyCompliance: buildPrivacyComplianceEntry(privacyProfileResult.data, bundle.settings?.support_email ?? null),
    privacy: buildDocumentEntry("privacy", privacy),
    terms: buildDocumentEntry("terms", terms)
  };

  return NextResponse.json({
    documents: snapshot,
    store: {
      name: bundle.store.name,
      slug: bundle.store.slug,
      supportEmail: bundle.settings?.support_email ?? null
    }
  });
}

export async function PUT(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, storeLegalDocumentsEditorSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const resolved = await resolveOwnerContext(request);
  if ("error" in resolved) {
    return resolved.error;
  }

  const { supabase, bundle, user } = resolved;
  const rows = [
    {
      store_id: bundle.store.id,
      key: "privacy" as const,
      source_mode: payload.data.privacy.source_mode,
      title_override: payload.data.privacy.title_override.trim() || null,
      body_markdown: payload.data.privacy.body_markdown.trim(),
      variables_json: payload.data.privacy.variables_json
    },
    {
      store_id: bundle.store.id,
      key: "terms" as const,
      source_mode: payload.data.terms.source_mode,
      title_override: payload.data.terms.title_override.trim() || null,
      body_markdown: payload.data.terms.body_markdown.trim(),
      variables_json: payload.data.terms.variables_json
    }
  ];

  const [{ error: documentsError }, { error: privacyError }] = await Promise.all([
    supabase.from("store_legal_documents").upsert(rows, { onConflict: "store_id,key" }),
    supabase.from("store_privacy_profiles").upsert(
      {
        store_id: bundle.store.id,
        ...payload.data.privacyCompliance
      },
      { onConflict: "store_id" }
    )
  ]);

  if (documentsError || privacyError) {
    return NextResponse.json({ error: documentsError?.message ?? privacyError?.message ?? "Unable to save legal settings." }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "update",
    entity: "store_legal_documents",
    entityId: bundle.store.id,
    metadata: {
      keys: rows.map((row) => row.key),
      privacySourceMode: payload.data.privacy.source_mode,
      termsSourceMode: payload.data.terms.source_mode,
      noticeAtCollectionEnabled: payload.data.privacyCompliance.notice_at_collection_enabled,
      californiaNoticeEnabled: payload.data.privacyCompliance.show_california_notice,
      doNotSellLinkEnabled: payload.data.privacyCompliance.show_do_not_sell_link
    }
  });

  return NextResponse.json({ documents: payload.data });
}

export async function PATCH(request: NextRequest) {
  const trustedOriginResponse = enforceTrustedOrigin(request);
  if (trustedOriginResponse) {
    return trustedOriginResponse;
  }

  const payload = await parseJsonRequest(request, publishStoreLegalDocumentSchema);
  if (!payload.ok) {
    return payload.response;
  }

  const resolved = await resolveOwnerContext(request);
  if ("error" in resolved) {
    return resolved.error;
  }

  const { supabase, bundle, user } = resolved;
  const [documents, privacyProfileResult] = await Promise.all([
    getStoreLegalDocumentsByStoreId(supabase, bundle.store.id),
    supabase.from("store_privacy_profiles").select("*").eq("store_id", bundle.store.id).maybeSingle<StorePrivacyProfileRecord>()
  ]);
  if (privacyProfileResult.error) {
    return NextResponse.json({ error: privacyProfileResult.error.message }, { status: 500 });
  }
  const target = documents.find((entry) => entry.key === payload.data.key);

  if (!target) {
    return NextResponse.json({ error: "Legal document not found." }, { status: 404 });
  }

  const draftSnapshot = getDraftStoreLegalDocumentSnapshot(target);
  const publishedSnapshot = getPublishedStoreLegalDocumentSnapshot(target);
  if (!draftSnapshot) {
    return NextResponse.json({ error: "Legal document draft is unavailable." }, { status: 409 });
  }

  if (publishedSnapshot && areStoreLegalDocumentSnapshotsEquivalent(draftSnapshot, publishedSnapshot)) {
    return NextResponse.json({ error: "Save a meaningful draft change before publishing." }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const effectiveAt = payload.data.effectiveAt ?? nowIso;
  const { error } = await supabase
    .from("store_legal_documents")
    .update({
      published_source_mode: target.source_mode,
      published_template_version: target.template_version,
      published_title: target.title_override?.trim() || getStoreLegalDocument(target.key).title,
      published_body_markdown: target.body_markdown.trim(),
      published_variables_json: target.variables_json,
      published_version: Math.max((target.published_version ?? 0) + 1, 1),
      published_change_summary: payload.data.changeSummary.trim(),
      effective_at: effectiveAt,
      published_at: nowIso,
      published_by_user_id: user.id
    })
    .eq("store_id", bundle.store.id)
    .eq("key", target.key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "publish",
    entity: "store_legal_documents",
    entityId: `${bundle.store.id}:${target.key}`,
    metadata: {
      key: target.key,
      publishedVersion: Math.max((target.published_version ?? 0) + 1, 1),
      effectiveAt,
      changeSummary: payload.data.changeSummary.trim()
    }
  });

  const refreshedDocuments = await getStoreLegalDocumentsByStoreId(supabase, bundle.store.id);
  const privacy = refreshedDocuments.find((entry) => entry.key === "privacy");
  const terms = refreshedDocuments.find((entry) => entry.key === "terms");

  return NextResponse.json({
    documents: {
      privacyCompliance: buildPrivacyComplianceEntry(privacyProfileResult.data, bundle.settings?.support_email ?? null),
      privacy: buildDocumentEntry("privacy", privacy),
      terms: buildDocumentEntry("terms", terms)
    }
  });
}
