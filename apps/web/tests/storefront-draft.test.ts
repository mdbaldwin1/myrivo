import { describe, expect, test } from "vitest";
import { createDefaultStoreExperienceContent } from "@/lib/store-experience/content";
import {
  applyStorefrontStudioDraftToRuntime,
  createStorefrontStudioDraftDocument,
  isStorefrontStudioDraftSectionDirty,
  listDirtyStorefrontStudioDraftSections,
  reconcileStorefrontStudioSavedValue,
  setStorefrontStudioDraftSection
} from "@/lib/storefront/draft";
import { createStorefrontRuntime } from "@/lib/storefront/runtime";

describe("storefront draft helpers", () => {
  test("tracks dirty sections independently", () => {
    const baseline = createStorefrontStudioDraftDocument(createDefaultStoreExperienceContent());
    const draft = setStorefrontStudioDraftSection(baseline, "home", {
      hero: {
        headline: "Updated headline"
      }
    });

    expect(isStorefrontStudioDraftSectionDirty(baseline, draft, "home")).toBe(true);
    expect(isStorefrontStudioDraftSectionDirty(baseline, draft, "productsPage")).toBe(false);
    expect(listDirtyStorefrontStudioDraftSections(baseline, draft)).toEqual(["home"]);
  });

  test("applies draft content over a runtime in studio mode", () => {
    const runtime = createStorefrontRuntime({
      store: { id: "store-1", name: "Olive Mercantile", slug: "olive-mercantile" },
      viewer: { isAuthenticated: true, canManageStore: true },
      branding: null,
      settings: null,
      experienceContent: createDefaultStoreExperienceContent(),
      contentBlocks: [],
      products: [],
      surface: "home"
    });

    const draft = createStorefrontStudioDraftDocument({
      ...createDefaultStoreExperienceContent(),
      home: {
        hero: {
          headline: "Draft headline"
        }
      }
    });

    const overlaid = applyStorefrontStudioDraftToRuntime(runtime, draft);

    expect(overlaid.mode).toBe("studio");
    expect(overlaid.experienceContent.home).toEqual({
      hero: {
        headline: "Draft headline"
      }
    });
  });

  test("keeps newer local edits when an older autosave resolves", () => {
    const sentDraft = { hero: { headline: "First draft" } };
    const currentDraft = { hero: { headline: "Second draft" } };
    const savedValue = { hero: { headline: "First draft" } };

    const resolved = reconcileStorefrontStudioSavedValue(currentDraft, sentDraft, savedValue);

    expect(resolved.nextBaseline).toEqual(savedValue);
    expect(resolved.nextDraft).toEqual(currentDraft);
  });

  test("accepts the saved value when the draft has not changed since save started", () => {
    const sentDraft = { hero: { headline: "First draft" } };
    const currentDraft = { hero: { headline: "First draft" } };
    const savedValue = { hero: { headline: "Normalized draft" } };

    const resolved = reconcileStorefrontStudioSavedValue(currentDraft, sentDraft, savedValue);

    expect(resolved.nextBaseline).toEqual(savedValue);
    expect(resolved.nextDraft).toEqual(savedValue);
  });
});
