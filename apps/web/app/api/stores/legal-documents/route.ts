import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import {
  areStoreLegalDocumentSnapshotsEquivalent,
  getDraftStoreLegalDocumentSnapshot,
  getPublishedStoreBaseLegalDocuments,
  getPublishedStoreLegalDocumentSnapshot,
  getStoreLegalDocumentByStoreId,
  getStoreLegalDocumentsByStoreId,
  getStoreLegalDocumentVersionsByStoreId,
  resolveStoreLegalDocument,
  type PublishedStoreBaseDocumentVersion,
  type StoreLegalDocumentVersionRow
} from "@/lib/legal/store-documents";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { enforceTrustedOrigin } from "@/lib/security/request-origin";
import { storeLegalDocumentsContentEditorSchema, type StoreLegalDocumentsContentEditorSnapshot } from "@/lib/store-editor/schemas";
import { getStoreLegalDocument, type StoreLegalDocumentKey } from "@/lib/storefront/store-legal-documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedStoreBundleForOptionalSlug } from "@/lib/stores/owner-store";

type StoreLegalDocumentVersionsPayload = Record<"privacy" | "terms", StoreLegalDocumentVersionRow[]>;

const publishStoreLegalDocumentSchema = z.object({
  key: z.enum(["privacy", "terms"]),
  changeSummary: z.string().trim().min(8).max(500),
  effectiveAt: z.string().datetime().nullable().optional()
});

function buildDocumentEntry(
  record: Awaited<ReturnType<typeof getStoreLegalDocumentsByStoreId>>[number] | undefined
): StoreLegalDocumentsContentEditorSnapshot["privacy"] {
  return {
    variables_json: Object.fromEntries(
      Object.entries(record?.variables_json ?? {}).flatMap(([entryKey, value]) => (typeof value === "string" ? [[entryKey, value]] : []))
    ),
    addendum_markdown: record?.addendum_markdown?.trim() || "",
    published_title: record?.published_title?.trim() || "",
    published_body_markdown: record?.published_body_markdown?.trim() || "",
    published_variables_json: Object.fromEntries(
      Object.entries(record?.published_variables_json ?? {}).flatMap(([entryKey, value]) =>
        typeof value === "string" ? [[entryKey, value]] : []
      )
    ),
    published_addendum_markdown: record?.published_addendum_markdown?.trim() || "",
    published_base_version_label: record?.published_base_version_label?.trim() || null,
    published_version: record?.published_version ?? 1,
    published_change_summary: record?.published_change_summary ?? null,
    effective_at: record?.effective_at ?? null,
    published_at: record?.published_at ?? null
  };
}

