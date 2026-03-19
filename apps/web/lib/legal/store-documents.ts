import type { SupabaseClient } from "@supabase/supabase-js";
import { getStoreBaseLegalDocumentKey } from "@/lib/legal/document-keys";
import { getStoreLegalDocument, type StoreLegalDocumentKey } from "@/lib/storefront/store-legal-documents";
import type { StoreLegalDocumentRecord, StoreLegalDocumentVersionRecord, StoreRecord, StoreSettingsRecord } from "@/types/database";

export type ResolvedStoreLegalDocument = {
  key: StoreLegalDocumentKey;
  title: string;
  bodyMarkdown: string;
  templateVersion: string;
  variables: Record<string, string>;
  publishedVersion: number | null;
  publishedAt: string | null;
  effectiveAt: string | null;
  changeSummary: string | null;
  baseVersionLabel: string | null;
};

export type StoreLegalDocumentRow = Pick<
  StoreLegalDocumentRecord,
  | "id"
  | "store_id"
  | "key"
  | "variables_json"
  | "addendum_markdown"
  | "published_title"
  | "published_body_markdown"
  | "published_variables_json"
  | "published_addendum_markdown"
  | "published_base_document_version_id"
  | "published_base_version_label"
  | "published_version"
  | "published_change_summary"
  | "effective_at"
  | "published_at"
  | "published_by_user_id"
  | "created_at"
  | "updated_at"
>;

export type StoreLegalDocumentVersionRow = Pick<
  StoreLegalDocumentVersionRecord,
  | "id"
  | "store_legal_document_id"
  | "store_id"
  | "key"
  | "version_number"
  | "title"
  | "body_markdown"
  | "variables_json"
  | "addendum_markdown"
  | "base_document_version_id"
  | "base_version_label"
  | "change_summary"
  | "effective_at"
  | "published_at"
  | "published_by_user_id"
  | "created_at"
>;

export type PublishedStoreBaseDocumentVersion = {
  id: string;
  key: StoreLegalDocumentKey;
  title: string;
  versionLabel: string;
  bodyMarkdown: string;
  publishedAt: string | null;
  effectiveAt: string | null;
};

export type StoreLegalDocumentDraftSnapshot = {
  variables_json: Record<string, unknown>;
  addendum_markdown: string | null;
};

export type StoreLegalDocumentPublishedSnapshot = StoreLegalDocumentDraftSnapshot & {
  published_version?: number | null;
  published_at?: string | null;
  effective_at?: string | null;
  published_change_summary?: string | null;
  published_body_markdown?: string | null;
  published_title?: string | null;
  published_base_version_label?: string | null;
};

function getDefaultSupportEmail(settings: Pick<StoreSettingsRecord, "support_email"> | null | undefined): string {
  return settings?.support_email?.trim() || "support@example.com";
}

export function buildStoreLegalDocumentVariables(
  store: Pick<StoreRecord, "name" | "slug">,
  settings: Pick<StoreSettingsRecord, "support_email"> | null | undefined,
  overrides?: Record<string, unknown> | null
): Record<string, string> {
  const supportEmail = getDefaultSupportEmail(settings);
  const baseVariables: Record<string, string> = {
    storeName: store.name,
    storeSlug: store.slug,
    supportEmail,
    privacyContactEmail: supportEmail,
    termsContactEmail: supportEmail,
    governingLawRegion: "the jurisdiction where the store operates"
  };

  if (!overrides) {
    return baseVariables;
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "string" && value.trim()) {
      baseVariables[key] = value.trim();
    }
  }

  return baseVariables;
}

export function interpolateStoreLegalTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, token) => variables[token] ?? "");
}

function appendAddendum(baseBodyMarkdown: string, addendumMarkdown?: string | null) {
  const addendum = addendumMarkdown?.trim() ?? "";
  if (!addendum) {
    return baseBodyMarkdown.trim();
  }
  return `${baseBodyMarkdown.trim()}\n\n${addendum}`;
}

export function resolveStoreLegalDocument(
  key: StoreLegalDocumentKey,
  store: Pick<StoreRecord, "name" | "slug">,
  settings: Pick<StoreSettingsRecord, "support_email"> | null | undefined,
  input: {
    baseDocumentTitle?: string | null;
    baseBodyMarkdown?: string | null;
    baseVersionLabel?: string | null;
    variables_json?: Record<string, unknown> | null;
    addendum_markdown?: string | null;
    publishedVersion?: number | null;
    publishedAt?: string | null;
    effectiveAt?: string | null;
    changeSummary?: string | null;
  }
): ResolvedStoreLegalDocument {
  const definition = getStoreLegalDocument(key);
  const variables = buildStoreLegalDocumentVariables(store, settings, input.variables_json ?? null);
  const resolvedBaseBody = interpolateStoreLegalTemplate(input.baseBodyMarkdown?.trim() || `# ${definition.title}`, variables);

  return {
    key,
    title: input.baseDocumentTitle?.trim() || definition.title,
    bodyMarkdown: appendAddendum(resolvedBaseBody, input.addendum_markdown),
    templateVersion: input.baseVersionLabel?.trim() || "unpublished",
    variables,
    publishedVersion: input.publishedVersion ?? null,
    publishedAt: input.publishedAt ?? null,
    effectiveAt: input.effectiveAt ?? null,
    changeSummary: input.changeSummary ?? null,
    baseVersionLabel: input.baseVersionLabel?.trim() || null
  };
}

