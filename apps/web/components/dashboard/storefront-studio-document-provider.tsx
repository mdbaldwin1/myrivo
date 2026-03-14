"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildStoreScopedApiPath } from "@/lib/routes/store-workspace";
import {
  createDefaultStoreExperienceContent,
  type StoreExperienceContent,
  type StoreExperienceContentSection
} from "@/lib/store-experience/content";
import {
  createStorefrontStudioDraftDocument,
  getStorefrontStudioDraftSection,
  isStorefrontStudioBrandingDirty,
  isStorefrontStudioDraftSectionDirty,
  isStorefrontStudioSettingsDirty,
  isStorefrontStudioStoreDirty,
  listDirtyStorefrontStudioDraftSections,
  reconcileStorefrontStudioSavedValue,
  setStorefrontStudioDraftSection,
  type StorefrontStudioDraftDocument
} from "@/lib/storefront/draft";
import type { StorefrontStudioSelection } from "@/lib/storefront/studio-structure";
import { cloneEditorValue } from "@/lib/store-editor/object-path";
import type { StorefrontBranding, StorefrontData, StorefrontSettings, StorefrontStore } from "@/lib/storefront/runtime";

type ContentPayload = {
  content?: StoreExperienceContent;
  error?: string;
};

type StorefrontStudioDocumentContextValue = {
  storeSlug: string;
  loading: boolean;
  error: string | null;
  baseline: StorefrontStudioDraftDocument;
  draft: StorefrontStudioDraftDocument;
  getSectionDraft: (section: StoreExperienceContentSection) => Record<string, unknown>;
  setSectionDraft: (
    section: StoreExperienceContentSection,
    value: Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>)
  ) => void;
  discardSection: (section: StoreExperienceContentSection) => void;
  isSectionDirty: (section: StoreExperienceContentSection) => boolean;
  dirtySections: StoreExperienceContentSection[];
  storeDraft: StorefrontStore;
  setStoreDraft: (value: StorefrontStore | ((current: StorefrontStore) => StorefrontStore)) => void;
  commitStoreDraft: (value: StorefrontStore) => void;
  isStoreDirty: boolean;
  isStoreSaving: boolean;
  brandingDraft: StorefrontBranding;
  setBrandingDraft: (value: StorefrontBranding | ((current: StorefrontBranding) => StorefrontBranding)) => void;
  commitBrandingDraft: (value: StorefrontBranding) => void;
  isBrandingDirty: boolean;
  isBrandingSaving: boolean;
  settingsDraft: StorefrontSettings;
  setSettingsDraft: (value: StorefrontSettings | ((current: StorefrontSettings) => StorefrontSettings)) => void;
  commitSettingsDraft: (value: StorefrontSettings) => void;
  commitSettingsPatch: (value: Partial<NonNullable<StorefrontSettings>>) => void;
  isSettingsDirty: boolean;
  isSettingsSaving: boolean;
  isSectionSaving: (section: StoreExperienceContentSection) => boolean;
  saveSection: (section: StoreExperienceContentSection) => Promise<boolean>;
  saveDirtySections: () => Promise<boolean>;
  selection: StorefrontStudioSelection;
  setSelection: (selection: StorefrontStudioSelection) => void;
  clearSelection: () => void;
};

const StorefrontStudioDocumentContext = createContext<StorefrontStudioDocumentContextValue | null>(null);

const EMPTY_DOCUMENT = createStorefrontStudioDraftDocument(createDefaultStoreExperienceContent());

function isValidHexColor(value: unknown) {
  return typeof value === "string" && /^#([0-9a-fA-F]{6})$/.test(value);
}

function canAutosaveStoreDraft(store: StorefrontStore) {
  return store.name.trim().length >= 2;
}

function canAutosaveBrandingDraft(branding: StorefrontBranding) {
  const theme = (branding?.theme_json ?? {}) as Record<string, unknown>;
  const colorValues = [
    branding?.primary_color,
    branding?.accent_color,
    theme.primaryForegroundColor,
    theme.accentForegroundColor,
    theme.backgroundColor,
    theme.surfaceColor,
    theme.textColor,
    theme.headerBackgroundColor,
    theme.headerForegroundColor
  ].filter((value) => value !== null && value !== undefined && value !== "");

  return colorValues.every((value) => isValidHexColor(value));
}

