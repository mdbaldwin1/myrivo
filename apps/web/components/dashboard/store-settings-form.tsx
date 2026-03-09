"use client";

import Image from "next/image";
import { Pencil, Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Switch } from "@/components/ui/switch";
import { notify } from "@/lib/feedback/toast";
import type { StoreBrandingRecord, StoreRecord } from "@/types/database";

type StoreSettingsFormProps = {
  initialStore: Pick<StoreRecord, "id" | "name" | "slug" | "status">;
  initialLogoPath: Pick<StoreBrandingRecord, "logo_path">["logo_path"] | null;
  header?: ReactNode;
};

type StoreResponse = {
  store?: Pick<StoreRecord, "id" | "name" | "slug" | "status">;
  error?: string;
};

type LogoUploadResponse = {
  logoPath?: string;
  error?: string;
};

type BrandingResponse = {
  branding?: Pick<StoreBrandingRecord, "logo_path">;
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

export function StoreSettingsForm({ initialStore, initialLogoPath, header }: StoreSettingsFormProps) {
  const formId = "store-profile-form";
  const [name, setName] = useState(initialStore.name);
  const [status, setStatus] = useState<StoreRecord["status"]>(initialStore.status);
  const [savedName, setSavedName] = useState(initialStore.name);
  const [submittingReview, setSubmittingReview] = useState(false);

  const [logoPath, setLogoPath] = useState(initialLogoPath ?? "");
  const [savedLogoPath, setSavedLogoPath] = useState(initialLogoPath ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
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

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const isDirty =
    name !== savedName ||
    (logoPath || "") !== savedLogoPath ||
    logoFile !== null ||
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
    let cancelled = false;

    void (async () => {
      const response = await fetch("/api/stores/white-label", { cache: "no-store" });
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

      const settingsResponse = await fetch("/api/store-experience/settings", { cache: "no-store" });
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
  }, []);

  async function toggleWhiteLabel(nextEnabled: boolean) {
    setWhiteLabelSaving(true);
    setError(null);

    const response = await fetch("/api/stores/white-label", {
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

  async function uploadLogoIfNeeded() {
    if (!logoFile) {
      return logoPath || null;
    }

    const formData = new FormData();
    formData.append("file", logoFile);

    const response = await fetch("/api/stores/branding/logo", {
      method: "POST",
      body: formData
    });

    const payload = (await response.json()) as LogoUploadResponse;

    if (!response.ok || !payload.logoPath) {
      throw new Error(payload.error ?? "Unable to upload logo.");
    }

    setLogoPath(payload.logoPath);
    setLogoFile(null);
    return payload.logoPath;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "discard") {
      setName(savedName);
      setLogoPath(savedLogoPath);
      setLogoFile(null);
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

    if ((nextLogoPath ?? "") !== savedLogoPath) {
      const brandingResponse = await fetch("/api/stores/branding", {
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

    const seoResponse = await fetch("/api/store-experience/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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

    const response = await fetch("/api/stores/current", {
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

  async function handleSubmitForReview() {
    if (status !== "draft" || submittingReview) {
      return;
    }
    setSubmittingReview(true);
    setError(null);

    const response = await fetch("/api/stores/current/submit-review", {
      method: "POST"
    });
    const payload = (await response.json()) as StoreResponse & { ok?: boolean };
    if (!response.ok || !payload.store) {
      setError(payload.error ?? "Unable to submit store for review.");
      setSubmittingReview(false);
      return;
    }

    setStatus(payload.store.status);
    notify.success("Store submitted for review.", {
      description: "Your storefront will go live once approved."
    });
    setSubmittingReview(false);
  }

  const statusCopy: Record<StoreRecord["status"], string> = {
    draft: "Not visible publicly. Submit for review when you're ready for approval.",
    pending_review: "Waiting for platform approval before going live.",
    active: "Live and visible publicly.",
    suspended: "Hidden from public view by platform review."
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-4">
        {header}
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          <SectionCard title="Store Identity" description="Core storefront naming shown across your customer experience.">
            <FormField label="Store Name" description="This appears in your storefront header, email copy, and checkout.">
              <Input required minLength={2} placeholder="At Home Apothecary" value={name} onChange={(event) => setName(event.target.value)} />
            </FormField>
          </SectionCard>

          <SectionCard title="Store Logo" description="Upload or replace the brand logo used throughout storefront and transactional surfaces.">
            <FormField label="Logo Asset">
              <input
                ref={logoInputRef}
                type="file"
                className="hidden"
                accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (!file) {
                    return;
                  }
                  setLogoFile(file);
                  event.target.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2">
                {logoPreview ? (
                  <div
                    className="group relative h-24 w-24 overflow-hidden rounded-md border border-border bg-muted/15 transition-transform hover:scale-[1.02]"
                    onClick={() => logoInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        logoInputRef.current?.click();
                      }
                    }}
                    aria-label="Replace logo"
                  >
                    <Image src={logoPreview} alt="Store logo preview" fill unoptimized className="object-contain bg-white p-1.5" />
                    <div className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                      <Pencil className="h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]" />
                    </div>
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white transition hover:bg-red-700"
                      onClick={(event) => {
                        event.stopPropagation();
                        setLogoFile(null);
                        setLogoPath("");
                      }}
                      aria-label="Remove logo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-border bg-muted/10 text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-muted/25 hover:text-foreground hover:shadow-sm"
                    onClick={() => logoInputRef.current?.click()}
                    aria-label="Upload logo"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG, WEBP, or SVG up to 2MB.</p>
            </FormField>
          </SectionCard>

          <SectionCard title="Store Visibility" description="Control whether your storefront is publicly accessible.">
            <FormField label="Store Status" description="Status is managed through platform review workflow.">
              <div className="rounded-md border border-border/70 bg-muted/15 px-3 py-2 text-sm font-medium capitalize">{status.replace("_", " ")}</div>
            </FormField>
            <p className="text-sm text-muted-foreground">{statusCopy[status]}</p>
            {status === "draft" ? (
              <Button type="button" variant="outline" onClick={() => void handleSubmitForReview()} disabled={saving || submittingReview}>
                {submittingReview ? "Submitting..." : "Submit for Review"}
              </Button>
            ) : null}
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
            <FormField label="SEO Title" description="Recommended max length: 60 characters.">
              <Input maxLength={120} placeholder="At Home Apothecary | Small-batch wellness products" value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
            </FormField>
            <FormField label="SEO Description" description="Recommended max length: 155 characters.">
              <Input
                maxLength={320}
                placeholder="Shop handcrafted products with local pickup and shipping."
                value={seoDescription}
                onChange={(event) => setSeoDescription(event.target.value)}
              />
            </FormField>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-muted/15 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Hide Store From Search Engines</p>
                <p className="text-xs text-muted-foreground">Enable noindex while your storefront is private or in draft mode.</p>
              </div>
              <Switch checked={seoNoindex} onChange={(event) => setSeoNoindex(event.target.checked)} disabled={saving} />
            </div>
            <div className="space-y-3 rounded-md border border-border/60 bg-muted/15 p-3">
              <div>
                <p className="text-sm font-medium">Local SEO Location (Optional)</p>
                <p className="text-xs text-muted-foreground">
                  Publish city/region/state for local discovery. Keep full address private unless you explicitly enable it.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="City">
                  <Input maxLength={120} placeholder="Albany" value={seoLocationCity} onChange={(event) => setSeoLocationCity(event.target.value)} />
                </FormField>
                <FormField label="Region">
                  <Input
                    maxLength={120}
                    placeholder="Capital District"
                    value={seoLocationRegion}
                    onChange={(event) => setSeoLocationRegion(event.target.value)}
                  />
                </FormField>
                <FormField label="State / Province">
                  <Input maxLength={120} placeholder="New York" value={seoLocationState} onChange={(event) => setSeoLocationState(event.target.value)} />
                </FormField>
                <FormField label="Country Code">
                  <Input
                    maxLength={2}
                    placeholder="US"
                    value={seoLocationCountryCode}
                    onChange={(event) => setSeoLocationCountryCode(event.target.value.toUpperCase())}
                  />
                </FormField>
                <FormField label="Postal Code (Optional)">
                  <Input maxLength={32} placeholder="12203" value={seoLocationPostalCode} onChange={(event) => setSeoLocationPostalCode(event.target.value)} />
                </FormField>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-background px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Show Full Address Publicly</p>
                  <p className="text-xs text-muted-foreground">Leave off to keep exact pickup/location private on public pages and schema.</p>
                </div>
                <Switch checked={seoLocationShowFullAddress} onChange={(event) => setSeoLocationShowFullAddress(event.target.checked)} disabled={saving} />
              </div>
              {seoLocationShowFullAddress ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Address Line 1">
                    <Input
                      maxLength={200}
                      placeholder="123 Main St"
                      value={seoLocationAddressLine1}
                      onChange={(event) => setSeoLocationAddressLine1(event.target.value)}
                    />
                  </FormField>
                  <FormField label="Address Line 2 (Optional)">
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