export function getDraftStoreLegalDocumentSnapshot(record: StoreLegalDocumentRow | null | undefined): StoreLegalDocumentDraftSnapshot | null {
  if (!record) {
    return null;
  }

  return {
    variables_json: record.variables_json ?? {},
    addendum_markdown: record.addendum_markdown ?? ""
  };
}

export function getPublishedStoreLegalDocumentSnapshot(
  record: StoreLegalDocumentRow | null | undefined
): StoreLegalDocumentPublishedSnapshot | null {
  if (!record) {
    return null;
  }

  return {
    variables_json: record.published_variables_json ?? {},
    addendum_markdown: record.published_addendum_markdown ?? "",
    published_version: record.published_version ?? null,
    published_at: record.published_at ?? null,
    effective_at: record.effective_at ?? null,
    published_change_summary: record.published_change_summary ?? null,
    published_body_markdown: record.published_body_markdown ?? null,
    published_title: record.published_title ?? null,
    published_base_version_label: record.published_base_version_label ?? null
  };
}

export function areStoreLegalDocumentSnapshotsEquivalent(
  left: StoreLegalDocumentDraftSnapshot | null | undefined,
  right: StoreLegalDocumentPublishedSnapshot | null | undefined
) {
  if (!left || !right) {
    return false;
  }

  return (
    JSON.stringify(left.variables_json ?? {}) === JSON.stringify(right.variables_json ?? {}) &&
    (left.addendum_markdown ?? "").trim() === (right.addendum_markdown ?? "").trim()
  );
}