type StorefrontStudioDocumentProviderProps = {
  storeSlug: string;
  initialStorefrontData?: StorefrontData | null;
  children: ReactNode;
};

export function StorefrontStudioDocumentProvider({
  storeSlug,
  initialStorefrontData,
  children
}: StorefrontStudioDocumentProviderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<StorefrontStudioDraftDocument>(EMPTY_DOCUMENT);
  const [draft, setDraft] = useState<StorefrontStudioDraftDocument>(EMPTY_DOCUMENT);
  const [selection, setSelection] = useState<StorefrontStudioSelection>(null);
  const [savingStore, setSavingStore] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingSections, setSavingSections] = useState<Record<StoreExperienceContentSection, boolean>>({
    home: false,
    productsPage: false,
    aboutPage: false,
    policiesPage: false,
    cartPage: false,
    orderSummaryPage: false,
    emails: false
  });
  const savingStoreRef = useRef(false);
  const savingBrandingRef = useRef(false);
  const savingSettingsRef = useRef(false);
  const savingSectionsRef = useRef<Record<StoreExperienceContentSection, boolean>>({
    home: false,
    productsPage: false,
    aboutPage: false,
    policiesPage: false,
    cartPage: false,
    orderSummaryPage: false,
    emails: false
  });
  const sectionSaveRequestIdsRef = useRef<Record<StoreExperienceContentSection, number>>({
    home: 0,
    productsPage: 0,
    aboutPage: 0,
    policiesPage: 0,
    cartPage: 0,
    orderSummaryPage: 0,
    emails: 0
  });
  const storeSaveRequestIdRef = useRef(0);
  const brandingSaveRequestIdRef = useRef(0);
  const settingsSaveRequestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(buildStoreScopedApiPath("/api/store-experience/content", storeSlug), { cache: "no-store" });
        const payload = (await response.json()) as ContentPayload;

        if (!response.ok || !payload.content) {
          throw new Error(payload.error ?? "Unable to load storefront studio document.");
        }

        if (cancelled) {
          return;
        }

        const next = createStorefrontStudioDraftDocument(payload.content, {
          store: initialStorefrontData?.store,
          branding: initialStorefrontData?.branding,
          settings: initialStorefrontData?.settings
        });
        setBaseline(next);
        setDraft(cloneEditorValue(next));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load storefront studio document.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialStorefrontData, storeSlug]);

  const getSectionDraft = useCallback(
    (section: StoreExperienceContentSection) => getStorefrontStudioDraftSection(draft, section),
    [draft]
  );

  const setSectionDraft = useCallback(
    (
      section: StoreExperienceContentSection,
      value: Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>)
    ) => {
      setDraft((current) => {
        const currentSection = getStorefrontStudioDraftSection(current, section);
        const nextSection = typeof value === "function" ? value(currentSection) : value;
        return setStorefrontStudioDraftSection(current, section, nextSection);
      });
      setError(null);
    },
    []
  );

  const discardSection = useCallback(
    (section: StoreExperienceContentSection) => {
      setDraft((current) => setStorefrontStudioDraftSection(current, section, getStorefrontStudioDraftSection(baseline, section)));
      setError(null);
    },
    [baseline]
  );

  const isSectionDirty = useCallback(
    (section: StoreExperienceContentSection) => isStorefrontStudioDraftSectionDirty(baseline, draft, section),
    [baseline, draft]
  );
  const dirtySections = useMemo(() => listDirtyStorefrontStudioDraftSections(baseline, draft), [baseline, draft]);
  const isStoreDirty = useMemo(() => isStorefrontStudioStoreDirty(baseline, draft), [baseline, draft]);
  const isBrandingDirty = useMemo(() => isStorefrontStudioBrandingDirty(baseline, draft), [baseline, draft]);
  const isSettingsDirty = useMemo(() => isStorefrontStudioSettingsDirty(baseline, draft), [baseline, draft]);
  const canAutosaveStore = useMemo(() => canAutosaveStoreDraft(draft.store), [draft.store]);
  const canAutosaveBranding = useMemo(() => canAutosaveBrandingDraft(draft.branding), [draft.branding]);

  const setStoreDraft = useCallback((value: StorefrontStore | ((current: StorefrontStore) => StorefrontStore)) => {
    setDraft((current) => ({
      ...current,
      store: cloneEditorValue(typeof value === "function" ? value(current.store) : value)
    }));
    setError(null);
  }, []);

  const commitStoreDraft = useCallback((value: StorefrontStore) => {
    const next = cloneEditorValue(value);
    setBaseline((current) => ({ ...current, store: next }));
    setDraft((current) => ({ ...current, store: next }));
    setError(null);
  }, []);

  const setBrandingDraft = useCallback((value: StorefrontBranding | ((current: StorefrontBranding) => StorefrontBranding)) => {
    setDraft((current) => ({
      ...current,
      branding: cloneEditorValue(typeof value === "function" ? value(current.branding) : value)
    }));
    setError(null);
  }, []);

  const commitBrandingDraft = useCallback((value: StorefrontBranding) => {
    const next = cloneEditorValue(value);
    setBaseline((current) => ({ ...current, branding: next }));
    setDraft((current) => ({ ...current, branding: next }));
    setError(null);
  }, []);

  const setSettingsDraft = useCallback((value: StorefrontSettings | ((current: StorefrontSettings) => StorefrontSettings)) => {
    setDraft((current) => ({
      ...current,
      settings: cloneEditorValue(typeof value === "function" ? value(current.settings) : value)
    }));
    setError(null);
  }, []);

  const commitSettingsDraft = useCallback((value: StorefrontSettings) => {
    const next = cloneEditorValue(value);
    setBaseline((current) => ({ ...current, settings: next }));
    setDraft((current) => ({ ...current, settings: next }));
    setError(null);
  }, []);

  const commitSettingsPatch = useCallback((value: Partial<NonNullable<StorefrontSettings>>) => {
    const patch = cloneEditorValue(value);
    setBaseline((current) => ({
      ...current,
      settings: cloneEditorValue({
        ...(current.settings ?? {}),
        ...patch
      }) as NonNullable<StorefrontSettings>
    }));
    setDraft((current) => ({
      ...current,
      settings: cloneEditorValue({
        ...(current.settings ?? {}),
        ...patch
      }) as NonNullable<StorefrontSettings>
    }));
    setError(null);
  }, []);

  const isSectionSaving = useCallback((section: StoreExperienceContentSection) => Boolean(savingSections[section]), [savingSections]);

  const saveSection = useCallback(
    async (section: StoreExperienceContentSection) => {
      if (savingSectionsRef.current[section]) {
        return true;
      }

      const sectionDraft = getStorefrontStudioDraftSection(draft, section);
      const requestId = sectionSaveRequestIdsRef.current[section] + 1;
      sectionSaveRequestIdsRef.current[section] = requestId;
      savingSectionsRef.current[section] = true;

      setSavingSections((current) => ({ ...current, [section]: true }));
      setError(null);

      try {
        const response = await fetch(buildStoreScopedApiPath("/api/store-experience/content", storeSlug), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section, value: sectionDraft })
        });

        const payload = (await response.json()) as ContentPayload;
        if (!response.ok || !payload.content) {
          throw new Error(payload.error ?? "Unable to save storefront studio section.");
        }

        const savedSection = cloneEditorValue(payload.content[section] ?? {});
        if (sectionSaveRequestIdsRef.current[section] !== requestId) {
          return true;
        }

        setBaseline((current) => setStorefrontStudioDraftSection(current, section, savedSection));
        setDraft((current) => {
          const currentSection = getStorefrontStudioDraftSection(current, section);
          const resolved = reconcileStorefrontStudioSavedValue(currentSection, sectionDraft, savedSection);
          return setStorefrontStudioDraftSection(current, section, resolved.nextDraft);
        });
        return true;
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save storefront studio section.");
        return false;
      } finally {
        savingSectionsRef.current[section] = false;
        setSavingSections((current) => ({ ...current, [section]: false }));
      }
    },
    [draft, storeSlug]
  );

  const saveDirtySections = useCallback(async () => {
    const sections = listDirtyStorefrontStudioDraftSections(baseline, draft);
    if (sections.length === 0) {
      return true;
    }

    for (const section of sections) {
      const ok = await saveSection(section);
      if (!ok) {
        return false;
      }
    }

    return true;
  }, [baseline, draft, saveSection]);

  const saveStoreDraft = useCallback(async () => {
    if (!isStorefrontStudioStoreDirty(baseline, draft) || savingStoreRef.current || !canAutosaveStoreDraft(draft.store)) {
      return true;
    }

    const storeDraftSnapshot = cloneEditorValue(draft.store);
    const requestId = storeSaveRequestIdRef.current + 1;
    storeSaveRequestIdRef.current = requestId;
    savingStoreRef.current = true;
    setSavingStore(true);
    setError(null);

    try {
      const response = await fetch(buildStoreScopedApiPath("/api/stores/current", storeSlug), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: storeDraftSnapshot.name })
      });
      const payload = (await response.json()) as { store?: StorefrontStore; error?: string };

      if (!response.ok || !payload.store) {
        throw new Error(payload.error ?? "Unable to save store identity.");
      }

      const nextStore = cloneEditorValue({
        ...storeDraftSnapshot,
        ...payload.store
      });
      if (storeSaveRequestIdRef.current !== requestId) {
        return true;
      }

      setBaseline((current) => ({ ...current, store: nextStore }));
      setDraft((current) => {
        const resolved = reconcileStorefrontStudioSavedValue(current.store, storeDraftSnapshot, nextStore);
        return { ...current, store: resolved.nextDraft };
      });
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save store identity.");
      return false;
    } finally {
      savingStoreRef.current = false;
      setSavingStore(false);
    }
  }, [baseline, draft, storeSlug]);

  const saveBrandingDraft = useCallback(async () => {
    if (!isStorefrontStudioBrandingDirty(baseline, draft) || savingBrandingRef.current || !canAutosaveBrandingDraft(draft.branding)) {
      return true;
    }

    const brandingDraftSnapshot = cloneEditorValue(draft.branding);
    const requestId = brandingSaveRequestIdRef.current + 1;
    brandingSaveRequestIdRef.current = requestId;
    savingBrandingRef.current = true;
    setSavingBranding(true);
    setError(null);

    try {
      const response = await fetch(buildStoreScopedApiPath("/api/stores/branding", storeSlug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoPath: brandingDraftSnapshot?.logo_path ?? null,
          faviconPath: brandingDraftSnapshot?.favicon_path ?? null,
          appleTouchIconPath: brandingDraftSnapshot?.apple_touch_icon_path ?? null,
          ogImagePath: brandingDraftSnapshot?.og_image_path ?? null,
          twitterImagePath: brandingDraftSnapshot?.twitter_image_path ?? null,
          primaryColor: brandingDraftSnapshot?.primary_color ?? null,
          accentColor: brandingDraftSnapshot?.accent_color ?? null,
          themeJson: brandingDraftSnapshot?.theme_json ?? {}
        })
      });
      const payload = (await response.json()) as { branding?: StorefrontBranding; error?: string };

      if (!response.ok || !payload.branding) {
        throw new Error(payload.error ?? "Unable to save branding settings.");
      }

      const nextBranding = cloneEditorValue(payload.branding);
      if (brandingSaveRequestIdRef.current !== requestId) {
        return true;
      }

      setBaseline((current) => ({ ...current, branding: nextBranding }));
      setDraft((current) => {
        const resolved = reconcileStorefrontStudioSavedValue(current.branding, brandingDraftSnapshot, nextBranding);
        return { ...current, branding: resolved.nextDraft };
      });
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save branding settings.");
      return false;
    } finally {
      savingBrandingRef.current = false;
      setSavingBranding(false);
    }
  }, [baseline, draft, storeSlug]);

  const saveSettingsDraft = useCallback(async () => {
    if (!isStorefrontStudioSettingsDirty(baseline, draft) || savingSettingsRef.current) {
      return true;
    }

    const settingsDraftSnapshot = cloneEditorValue(draft.settings);
    const requestId = settingsSaveRequestIdRef.current + 1;
    settingsSaveRequestIdRef.current = requestId;
    savingSettingsRef.current = true;
    setSavingSettings(true);
    setError(null);

    try {
      const response = await fetch(buildStoreScopedApiPath("/api/store-experience/settings", storeSlug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutRules: {
            fulfillmentMessage: settingsDraftSnapshot?.fulfillment_message ?? null,
            checkoutEnableLocalPickup: settingsDraftSnapshot?.checkout_enable_local_pickup ?? false,
            checkoutLocalPickupLabel: settingsDraftSnapshot?.checkout_local_pickup_label ?? null,
            checkoutLocalPickupFeeCents: settingsDraftSnapshot?.checkout_local_pickup_fee_cents ?? 0,
            checkoutEnableFlatRateShipping: settingsDraftSnapshot?.checkout_enable_flat_rate_shipping ?? true,
            checkoutFlatRateShippingLabel: settingsDraftSnapshot?.checkout_flat_rate_shipping_label ?? null,
            checkoutFlatRateShippingFeeCents: settingsDraftSnapshot?.checkout_flat_rate_shipping_fee_cents ?? 0,
            checkoutAllowOrderNote: settingsDraftSnapshot?.checkout_allow_order_note ?? false,
            checkoutOrderNotePrompt: settingsDraftSnapshot?.checkout_order_note_prompt ?? null
          },
          newsletterCapture: {
            enabled: settingsDraftSnapshot?.email_capture_enabled ?? false,
            heading: settingsDraftSnapshot?.email_capture_heading ?? null,
            description: settingsDraftSnapshot?.email_capture_description ?? null,
            successMessage: settingsDraftSnapshot?.email_capture_success_message ?? null
          }
        })
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save storefront settings.");
      }

      const nextSettings = cloneEditorValue(settingsDraftSnapshot);
      if (settingsSaveRequestIdRef.current !== requestId) {
        return true;
      }

      setBaseline((current) => ({ ...current, settings: nextSettings }));
      setDraft((current) => {
        const resolved = reconcileStorefrontStudioSavedValue(current.settings, settingsDraftSnapshot, nextSettings);
        return { ...current, settings: resolved.nextDraft };
      });
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save storefront settings.");
      return false;
    } finally {
      savingSettingsRef.current = false;
      setSavingSettings(false);
    }
  }, [baseline, draft, storeSlug]);

  useEffect(() => {
    if (loading || dirtySections.length === 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void saveDirtySections();
    }, 800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [dirtySections, loading, saveDirtySections]);

  useEffect(() => {
    const shouldAutosaveStore = isStoreDirty && canAutosaveStore;
    const shouldAutosaveBranding = isBrandingDirty && canAutosaveBranding;
    const shouldAutosaveSettings = isSettingsDirty;

    if (loading || (!shouldAutosaveStore && !shouldAutosaveBranding && !shouldAutosaveSettings)) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void (async () => {
        const okStore = await saveStoreDraft();
        if (!okStore) {
          return;
        }

        const okBranding = await saveBrandingDraft();
        if (!okBranding) {
          return;
        }

        await saveSettingsDraft();
      })();
    }, 800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [canAutosaveBranding, canAutosaveStore, isBrandingDirty, isSettingsDirty, isStoreDirty, loading, saveBrandingDraft, saveSettingsDraft, saveStoreDraft]);

  const value = useMemo<StorefrontStudioDocumentContextValue>(
    () => ({
      storeSlug,
      loading,
      error,
      baseline,
      draft,
      getSectionDraft,
      setSectionDraft,
      discardSection,
      isSectionDirty,
      dirtySections,
      storeDraft: draft.store,
      setStoreDraft,
      commitStoreDraft,
      isStoreDirty,
      isStoreSaving: savingStore,
      brandingDraft: draft.branding,
      setBrandingDraft,
      commitBrandingDraft,
      isBrandingDirty,
      isBrandingSaving: savingBranding,
      settingsDraft: draft.settings,
      setSettingsDraft,
      commitSettingsDraft,
      commitSettingsPatch,
      isSettingsDirty,
      isSettingsSaving: savingSettings,
      isSectionSaving,
      saveSection,
      saveDirtySections,
      selection,
      setSelection,
      clearSelection: () => setSelection(null)
    }),
    [
      baseline,
      commitBrandingDraft,
      commitSettingsDraft,
      commitSettingsPatch,
      commitStoreDraft,
      dirtySections,
      discardSection,
      draft,
      error,
      getSectionDraft,
      isBrandingDirty,
      savingBranding,
      isSectionDirty,
      isSettingsDirty,
      savingSettings,
      isSectionSaving,
      isStoreDirty,
      savingStore,
      loading,
      selection,
      saveDirtySections,
      saveSection,
      setBrandingDraft,
      setSelection,
      setSectionDraft,
      setSettingsDraft,
      setStoreDraft,
      storeSlug
    ]
  );

  return <StorefrontStudioDocumentContext.Provider value={value}>{children}</StorefrontStudioDocumentContext.Provider>;
}

export function useOptionalStorefrontStudioDocument() {
  return useContext(StorefrontStudioDocumentContext);
}
