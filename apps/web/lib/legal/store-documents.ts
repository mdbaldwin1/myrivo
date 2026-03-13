import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoreLegalDocumentRecord, StoreRecord, StoreSettingsRecord } from "@/types/database";
import { getStoreLegalDocument, type StoreLegalDocumentKey } from "@/lib/storefront/store-legal-documents";

export type ResolvedStoreLegalDocument = {
  key: StoreLegalDocumentKey;
  title: string;
  bodyMarkdown: string;
  sourceMode: StoreLegalDocumentRecord["source_mode"];
  templateVersion: string;
  variables: Record<string, string>;
  publishedVersion: number | null;
  publishedAt: string | null;
  effectiveAt: string | null;
  changeSummary: string | null;
};

export type StoreLegalDocumentRow = Pick<
  StoreLegalDocumentRecord,
  | "id"
  | "store_id"
  | "key"
  | "source_mode"
  | "template_version"
  | "title_override"
  | "body_markdown"
  | "variables_json"
  | "published_source_mode"
  | "published_template_version"
  | "published_title"
  | "published_body_markdown"
  | "published_variables_json"
  | "published_version"
  | "published_change_summary"
  | "effective_at"
  | "published_at"
  | "published_by_user_id"
  | "created_at"
  | "updated_at"
>;

type StoreLegalDocumentSnapshot = Pick<
  StoreLegalDocumentRecord,
  "source_mode" | "template_version" | "title_override" | "body_markdown" | "variables_json"
> &
  Partial<Pick<StoreLegalDocumentRecord, "published_version" | "published_at" | "effective_at" | "published_change_summary">>;

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
    privacyAdditionalDetails: "",
    termsContactEmail: supportEmail,
    governingLawRegion: "the jurisdiction where the store operates",
    termsAdditionalDetails: ""
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

export function resolveStoreLegalDocument(
  key: StoreLegalDocumentKey,
  store: Pick<StoreRecord, "name" | "slug">,
  settings: Pick<StoreSettingsRecord, "support_email"> | null | undefined,
  record?: StoreLegalDocumentSnapshot | null
): ResolvedStoreLegalDocument {
  const baseDefinition = getStoreLegalDocument(key);
  const sourceMode = record?.source_mode ?? "template";
  const templateVersion = record?.template_version ?? "v1";
  const variables = buildStoreLegalDocumentVariables(store, settings, record?.variables_json ?? null);
  const templateBody = record?.body_markdown?.trim() || baseDefinition.defaultBodyMarkdown;

  return {
    key,
    title: record?.title_override?.trim() || baseDefinition.title,
    bodyMarkdown: interpolateStoreLegalTemplate(templateBody, variables),
    sourceMode,
    templateVersion,
    variables,
    publishedVersion: record?.published_version ?? null,
    publishedAt: record?.published_at ?? null,
    effectiveAt: record?.effective_at ?? null,
    changeSummary: record?.published_change_summary ?? null
  };
}

export function getDraftStoreLegalDocumentSnapshot(record: StoreLegalDocumentRow | null | undefined): StoreLegalDocumentSnapshot | null {
  if (!record) {
    return null;
  }

  return {
    source_mode: record.source_mode,
    template_version: record.template_version,
    title_override: record.title_override,
    body_markdown: record.body_markdown,
    variables_json: record.variables_json
  };
}

export function getPublishedStoreLegalDocumentSnapshot(record: StoreLegalDocumentRow | null | undefined): StoreLegalDocumentSnapshot | null {
  if (!record) {
    return null;
  }

  return {
    source_mode: record.published_source_mode,
    template_version: record.published_template_version,
    title_override: record.published_title,
    body_markdown: record.published_body_markdown,
    variables_json: record.published_variables_json,
    published_version: record.published_version,
    published_at: record.published_at,
    effective_at: record.effective_at,
    published_change_summary: record.published_change_summary
  };
}

export function areStoreLegalDocumentSnapshotsEquivalent(
  left: StoreLegalDocumentSnapshot | null | undefined,
  right: StoreLegalDocumentSnapshot | null | undefined
) {
  if (!left || !right) {
    return false;
  }

  return (
    left.source_mode === right.source_mode &&
    left.template_version === right.template_version &&
    (left.title_override ?? "") === (right.title_override ?? "") &&
    left.body_markdown === right.body_markdown &&
    JSON.stringify(left.variables_json ?? {}) === JSON.stringify(right.variables_json ?? {})
  );
}

export async function getStoreLegalDocumentsByStoreId(supabase: SupabaseClient, storeId: string) {
  const { data, error } = await supabase
    .from("store_legal_documents")
    .select("id,store_id,key,source_mode,template_version,title_override,body_markdown,variables_json,published_source_mode,published_template_version,published_title,published_body_markdown,published_variables_json,published_version,published_change_summary,effective_at,published_at,published_by_user_id,created_at,updated_at")
    .eq("store_id", storeId)
    .order("key", { ascending: true })
    .returns<StoreLegalDocumentRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getStoreLegalDocumentByStoreId(
  supabase: SupabaseClient,
  storeId: string,
  key: StoreLegalDocumentKey
) {
  const { data, error } = await supabase
    .from("store_legal_documents")
    .select("id,store_id,key,source_mode,template_version,title_override,body_markdown,variables_json,published_source_mode,published_template_version,published_title,published_body_markdown,published_variables_json,published_version,published_change_summary,effective_at,published_at,published_by_user_id,created_at,updated_at")
    .eq("store_id", storeId)
    .eq("key", key)
    .maybeSingle<StoreLegalDocumentRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