export async function getStoreLegalDocumentsByStoreId(supabase: SupabaseClient, storeId: string) {
  const { data, error } = await supabase
    .from("store_legal_documents")
    .select(
      "id,store_id,key,variables_json,addendum_markdown,published_title,published_body_markdown,published_variables_json,published_addendum_markdown,published_base_document_version_id,published_base_version_label,published_version,published_change_summary,effective_at,published_at,published_by_user_id,created_at,updated_at"
    )
    .eq("store_id", storeId)
    .order("key", { ascending: true })
    .returns<StoreLegalDocumentRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getStoreLegalDocumentByStoreId(supabase: SupabaseClient, storeId: string, key: StoreLegalDocumentKey) {
  const { data, error } = await supabase
    .from("store_legal_documents")
    .select(
      "id,store_id,key,variables_json,addendum_markdown,published_title,published_body_markdown,published_variables_json,published_addendum_markdown,published_base_document_version_id,published_base_version_label,published_version,published_change_summary,effective_at,published_at,published_by_user_id,created_at,updated_at"
    )
    .eq("store_id", storeId)
    .eq("key", key)
    .maybeSingle<StoreLegalDocumentRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getStoreLegalDocumentVersionsByStoreId(supabase: SupabaseClient, storeId: string) {
  const { data, error } = await supabase
    .from("store_legal_document_versions")
    .select(
      "id,store_legal_document_id,store_id,key,version_number,title,body_markdown,variables_json,addendum_markdown,base_document_version_id,base_version_label,change_summary,effective_at,published_at,published_by_user_id,created_at"
    )
    .eq("store_id", storeId)
    .order("published_at", { ascending: false })
    .returns<StoreLegalDocumentVersionRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

type PublishedStoreBaseVersionRow = {
  id: string;
  version_label: string;
  content_markdown: string;
  published_at: string | null;
  effective_at: string | null;
  legal_documents: { title: string; key: string } | null;
};

export async function getPublishedStoreBaseLegalDocument(
  supabase: SupabaseClient,
  key: StoreLegalDocumentKey
): Promise<PublishedStoreBaseDocumentVersion | null> {
  const { data, error } = await supabase
    .from("legal_document_versions")
    .select("id,version_label,content_markdown,published_at,effective_at,legal_documents!inner(title,key)")
    .eq("status", "published")
    .eq("legal_documents.key", getStoreBaseLegalDocumentKey(key))
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle<PublishedStoreBaseVersionRow>();

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.legal_documents) {
    return null;
  }

  return {
    id: data.id,
    key,
    title: data.legal_documents.title,
    versionLabel: data.version_label,
    bodyMarkdown: data.content_markdown,
    publishedAt: data.published_at,
    effectiveAt: data.effective_at
  };
}

export async function getPublishedStoreBaseLegalDocuments(supabase: SupabaseClient) {
  const [privacy, terms] = await Promise.all([
    getPublishedStoreBaseLegalDocument(supabase, "privacy"),
    getPublishedStoreBaseLegalDocument(supabase, "terms")
  ]);

  return { privacy, terms };
}

type SeedStoreLegalDocumentsInput = {
  store: Pick<StoreRecord, "id" | "name" | "slug">;
  settings: Pick<StoreSettingsRecord, "support_email"> | null | undefined;
  publishedByUserId?: string | null;
};

export async function seedStoreLegalDocumentsForStore(supabase: SupabaseClient, input: SeedStoreLegalDocumentsInput) {
  const baseTemplates = await getPublishedStoreBaseLegalDocuments(supabase);
  const nowIso = new Date().toISOString();

  const rows = (["privacy", "terms"] as const).flatMap((key) => {
    const baseTemplate = key === "privacy" ? baseTemplates.privacy : baseTemplates.terms;
    if (!baseTemplate) {
      return [];
    }

    const definition = getStoreLegalDocument(key);
    const variables = buildStoreLegalDocumentVariables(input.store, input.settings);
    const resolved = resolveStoreLegalDocument(key, input.store, input.settings, {
      baseDocumentTitle: definition.title,
      baseBodyMarkdown: baseTemplate.bodyMarkdown,
      baseVersionLabel: baseTemplate.versionLabel,
      variables_json: variables,
      addendum_markdown: "",
      publishedVersion: 1,
      publishedAt: nowIso,
      effectiveAt: nowIso,
      changeSummary: "Initial seeded storefront legal baseline"
    });

    return [
      {
        store_id: input.store.id,
        key,
        source_mode: "template",
        template_version: "v1",
        variables_json: variables,
        addendum_markdown: "",
        published_source_mode: "template",
        published_template_version: baseTemplate.versionLabel,
        published_title: definition.title,
        published_body_markdown: resolved.bodyMarkdown,
        published_variables_json: variables,
        published_addendum_markdown: "",
        published_base_document_version_id: baseTemplate.id,
        published_base_version_label: baseTemplate.versionLabel,
        published_version: 1,
        published_change_summary: "Initial seeded storefront legal baseline",
        effective_at: nowIso,
        published_at: nowIso,
        published_by_user_id: input.publishedByUserId ?? null
      }
    ];
  });

  if (!rows.length) {
    throw new Error("Published storefront legal base templates are not available.");
  }

  const { data: seededDocuments, error: upsertError } = await supabase
    .from("store_legal_documents")
    .upsert(rows, { onConflict: "store_id,key" })
    .select("id,store_id,key,published_title,published_body_markdown,published_variables_json,published_addendum_markdown,published_base_document_version_id,published_base_version_label,published_version,published_change_summary,effective_at,published_at,published_by_user_id")
    .returns<
      Array<{
        id: string;
        store_id: string;
        key: StoreLegalDocumentKey;
        published_title: string | null;
        published_body_markdown: string;
        published_variables_json: Record<string, unknown> | null;
        published_addendum_markdown: string | null;
        published_base_document_version_id: string | null;
        published_base_version_label: string | null;
        published_version: number | null;
        published_change_summary: string | null;
        effective_at: string | null;
        published_at: string | null;
        published_by_user_id: string | null;
      }>
    >();

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  if (!seededDocuments?.length) {
    throw new Error("Unable to seed storefront legal documents.");
  }

  const versionRows = seededDocuments.map((document) => ({
    store_legal_document_id: document.id,
    store_id: document.store_id,
    key: document.key,
    version_number: document.published_version ?? 1,
    source_mode: "template" as const,
    template_version: document.published_base_version_label ?? "v1",
    title: document.published_title ?? getStoreLegalDocument(document.key).title,
    body_markdown: document.published_body_markdown,
    variables_json: document.published_variables_json ?? {},
    addendum_markdown: document.published_addendum_markdown ?? "",
    base_document_version_id: document.published_base_document_version_id,
    base_version_label: document.published_base_version_label,
    change_summary: document.published_change_summary,
    effective_at: document.effective_at,
    published_at: document.published_at,
    published_by_user_id: document.published_by_user_id
  }));

  const { error: versionError } = await supabase.from("store_legal_document_versions").insert(versionRows);
  if (versionError) {
    throw new Error(versionError.message);
  }
}
