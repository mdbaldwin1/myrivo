import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlatformLegalDocumentKey } from "@/lib/legal/document-keys";
import { resolveLatestRequiredPlatformLegalVersions } from "@/lib/legal/required-versions";

export type LegalRequirement = {
  documentId: string;
  versionId: string;
  key: "terms" | "privacy";
  title: string;
};

type LegalVersionRow = {
  id: string;
  legal_document_id: string;
  published_at: string | null;
  legal_documents: { key: string; title: string } | null;
};

export async function getSignupLegalRequirements(supabase: SupabaseClient): Promise<{
  terms: LegalRequirement | null;
  privacy: LegalRequirement | null;
}> {
  const { data, error } = await supabase
    .from("legal_document_versions")
    .select("id,legal_document_id,published_at,legal_documents!inner(key,title)")
    .eq("status", "published")
    .eq("is_required", true)
    .in("legal_documents.key", [getPlatformLegalDocumentKey("terms"), getPlatformLegalDocumentKey("privacy")])
    .returns<LegalVersionRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const latestByKey = resolveLatestRequiredPlatformLegalVersions(data ?? []);

  const resolved = {
    terms: latestByKey.platform_terms
      ? {
          documentId: latestByKey.platform_terms.legal_document_id,
          versionId: latestByKey.platform_terms.id,
          key: "terms" as const,
          title: latestByKey.platform_terms.legal_documents?.title ?? "terms"
        }
      : null,
    privacy: latestByKey.platform_privacy
      ? {
          documentId: latestByKey.platform_privacy.legal_document_id,
          versionId: latestByKey.platform_privacy.id,
          key: "privacy" as const,
          title: latestByKey.platform_privacy.legal_documents?.title ?? "privacy"
        }
      : null
  };

  return resolved;
}

type LegalContentRow = {
  id?: string;
  content_markdown: string;
  version_label: string;
  published_at: string | null;
  effective_at?: string | null;
  is_required?: boolean;
  legal_documents: { title: string; key: string } | null;
};

export async function getPublishedLegalDocumentByKey(supabase: SupabaseClient, key: "terms" | "privacy") {
  const { data, error } = await supabase
    .from("legal_document_versions")
    .select("content_markdown,version_label,published_at,legal_documents!inner(title,key)")
    .eq("status", "published")
    .eq("legal_documents.key", getPlatformLegalDocumentKey(key))
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle<LegalContentRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getLegalDocumentVersionById(supabase: SupabaseClient, versionId: string) {
  const { data, error } = await supabase
    .from("legal_document_versions")
    .select("id,content_markdown,version_label,published_at,effective_at,is_required,legal_documents!inner(title,key)")
    .eq("id", versionId)
    .maybeSingle<LegalContentRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
