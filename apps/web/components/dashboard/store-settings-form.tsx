"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { BrandingAssetPicker } from "@/components/dashboard/branding-asset-picker";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/lib/feedback/toast";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";
import { canDeleteStoreFromWorkspace, getStoreLifecycleDescription, getStoreLifecycleLabel } from "@/lib/stores/lifecycle";
import type { StoreBrandingRecord, StoreRecord } from "@/types/database";

type StoreSettingsFormProps = {
  initialStore: Pick<StoreRecord, "id" | "name" | "slug" | "status">;
  initialLogoPath: Pick<StoreBrandingRecord, "logo_path">["logo_path"] | null;
  initialFaviconPath: Pick<StoreBrandingRecord, "favicon_path">["favicon_path"] | null;
  initialAppleTouchIconPath: Pick<StoreBrandingRecord, "apple_touch_icon_path">["apple_touch_icon_path"] | null;
  initialOgImagePath: Pick<StoreBrandingRecord, "og_image_path">["og_image_path"] | null;
  initialTwitterImagePath: Pick<StoreBrandingRecord, "twitter_image_path">["twitter_image_path"] | null;
  header?: ReactNode;
  supplementalContent?: ReactNode;
};

type StoreResponse = {
  store?: Pick<StoreRecord, "id" | "name" | "slug" | "status">;
  error?: string;
};

type BrandingAssetUploadResponse = {
  logoPath?: string;
  assetPath?: string;
  error?: string;
};

type BrandingResponse = {
  branding?: Pick<StoreBrandingRecord, "logo_path" | "favicon_path" | "apple_touch_icon_path" | "og_image_path" | "twitter_image_path">;
  error?: string;
};

type WhiteLabelResponse = {
  enabled?: boolean;
  error?: string;
};

type StoreExperienceSettingsResponse = {
  settings?: {
    seo?: {
      title: string | null;
      description: string | null;
      noindex: boolean;
      location?: {
        city: string | null;
        region: string | null;
        state: string | null;
        postalCode: string | null;
        countryCode: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        showFullAddress: boolean;
      };
    };
  };
  error?: string;
};

