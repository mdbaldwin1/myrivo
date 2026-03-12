import {
  createDefaultStoreExperienceContent,
  type StoreExperienceContent,
  type StoreExperienceContentSection
} from "@/lib/store-experience/content";
import type { StorefrontBranding, StorefrontRuntime, StorefrontSettings, StorefrontStore } from "@/lib/storefront/runtime";
import { areEditorValuesEqual, cloneEditorValue } from "@/lib/store-editor/object-path";

export type StorefrontStudioDraftDocument = {
  content: StoreExperienceContent;
  store: StorefrontStore;
  branding: StorefrontBranding;
  settings: StorefrontSettings;
};

export function createEmptyStorefrontStudioDraftDocument(): StorefrontStudioDraftDocument {
  return {
    content: createDefaultStoreExperienceContent(),
    store: {
      id: "",
      name: "",
      slug: ""
    },
    branding: null,
    settings: null
  };
}

export function createStorefrontStudioDraftDocument(
  content?: StoreExperienceContent | null,
  options?: {
    store?: StorefrontStore;
    branding?: StorefrontBranding;
    settings?: StorefrontSettings;
  }
): StorefrontStudioDraftDocument {
  return {
    content: cloneEditorValue(content ?? createDefaultStoreExperienceContent()),
    store: cloneEditorValue(options?.store ?? createEmptyStorefrontStudioDraftDocument().store),
    branding: cloneEditorValue(options?.branding ?? null),
    settings: cloneEditorValue(options?.settings ?? null)
  };
}

export function getStorefrontStudioDraftSection(
  document: StorefrontStudioDraftDocument,
  section: StoreExperienceContentSection
): Record<string, unknown> {
  return cloneEditorValue(document.content[section] ?? {});
}

export function setStorefrontStudioDraftSection(
  document: StorefrontStudioDraftDocument,
  section: StoreExperienceContentSection,
  value: Record<string, unknown>
): StorefrontStudioDraftDocument {
  return {
    ...document,
    content: {
      ...document.content,
      [section]: cloneEditorValue(value)
    }
  };
}

export function isStorefrontStudioDraftSectionDirty(
  baseline: StorefrontStudioDraftDocument,
  draft: StorefrontStudioDraftDocument,
  section: StoreExperienceContentSection
) {
  return !areEditorValuesEqual(baseline.content[section] ?? {}, draft.content[section] ?? {});
}

export function listDirtyStorefrontStudioDraftSections(
  baseline: StorefrontStudioDraftDocument,
  draft: StorefrontStudioDraftDocument
) {
  return (Object.keys(draft.content) as StoreExperienceContentSection[]).filter((section) =>
    isStorefrontStudioDraftSectionDirty(baseline, draft, section)
  );
}

export function isStorefrontStudioStoreDirty(baseline: StorefrontStudioDraftDocument, draft: StorefrontStudioDraftDocument) {
  return !areEditorValuesEqual(baseline.store, draft.store);
}

export function isStorefrontStudioBrandingDirty(baseline: StorefrontStudioDraftDocument, draft: StorefrontStudioDraftDocument) {
  return !areEditorValuesEqual(baseline.branding, draft.branding);
}

export function isStorefrontStudioSettingsDirty(baseline: StorefrontStudioDraftDocument, draft: StorefrontStudioDraftDocument) {
  return !areEditorValuesEqual(baseline.settings, draft.settings);
}

export function applyStorefrontStudioDraftToRuntime(
  runtime: StorefrontRuntime,
  draft: StorefrontStudioDraftDocument
): StorefrontRuntime {
  return {
    ...runtime,
    mode: "studio",
    store: cloneEditorValue(draft.store),
    branding: cloneEditorValue(draft.branding),
    settings: cloneEditorValue(draft.settings),
    experienceContent: cloneEditorValue(draft.content)
  };
}

export function reconcileStorefrontStudioSavedValue<T>(currentDraft: T, sentDraft: T, savedValue: T) {
  const nextBaseline = cloneEditorValue(savedValue);
  return {
    nextBaseline,
    nextDraft: areEditorValuesEqual(currentDraft, sentDraft) ? cloneEditorValue(savedValue) : cloneEditorValue(currentDraft)
  };
}