function buildBaseTemplatePayload(baseTemplate: PublishedStoreBaseDocumentVersion | null) {
  if (!baseTemplate) {
    return null;
  }

  return {
    versionId: baseTemplate.id,
    versionLabel: baseTemplate.versionLabel,
    title: baseTemplate.title,
    bodyMarkdown: baseTemplate.bodyMarkdown,
    publishedAt: baseTemplate.publishedAt,
    effectiveAt: baseTemplate.effectiveAt
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

function buildResolvedPublishedPreview(
  key: StoreLegalDocumentKey,
  store: { name: string; slug: string },
  settings: { support_email: string | null } | null,
  baseTemplate: PublishedStoreBaseDocumentVersion | null,
  entry: StoreLegalDocumentsContentEditorSnapshot["privacy"]
) {
  const definition = getStoreLegalDocument(key);
  return resolveStoreLegalDocument(key, store, settings, {
    baseDocumentTitle: entry.published_title || definition.title,
    baseBodyMarkdown: entry.published_body_markdown || baseTemplate?.bodyMarkdown || null,
    baseVersionLabel: entry.published_base_version_label || baseTemplate?.versionLabel || null,
    variables_json: entry.published_variables_json,
    addendum_markdown: entry.published_addendum_markdown,
    publishedVersion: entry.published_version,
    publishedAt: entry.published_at,
    effectiveAt: entry.effective_at,
    changeSummary: entry.published_change_summary
  });
}

export async function GET(request: NextRequest) {
  const resolved = await resolveOwnerContext(request);
  if ("error" in resolved) {
    return resolved.error;
  }

  const { supabase, bundle } = resolved;
  const [documents, versions, baseTemplates] = await Promise.all([
    getStoreLegalDocumentsByStoreId(supabase, bundle.store.id),
    getStoreLegalDocumentVersionsByStoreId(supabase, bundle.store.id),
    getPublishedStoreBaseLegalDocuments(supabase)
  ]);

  const privacy = documents.find((entry) => entry.key === "privacy");
  const terms = documents.find((entry) => entry.key === "terms");

  return NextResponse.json({
    documents: {
      privacy: buildDocumentEntry(privacy),
      terms: buildDocumentEntry(terms)
    } satisfies StoreLegalDocumentsContentEditorSnapshot,
    baseTemplates: {
      privacy: buildBaseTemplatePayload(baseTemplates.privacy),
      terms: buildBaseTemplatePayload(baseTemplates.terms)
    },
    versions: {
      privacy: versions.filter((entry) => entry.key === "privacy"),
      terms: versions.filter((entry) => entry.key === "terms")
    } satisfies StoreLegalDocumentVersionsPayload,
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

  const payload = await parseJsonRequest(request, storeLegalDocumentsContentEditorSchema);
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
      variables_json: payload.data.privacy.variables_json,
      addendum_markdown: payload.data.privacy.addendum_markdown.trim()
    },
    {
      store_id: bundle.store.id,
      key: "terms" as const,
      variables_json: payload.data.terms.variables_json,
      addendum_markdown: payload.data.terms.addendum_markdown.trim()
    }
  ];

  const { error: documentsError } = await supabase.from("store_legal_documents").upsert(rows, { onConflict: "store_id,key" });
  if (documentsError) {
    return NextResponse.json({ error: documentsError.message ?? "Unable to save legal settings." }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "update",
    entity: "store_legal_documents",
    entityId: bundle.store.id,
    metadata: {
      keys: rows.map((row) => row.key),
      updatedFields: ["variables_json", "addendum_markdown"]
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
  const [target, baseTemplates] = await Promise.all([
    getStoreLegalDocumentByStoreId(supabase, bundle.store.id, payload.data.key),
    getPublishedStoreBaseLegalDocuments(supabase)
  ]);

  if (!target) {
    return NextResponse.json({ error: "Legal document not found." }, { status: 404 });
  }

  const baseTemplate = payload.data.key === "privacy" ? baseTemplates.privacy : baseTemplates.terms;
  if (!baseTemplate) {
    return NextResponse.json({ error: "The admin-managed base template is not published yet." }, { status: 409 });
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
  const nextPublishedVersion = Math.max((target.published_version ?? 0) + 1, 1);
  const resolvedDocument = resolveStoreLegalDocument(payload.data.key, bundle.store, bundle.settings, {
    baseDocumentTitle: getStoreLegalDocument(payload.data.key).title,
    baseBodyMarkdown: baseTemplate.bodyMarkdown,
    baseVersionLabel: baseTemplate.versionLabel,
    variables_json: target.variables_json,
    addendum_markdown: target.addendum_markdown,
    publishedVersion: nextPublishedVersion,
    publishedAt: nowIso,
    effectiveAt,
    changeSummary: payload.data.changeSummary.trim()
  });

  const updatePayload = {
    published_title: resolvedDocument.title,
    published_body_markdown: resolvedDocument.bodyMarkdown,
    published_variables_json: target.variables_json,
    published_addendum_markdown: target.addendum_markdown,
    published_base_document_version_id: baseTemplate.id,
    published_base_version_label: baseTemplate.versionLabel,
    published_version: nextPublishedVersion,
    published_change_summary: payload.data.changeSummary.trim(),
    effective_at: effectiveAt,
    published_at: nowIso,
    published_by_user_id: user.id
  };

  const { error } = await supabase
    .from("store_legal_documents")
    .update(updatePayload)
    .eq("store_id", bundle.store.id)
    .eq("key", target.key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: versionInsertError } = await supabase.from("store_legal_document_versions").insert({
    store_legal_document_id: target.id,
    store_id: bundle.store.id,
    key: target.key,
    version_number: nextPublishedVersion,
    title: resolvedDocument.title,
    body_markdown: resolvedDocument.bodyMarkdown,
    variables_json: target.variables_json,
    addendum_markdown: target.addendum_markdown,
    base_document_version_id: baseTemplate.id,
    base_version_label: baseTemplate.versionLabel,
    change_summary: payload.data.changeSummary.trim(),
    effective_at: effectiveAt,
    published_at: nowIso,
    published_by_user_id: user.id
  });

  if (versionInsertError) {
    return NextResponse.json({ error: versionInsertError.message }, { status: 500 });
  }

  await logAuditEvent({
    storeId: bundle.store.id,
    actorUserId: user.id,
    action: "publish",
    entity: "store_legal_documents",
    entityId: `${bundle.store.id}:${target.key}`,
    metadata: {
      key: target.key,
      publishedVersion: nextPublishedVersion,
      effectiveAt,
      changeSummary: payload.data.changeSummary.trim(),
      baseVersionLabel: baseTemplate.versionLabel
    }
  });

  const [refreshedDocuments, versions] = await Promise.all([
    getStoreLegalDocumentsByStoreId(supabase, bundle.store.id),
    getStoreLegalDocumentVersionsByStoreId(supabase, bundle.store.id)
  ]);
  const privacy = refreshedDocuments.find((entry) => entry.key === "privacy");
  const terms = refreshedDocuments.find((entry) => entry.key === "terms");
  const privacyEntry = buildDocumentEntry(privacy);
  const termsEntry = buildDocumentEntry(terms);

  return NextResponse.json({
    documents: {
      privacy: privacyEntry,
      terms: termsEntry
    } satisfies StoreLegalDocumentsContentEditorSnapshot,
    baseTemplates: {
      privacy: buildBaseTemplatePayload(baseTemplates.privacy),
      terms: buildBaseTemplatePayload(baseTemplates.terms)
    },
    previews: {
      privacy: buildResolvedPublishedPreview("privacy", bundle.store, bundle.settings, baseTemplates.privacy, privacyEntry),
      terms: buildResolvedPublishedPreview("terms", bundle.store, bundle.settings, baseTemplates.terms, termsEntry)
    },
    versions: {
      privacy: versions.filter((entry) => entry.key === "privacy"),
      terms: versions.filter((entry) => entry.key === "terms")
    } satisfies StoreLegalDocumentVersionsPayload
  });
}