export function StoreSettingsForm({
  initialStore,
  initialLogoPath,
  initialFaviconPath,
  initialAppleTouchIconPath,
  initialOgImagePath,
  initialTwitterImagePath,
  header,
  supplementalContent
}: StoreSettingsFormProps) {
  const formId = "store-profile-form";
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const [name, setName] = useState(initialStore.name);
  const [status, setStatus] = useState<StoreRecord["status"]>(initialStore.status);
  const [savedName, setSavedName] = useState(initialStore.name);
  const [deletingStore, setDeletingStore] = useState(false);

  const [logoPath, setLogoPath] = useState(initialLogoPath ?? "");
  const [savedLogoPath, setSavedLogoPath] = useState(initialLogoPath ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconPath, setFaviconPath] = useState(initialFaviconPath ?? "");
  const [savedFaviconPath, setSavedFaviconPath] = useState(initialFaviconPath ?? "");
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [appleTouchIconPath, setAppleTouchIconPath] = useState(initialAppleTouchIconPath ?? "");
  const [savedAppleTouchIconPath, setSavedAppleTouchIconPath] = useState(initialAppleTouchIconPath ?? "");
  const [appleTouchIconFile, setAppleTouchIconFile] = useState<File | null>(null);
  const [ogImagePath, setOgImagePath] = useState(initialOgImagePath ?? "");
  const [savedOgImagePath, setSavedOgImagePath] = useState(initialOgImagePath ?? "");
  const [ogImageFile, setOgImageFile] = useState<File | null>(null);
  const [twitterImagePath, setTwitterImagePath] = useState(initialTwitterImagePath ?? "");
  const [savedTwitterImagePath, setSavedTwitterImagePath] = useState(initialTwitterImagePath ?? "");
  const [twitterImageFile, setTwitterImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [whiteLabelEnabled, setWhiteLabelEnabled] = useState(false);
  const [whiteLabelLoading, setWhiteLabelLoading] = useState(true);
  const [whiteLabelSaving, setWhiteLabelSaving] = useState(false);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoNoindex, setSeoNoindex] = useState(false);
  const [savedSeoTitle, setSavedSeoTitle] = useState("");
  const [savedSeoDescription, setSavedSeoDescription] = useState("");
  const [savedSeoNoindex, setSavedSeoNoindex] = useState(false);
  const [seoLocationCity, setSeoLocationCity] = useState("");
  const [seoLocationRegion, setSeoLocationRegion] = useState("");
  const [seoLocationState, setSeoLocationState] = useState("");
  const [seoLocationPostalCode, setSeoLocationPostalCode] = useState("");
  const [seoLocationCountryCode, setSeoLocationCountryCode] = useState("");
  const [seoLocationAddressLine1, setSeoLocationAddressLine1] = useState("");
  const [seoLocationAddressLine2, setSeoLocationAddressLine2] = useState("");
  const [seoLocationShowFullAddress, setSeoLocationShowFullAddress] = useState(false);
  const [savedSeoLocationCity, setSavedSeoLocationCity] = useState("");
  const [savedSeoLocationRegion, setSavedSeoLocationRegion] = useState("");
  const [savedSeoLocationState, setSavedSeoLocationState] = useState("");
  const [savedSeoLocationPostalCode, setSavedSeoLocationPostalCode] = useState("");
  const [savedSeoLocationCountryCode, setSavedSeoLocationCountryCode] = useState("");
  const [savedSeoLocationAddressLine1, setSavedSeoLocationAddressLine1] = useState("");
  const [savedSeoLocationAddressLine2, setSavedSeoLocationAddressLine2] = useState("");
  const [savedSeoLocationShowFullAddress, setSavedSeoLocationShowFullAddress] = useState(false);

  const logoPreview = useMemo(() => {
    if (logoFile) {
      return URL.createObjectURL(logoFile);
    }
    return logoPath || null;
  }, [logoFile, logoPath]);

  const faviconPreview = useMemo(() => {
    if (faviconFile) {
      return URL.createObjectURL(faviconFile);
    }
    return faviconPath || null;
  }, [faviconFile, faviconPath]);
  const appleTouchIconPreview = useMemo(() => {
    if (appleTouchIconFile) {
      return URL.createObjectURL(appleTouchIconFile);
    }
    return appleTouchIconPath || null;
  }, [appleTouchIconFile, appleTouchIconPath]);
  const ogImagePreview = useMemo(() => {
    if (ogImageFile) {
      return URL.createObjectURL(ogImageFile);
    }
    return ogImagePath || null;
  }, [ogImageFile, ogImagePath]);
  const twitterImagePreview = useMemo(() => {
    if (twitterImageFile) {
      return URL.createObjectURL(twitterImageFile);
    }
    return twitterImagePath || null;
  }, [twitterImageFile, twitterImagePath]);

  const isDirty =
    name !== savedName ||
    (logoPath || "") !== savedLogoPath ||
    (faviconPath || "") !== savedFaviconPath ||
    (appleTouchIconPath || "") !== savedAppleTouchIconPath ||
    (ogImagePath || "") !== savedOgImagePath ||
    (twitterImagePath || "") !== savedTwitterImagePath ||
    logoFile !== null ||
    faviconFile !== null ||
    appleTouchIconFile !== null ||
    ogImageFile !== null ||
    twitterImageFile !== null ||
    seoTitle !== savedSeoTitle ||
    seoDescription !== savedSeoDescription ||
    seoNoindex !== savedSeoNoindex ||
    seoLocationCity !== savedSeoLocationCity ||
    seoLocationRegion !== savedSeoLocationRegion ||
    seoLocationState !== savedSeoLocationState ||
    seoLocationPostalCode !== savedSeoLocationPostalCode ||
    seoLocationCountryCode !== savedSeoLocationCountryCode ||
    seoLocationAddressLine1 !== savedSeoLocationAddressLine1 ||
    seoLocationAddressLine2 !== savedSeoLocationAddressLine2 ||
    seoLocationShowFullAddress !== savedSeoLocationShowFullAddress;

  useEffect(() => {
    if (!logoFile || !logoPreview) {
      return;
    }

    return () => URL.revokeObjectURL(logoPreview);
  }, [logoFile, logoPreview]);

  useEffect(() => {
    if (!faviconFile || !faviconPreview) {
      return;
    }

    return () => URL.revokeObjectURL(faviconPreview);
  }, [faviconFile, faviconPreview]);

  useEffect(() => {
    if (!appleTouchIconFile || !appleTouchIconPreview) {
      return;
    }

    return () => URL.revokeObjectURL(appleTouchIconPreview);
  }, [appleTouchIconFile, appleTouchIconPreview]);

  useEffect(() => {
    if (!ogImageFile || !ogImagePreview) {
      return;
    }

    return () => URL.revokeObjectURL(ogImagePreview);
  }, [ogImageFile, ogImagePreview]);

  useEffect(() => {
    if (!twitterImageFile || !twitterImagePreview) {
      return;
    }

    return () => URL.revokeObjectURL(twitterImagePreview);
  }, [twitterImageFile, twitterImagePreview]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const response = await fetch(buildStoreScopedApiPath("/api/stores/white-label", storeSlug), { cache: "no-store" });
      const payload = (await response.json()) as WhiteLabelResponse;

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setError(payload.error ?? "Unable to load white-label setting.");
        setWhiteLabelLoading(false);
        return;
      }

      setWhiteLabelEnabled(Boolean(payload.enabled));
      setWhiteLabelLoading(false);

      const settingsResponse = await fetch(buildStoreScopedApiPath("/api/store-experience/settings", storeSlug), { cache: "no-store" });
      const settingsPayload = (await settingsResponse.json()) as StoreExperienceSettingsResponse;
      if (!settingsResponse.ok) {
        setError(settingsPayload.error ?? "Unable to load SEO settings.");
        return;
      }
      const initialSeoTitle = settingsPayload.settings?.seo?.title ?? "";
      const initialSeoDescription = settingsPayload.settings?.seo?.description ?? "";
      const initialSeoNoindex = settingsPayload.settings?.seo?.noindex ?? false;
      const initialSeoLocationCity = settingsPayload.settings?.seo?.location?.city ?? "";
      const initialSeoLocationRegion = settingsPayload.settings?.seo?.location?.region ?? "";
      const initialSeoLocationState = settingsPayload.settings?.seo?.location?.state ?? "";
      const initialSeoLocationPostalCode = settingsPayload.settings?.seo?.location?.postalCode ?? "";
      const initialSeoLocationCountryCode = settingsPayload.settings?.seo?.location?.countryCode ?? "";
      const initialSeoLocationAddressLine1 = settingsPayload.settings?.seo?.location?.addressLine1 ?? "";
      const initialSeoLocationAddressLine2 = settingsPayload.settings?.seo?.location?.addressLine2 ?? "";
      const initialSeoLocationShowFullAddress = settingsPayload.settings?.seo?.location?.showFullAddress ?? false;
      setSeoTitle(initialSeoTitle);
      setSeoDescription(initialSeoDescription);
      setSeoNoindex(initialSeoNoindex);
      setSavedSeoTitle(initialSeoTitle);
      setSavedSeoDescription(initialSeoDescription);
      setSavedSeoNoindex(initialSeoNoindex);
      setSeoLocationCity(initialSeoLocationCity);
      setSeoLocationRegion(initialSeoLocationRegion);
      setSeoLocationState(initialSeoLocationState);
      setSeoLocationPostalCode(initialSeoLocationPostalCode);
      setSeoLocationCountryCode(initialSeoLocationCountryCode);
      setSeoLocationAddressLine1(initialSeoLocationAddressLine1);
      setSeoLocationAddressLine2(initialSeoLocationAddressLine2);
      setSeoLocationShowFullAddress(initialSeoLocationShowFullAddress);
      setSavedSeoLocationCity(initialSeoLocationCity);
      setSavedSeoLocationRegion(initialSeoLocationRegion);
      setSavedSeoLocationState(initialSeoLocationState);
      setSavedSeoLocationPostalCode(initialSeoLocationPostalCode);
      setSavedSeoLocationCountryCode(initialSeoLocationCountryCode);
      setSavedSeoLocationAddressLine1(initialSeoLocationAddressLine1);
      setSavedSeoLocationAddressLine2(initialSeoLocationAddressLine2);
      setSavedSeoLocationShowFullAddress(initialSeoLocationShowFullAddress);
    })();

    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  async function toggleWhiteLabel(nextEnabled: boolean) {
    setWhiteLabelSaving(true);
    setError(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/white-label", storeSlug), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextEnabled })
    });

    const payload = (await response.json()) as WhiteLabelResponse;

    if (!response.ok) {
      setError(payload.error ?? "Unable to update white-labeling.");
      setWhiteLabelSaving(false);
      return;
    }

    setWhiteLabelEnabled(Boolean(payload.enabled));
    notify.success(payload.enabled ? "White labeling enabled." : "White labeling disabled.");
    setWhiteLabelSaving(false);
  }

  async function uploadBrandingAsset(assetType: "logo" | "favicon" | "apple_touch_icon" | "og_image" | "twitter_image", file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("assetType", assetType);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/branding/logo", storeSlug), {
      method: "POST",
      body: formData
    });

    const payload = (await response.json()) as BrandingAssetUploadResponse;

    if (!response.ok || !payload.assetPath) {
      throw new Error(payload.error ?? `Unable to upload ${assetType}.`);
    }

    return payload.assetPath;
  }

  async function uploadLogoIfNeeded() {
    if (!logoFile) {
      return logoPath || null;
    }
    const nextLogoPath = await uploadBrandingAsset("logo", logoFile);
    setLogoPath(nextLogoPath);
    setLogoFile(null);
    return nextLogoPath;
  }

  async function uploadFaviconIfNeeded() {
    if (!faviconFile) {
      return faviconPath || null;
    }
    const nextFaviconPath = await uploadBrandingAsset("favicon", faviconFile);
    setFaviconPath(nextFaviconPath);
    setFaviconFile(null);
    return nextFaviconPath;
  }

  async function uploadAppleTouchIconIfNeeded() {
    if (!appleTouchIconFile) {
      return appleTouchIconPath || null;
    }
    const nextAppleTouchIconPath = await uploadBrandingAsset("apple_touch_icon", appleTouchIconFile);
    setAppleTouchIconPath(nextAppleTouchIconPath);
    setAppleTouchIconFile(null);
    return nextAppleTouchIconPath;
  }

  async function uploadOgImageIfNeeded() {
    if (!ogImageFile) {
      return ogImagePath || null;
    }
    const nextOgImagePath = await uploadBrandingAsset("og_image", ogImageFile);
    setOgImagePath(nextOgImagePath);
    setOgImageFile(null);
    return nextOgImagePath;
  }

  async function uploadTwitterImageIfNeeded() {
    if (!twitterImageFile) {
      return twitterImagePath || null;
    }
    const nextTwitterImagePath = await uploadBrandingAsset("twitter_image", twitterImageFile);
    setTwitterImagePath(nextTwitterImagePath);
    setTwitterImageFile(null);
    return nextTwitterImagePath;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "discard") {
      setName(savedName);
      setLogoPath(savedLogoPath);
      setFaviconPath(savedFaviconPath);
      setAppleTouchIconPath(savedAppleTouchIconPath);
      setOgImagePath(savedOgImagePath);
      setTwitterImagePath(savedTwitterImagePath);
      setLogoFile(null);
      setFaviconFile(null);
      setAppleTouchIconFile(null);
      setOgImageFile(null);
      setTwitterImageFile(null);
      setSeoTitle(savedSeoTitle);
      setSeoDescription(savedSeoDescription);
      setSeoNoindex(savedSeoNoindex);
      setSeoLocationCity(savedSeoLocationCity);
      setSeoLocationRegion(savedSeoLocationRegion);
      setSeoLocationState(savedSeoLocationState);
      setSeoLocationPostalCode(savedSeoLocationPostalCode);
      setSeoLocationCountryCode(savedSeoLocationCountryCode);
      setSeoLocationAddressLine1(savedSeoLocationAddressLine1);
      setSeoLocationAddressLine2(savedSeoLocationAddressLine2);
      setSeoLocationShowFullAddress(savedSeoLocationShowFullAddress);
      setError(null);
      return;
    }

    setError(null);
    setSaving(true);

    let nextLogoPath: string | null;
    try {
      nextLogoPath = await uploadLogoIfNeeded();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload logo.");
      setSaving(false);
      return;
    }

    let nextFaviconPath: string | null;
    try {
      nextFaviconPath = await uploadFaviconIfNeeded();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload favicon.");
      setSaving(false);
      return;
    }

    let nextAppleTouchIconPath: string | null;
    try {
      nextAppleTouchIconPath = await uploadAppleTouchIconIfNeeded();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload apple touch icon.");
      setSaving(false);
      return;
    }

    let nextOgImagePath: string | null;
    try {
      nextOgImagePath = await uploadOgImageIfNeeded();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload Open Graph image.");
      setSaving(false);
      return;
    }

    let nextTwitterImagePath: string | null;
    try {
      nextTwitterImagePath = await uploadTwitterImageIfNeeded();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload Twitter image.");
      setSaving(false);
      return;
    }

    if ((nextLogoPath ?? "") !== savedLogoPath) {
      const brandingResponse = await fetch(buildStoreScopedApiPath("/api/stores/branding", storeSlug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoPath: nextLogoPath ?? null })
      });

      const brandingPayload = (await brandingResponse.json()) as BrandingResponse;
      if (!brandingResponse.ok || !brandingPayload.branding) {
        setError(brandingPayload.error ?? "Unable to update logo.");
        setSaving(false);
        return;
      }
    }

    const seoResponse = await fetch(buildStoreScopedApiPath("/api/store-experience/settings", storeSlug), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branding: {
          faviconPath: nextFaviconPath ?? null,
          appleTouchIconPath: nextAppleTouchIconPath ?? null,
          ogImagePath: nextOgImagePath ?? null,
          twitterImagePath: nextTwitterImagePath ?? null
        },
        seo: {
          title: seoTitle.trim() || null,
          description: seoDescription.trim() || null,
          noindex: seoNoindex,
          location: {
            city: seoLocationCity.trim() || null,
            region: seoLocationRegion.trim() || null,
            state: seoLocationState.trim() || null,
            postalCode: seoLocationPostalCode.trim() || null,
            countryCode: seoLocationCountryCode.trim() || null,
            addressLine1: seoLocationAddressLine1.trim() || null,
            addressLine2: seoLocationAddressLine2.trim() || null,
            showFullAddress: seoLocationShowFullAddress
          }
        }
      })
    });
    const seoPayload = (await seoResponse.json()) as StoreExperienceSettingsResponse;
    if (!seoResponse.ok) {
      setError(seoPayload.error ?? "Unable to update SEO settings.");
      setSaving(false);
      return;
    }

    const response = await fetch(buildStoreScopedApiPath("/api/stores/current", storeSlug), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });

    const payload = (await response.json()) as StoreResponse;
    if (!response.ok || !payload.store) {
      setError(payload.error ?? "Unable to update store settings.");
      setSaving(false);
      return;
    }

    setSavedName(payload.store.name);
    setName(payload.store.name);
    setStatus(payload.store.status);
    setSavedLogoPath(nextLogoPath ?? "");
    setLogoPath(nextLogoPath ?? "");
    setSavedFaviconPath(nextFaviconPath ?? "");
    setFaviconPath(nextFaviconPath ?? "");
    setSavedAppleTouchIconPath(nextAppleTouchIconPath ?? "");
    setAppleTouchIconPath(nextAppleTouchIconPath ?? "");
    setSavedOgImagePath(nextOgImagePath ?? "");
    setOgImagePath(nextOgImagePath ?? "");
    setSavedTwitterImagePath(nextTwitterImagePath ?? "");
    setTwitterImagePath(nextTwitterImagePath ?? "");
    setSavedSeoTitle(seoTitle);
    setSavedSeoDescription(seoDescription);
    setSavedSeoNoindex(seoNoindex);
    setSavedSeoLocationCity(seoLocationCity);
    setSavedSeoLocationRegion(seoLocationRegion);
    setSavedSeoLocationState(seoLocationState);
    setSavedSeoLocationPostalCode(seoLocationPostalCode);
    setSavedSeoLocationCountryCode(seoLocationCountryCode);
    setSavedSeoLocationAddressLine1(seoLocationAddressLine1);
    setSavedSeoLocationAddressLine2(seoLocationAddressLine2);
    setSavedSeoLocationShowFullAddress(seoLocationShowFullAddress);
    notify.success("Store profile saved.");
    setSaving(false);
  }

  async function handleDeleteStore() {
    if (!canDeleteStoreFromWorkspace(status) || deletingStore) {
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete ${savedName}? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingStore(true);
    setError(null);

    const response = await fetch(buildStoreScopedApiPath("/api/stores/current", storeSlug), {
      method: "DELETE"
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to permanently delete store.");
      setDeletingStore(false);
      return;
    }

    notify.success("Store permanently deleted.");
    window.location.assign("/dashboard/stores");
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {header}
        {supplementalContent}
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          <SectionCard
            title="Store Identity"
            description="Store name and brand assets used across your storefront, browser tabs, and shared links."
          >
            <div className="space-y-5">
              <FormField label="Store Name" description="This appears in your storefront header, email copy, and checkout." inputId="store-settings-store-name">
                <Input required minLength={2} placeholder="At Home Apothecary" value={name} onChange={(event) => setName(event.target.value)} />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <FormField
                  label="Store Logo"
                  description="Used throughout storefront and transactional surfaces."
                >
                  <BrandingAssetPicker
                    accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                    previewSrc={logoPreview}
                    previewAlt="Store logo preview"
                    emptyAriaLabel="Upload logo"
                    replaceAriaLabel="Replace logo"
                    removeAriaLabel="Remove logo"
                    helperText="PNG, JPEG, WEBP, or SVG up to 2MB."
                    previewPaddingClassName="p-1.5"
                    onFileSelect={(file) => setLogoFile(file)}
                    onRemove={() => {
                      setLogoFile(null);
                      setLogoPath("");
                    }}
                  />
                </FormField>
              <FormField
                label="Favicon"
                description="Shown in browser tabs for `/s/slug` storefronts and white-labeled domains."
              >
                <BrandingAssetPicker
                  accept=".ico,.png,.svg,image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml"
                  previewSrc={faviconPreview}
                  previewAlt="Favicon preview"
                  emptyAriaLabel="Upload favicon"
                  replaceAriaLabel="Replace favicon"
                  removeAriaLabel="Remove favicon"
                  helperText="ICO, PNG, or SVG up to 2MB."
                  previewPaddingClassName="p-3"
                  onFileSelect={(file) => setFaviconFile(file)}
                  onRemove={() => {
                    setFaviconFile(null);
                    setFaviconPath("");
                  }}
                />
              </FormField>
              <FormField
                label="Apple Touch Icon"
                description="Used when customers save your storefront to an iPhone or iPad home screen."
              >
                <BrandingAssetPicker
                  accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                  previewSrc={appleTouchIconPreview}
                  previewAlt="Apple touch icon preview"
                  emptyAriaLabel="Upload apple touch icon"
                  replaceAriaLabel="Replace apple touch icon"
                  removeAriaLabel="Remove apple touch icon"
                  helperText="Square PNG recommended. Up to 2MB."
                  previewPaddingClassName="p-3"
                  onFileSelect={(file) => setAppleTouchIconFile(file)}
                  onRemove={() => {
                    setAppleTouchIconFile(null);
                    setAppleTouchIconPath("");
                  }}
                />
              </FormField>
              <FormField
                label="Open Graph Image"
                description="Default preview image used when your storefront is shared in messages and social apps."
              >
                <BrandingAssetPicker
                  accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                  previewSrc={ogImagePreview}
                  previewAlt="Open Graph image preview"
                  emptyAriaLabel="Upload Open Graph image"
                  replaceAriaLabel="Replace Open Graph image"
                  removeAriaLabel="Remove Open Graph image"
                  helperText="Landscape image recommended. Up to 2MB."
                  previewPaddingClassName="p-2"
                  onFileSelect={(file) => setOgImageFile(file)}
                  onRemove={() => {
                    setOgImageFile(null);
                    setOgImagePath("");
                  }}
                />
              </FormField>
              <FormField
                label="Twitter / X Image"
                description="Optional override for link previews on Twitter/X. Falls back to the Open Graph image if unset."
              >
                <BrandingAssetPicker
                  accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                  previewSrc={twitterImagePreview}
                  previewAlt="Twitter image preview"
                  emptyAriaLabel="Upload Twitter image"
                  replaceAriaLabel="Replace Twitter image"
                  removeAriaLabel="Remove Twitter image"
                  helperText="Landscape image recommended. Up to 2MB."
                  previewPaddingClassName="p-2"
                  onFileSelect={(file) => setTwitterImageFile(file)}
                  onRemove={() => {
                    setTwitterImageFile(null);
                    setTwitterImagePath("");
                  }}
                />
              </FormField>
            </div>
            </div>
          </SectionCard>

          <SectionCard
            title="White Labeling"
            description="Enable custom domains and branded metadata for your storefront URL."
          >
            <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-muted/15 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Enable White Labeling</p>
                <p className="text-xs text-muted-foreground">
                  When enabled, custom domain management is available in Store Settings &gt; Domains.
                </p>
              </div>
              <Switch
                checked={whiteLabelEnabled}
                onChange={(event) => {
                  if (event.target.checked !== whiteLabelEnabled) {
                    void toggleWhiteLabel(event.target.checked);
                  }
                }}
                disabled={whiteLabelLoading || whiteLabelSaving || saving}
              />
            </div>
          </SectionCard>

          <SectionCard title="SEO" description="Default storefront metadata used by search engines and social cards.">
            <div className="space-y-5">
              <div className="space-y-4">
                <FormField label="SEO Title" description="Recommended max length: 60 characters." inputId="store-settings-seo-title">
                  <Input
                    maxLength={120}
                    placeholder="At Home Apothecary | Small-batch wellness products"
                    value={seoTitle}
                    onChange={(event) => setSeoTitle(event.target.value)}
                  />
                </FormField>
                <FormField label="SEO Description" description="Recommended max length: 155 characters." inputId="store-settings-seo-description">
                  <Textarea
                    rows={3}
                    maxLength={320}
                    placeholder="Shop handcrafted products with local pickup and shipping."
                    value={seoDescription}
                    onChange={(event) => setSeoDescription(event.target.value)}
                  />
                </FormField>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-muted/15 px-3 py-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Hide Store From Search Engines</p>
                  <p className="text-xs text-muted-foreground">Enable noindex while your storefront is private or in draft mode.</p>
                </div>
                <Switch checked={seoNoindex} onChange={(event) => setSeoNoindex(event.target.checked)} disabled={saving} />
              </div>
              <div className="space-y-4 rounded-md border border-border/60 bg-muted/15 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Local SEO Location</p>
                  <p className="text-xs text-muted-foreground">
                    Publish city and region for local discovery. Keep the exact address private unless you explicitly want it in public metadata.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="City" inputId="store-settings-seo-city">
                    <Input maxLength={120} placeholder="Albany" value={seoLocationCity} onChange={(event) => setSeoLocationCity(event.target.value)} />
                  </FormField>
                  <FormField label="Region" inputId="store-settings-seo-region">
                    <Input
                      maxLength={120}
                      placeholder="Capital District"
                      value={seoLocationRegion}
                      onChange={(event) => setSeoLocationRegion(event.target.value)}
                    />
                  </FormField>
                  <FormField label="State / Province" inputId="store-settings-seo-state">
                    <Input maxLength={120} placeholder="New York" value={seoLocationState} onChange={(event) => setSeoLocationState(event.target.value)} />
                  </FormField>
                  <FormField label="Country Code" inputId="store-settings-seo-country-code">
                    <Input
                      maxLength={2}
                      placeholder="US"
                      value={seoLocationCountryCode}
                      onChange={(event) => setSeoLocationCountryCode(event.target.value.toUpperCase())}
                    />
                  </FormField>
                  <FormField label="Postal Code" inputId="store-settings-seo-postal-code">
                    <Input maxLength={32} placeholder="12203" value={seoLocationPostalCode} onChange={(event) => setSeoLocationPostalCode(event.target.value)} />
                  </FormField>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-background px-3 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Show Full Address Publicly</p>
                    <p className="text-xs text-muted-foreground">Leave this off unless you want the exact pickup or business address exposed publicly.</p>
                  </div>
                  <Switch checked={seoLocationShowFullAddress} onChange={(event) => setSeoLocationShowFullAddress(event.target.checked)} disabled={saving} />
                </div>
                {seoLocationShowFullAddress ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Address Line 1" inputId="store-settings-seo-address-line-1">
                      <Input
                        maxLength={200}
                        placeholder="123 Main St"
                        value={seoLocationAddressLine1}
                        onChange={(event) => setSeoLocationAddressLine1(event.target.value)}
                      />
                    </FormField>
                    <FormField label="Address Line 2" inputId="store-settings-seo-address-line-2">
                      <Input
                        maxLength={200}
                        placeholder="Suite B"
                        value={seoLocationAddressLine2}
                        onChange={(event) => setSeoLocationAddressLine2(event.target.value)}
                      />
                    </FormField>
                  </div>
                ) : null}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Danger Zone"
            description="Permanently delete this store if you are retiring it completely."
            className="border-destructive/20"
          >
            <div className="space-y-4">
              <div className="rounded-md border border-border/70 bg-muted/15 px-3 py-3">
                <p className="text-sm font-medium">{getStoreLifecycleLabel(status)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{getStoreLifecycleDescription(status)}</p>
                {!canDeleteStoreFromWorkspace(status) ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Move this store offline or resolve platform review before permanent deletion is available.
                  </p>
                ) : null}
              </div>
              <Button type="button" variant="destructive" onClick={() => void handleDeleteStore()} disabled={!canDeleteStoreFromWorkspace(status) || deletingStore}>
                {deletingStore ? "Deleting..." : "Permanently Delete Store"}
              </Button>
            </div>
          </SectionCard>
        </form>
      </div>

      <DashboardFormActionBar
        formId={formId}
        saveLabel="Save profile"
        savePendingLabel="Saving..."
        savePending={saving}
        discardLabel="Discard changes"
        saveDisabled={!isDirty || saving}
        discardDisabled={!isDirty || saving}
        statusMessage={error}
        statusVariant="error"
      />
    </section>
  );
}
