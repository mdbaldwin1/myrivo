import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlatformLegalDocumentKey } from "@/lib/legal/document-keys";

export type MissingRequiredLegalVersion = {
  versionId: string;
  documentId: string;
  documentKey: string;
  documentTitle: string;
  versionLabel: string;
};

type RequiredVersionRow = {
  id: string;
  legal_document_id: string;
  version_label: string;
  legal_documents: { key: string; title: string } | null;
};

export type LegalAcceptanceSurface = "login_gate" | "signup";

export async function recordLegalAcceptances(
  supabase: SupabaseClient,
  input: {
    userId: string;
    versionIds: string[];
    acceptanceSurface: LegalAcceptanceSurface;
  }
) {
  const distinctIds = Array.from(new Set(input.versionIds));
  if (distinctIds.length === 0) {
    return { inserted: 0 };
  }

  const { data: requiredVersions, error: requiredError } = await supabase
    .from("legal_document_versions")
    .select("id,legal_document_id")
    .in("id", distinctIds)
    .eq("status", "published")
    .eq("is_required", true);

  if (requiredError) {
    throw new Error(requiredError.message);
  }

  const requiredById = new Map((requiredVersions ?? []).map((row) => [row.id, row]));
  const missingIds = distinctIds.filter((id) => !requiredById.has(id));
  if (missingIds.length > 0) {
    throw new Error("Some consent targets are invalid or not currently required.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("legal_acceptances")
    .select("legal_document_version_id")
    .eq("user_id", input.userId)
    .in("legal_document_version_id", distinctIds);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingIds = new Set((existing ?? []).map((row) => row.legal_document_version_id));
  const insertRows = distinctIds
    .filter((id) => !existingIds.has(id))
    .map((id) => {
      const version = requiredById.get(id);
      if (!version) {
        throw new Error(`Missing required version ${id}`);
      }

      return {
        legal_document_id: version.legal_document_id,
        legal_document_version_id: id,
        user_id: input.userId,
        acceptance_surface: input.acceptanceSurface
      };
    });

  if (insertRows.length > 0) {
    const { error: insertError } = await supabase.from("legal_acceptances").insert(insertRows);
    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  return { inserted: insertRows.length };
}

export async function getMissingRequiredLegalVersions(supabase: SupabaseClient, userId: string): Promise<MissingRequiredLegalVersion[]> {
  const { data: requiredVersions, error: requiredError } = await supabase
    .from("legal_document_versions")
    .select("id,legal_document_id,version_label,legal_documents!inner(key,title)")
    .eq("status", "published")
    .eq("is_required", true)
    .in("legal_documents.key", [getPlatformLegalDocumentKey("terms"), getPlatformLegalDocumentKey("privacy")])
    .returns<RequiredVersionRow[]>();

  if (requiredError) {
    throw new Error(requiredError.message);
  }

  const requiredIds = (requiredVersions ?? []).map((version) => version.id);
  if (requiredIds.length === 0) {
    return [];
  }

  const { data: accepted, error: acceptedError } = await supabase
    .from("legal_acceptances")
    .select("legal_document_version_id")
    .eq("user_id", userId)
    .in("legal_document_version_id", requiredIds)
    .returns<Array<{ legal_document_version_id: string }>>();

  if (acceptedError) {
    throw new Error(acceptedError.message);
  }

  const acceptedIds = new Set((accepted ?? []).map((row) => row.legal_document_version_id));
  return (requiredVersions ?? [])
    .filter((version) => !acceptedIds.has(version.id))
    .map((version) => ({
      versionId: version.id,
      documentId: version.legal_document_id,
      documentKey: version.legal_documents?.key === "platform_privacy" ? "privacy" : "terms",
      documentTitle: version.legal_documents?.title ?? "Legal document",
      versionLabel: version.version_label
    }));
}
