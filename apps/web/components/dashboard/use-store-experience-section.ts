"use client";

import { usePathname } from "next/navigation";
import { useCallback } from "react";
import { notify } from "@/lib/feedback/toast";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { useStoreEditorDocument } from "@/components/dashboard/use-store-editor-document";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";
import type { StoreExperienceContentSection } from "@/lib/store-experience/content";
import { getEditorValueAtPath, setEditorValueAtPath } from "@/lib/store-editor/object-path";

type ContentPayload = {
  content?: Record<string, Record<string, unknown>>;
  error?: string;
};

export function useStoreExperienceSection(section: StoreExperienceContentSection) {
  const studioDocument = useOptionalStorefrontStudioDocument();
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const shouldUseStudioDocument = Boolean(studioDocument && studioDocument.storeSlug === storeSlug);

  const loadDocument = useCallback(async () => {
    const response = await fetch(buildStoreScopedApiPath("/api/store-experience/content", storeSlug), { cache: "no-store" });
    const payload = (await response.json()) as ContentPayload;

    if (!response.ok || !payload.content) {
      throw new Error(payload.error ?? "Unable to load section.");
    }

    const sectionValue = payload.content[section];
    return sectionValue && typeof sectionValue === "object" && !Array.isArray(sectionValue)
      ? (sectionValue as Record<string, unknown>)
      : {};
  }, [section, storeSlug]);

  const saveDocument = useCallback(
    async (draft: Record<string, unknown>) => {
      const response = await fetch(buildStoreScopedApiPath("/api/store-experience/content", storeSlug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, value: draft })
      });

      const payload = (await response.json()) as ContentPayload;

      if (!response.ok || !payload.content) {
        throw new Error(payload.error ?? "Unable to save section.");
      }

      const sectionValue = payload.content[section];
      return sectionValue && typeof sectionValue === "object" && !Array.isArray(sectionValue)
        ? (sectionValue as Record<string, unknown>)
        : {};
    },
    [section, storeSlug]
  );

  const editor = useStoreEditorDocument<Record<string, unknown>>({
    emptyDraft: {},
    loadDocument,
    saveDocument,
    successMessage: "Section saved."
  });

  if (shouldUseStudioDocument && studioDocument) {
    return {
      loading: studioDocument.loading,
      saving: studioDocument.isSectionSaving(section),
      draft: studioDocument.getSectionDraft(section),
      setDraft: (value: Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>)) =>
        studioDocument.setSectionDraft(section, value),
      error: studioDocument.error,
      isDirty: studioDocument.isSectionDirty(section),
      save: async () => {
        const ok = await studioDocument.saveSection(section);
        if (ok) {
          notify.success("Section saved.");
        }
        return ok;
      },
      discard: () => studioDocument.discardSection(section),
      discardChanges: () => studioDocument.discardSection(section),
      message: null
    };
  }

  return {
    ...editor,
    message: null,
    discard: editor.discardChanges
  };
}

export const getAtPath = getEditorValueAtPath;
export const setAtPath = setEditorValueAtPath;
