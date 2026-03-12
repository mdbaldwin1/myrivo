"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Switch } from "@/components/ui/switch";
import { buildStoreScopedApiPath, getStoreSlugFromDashboardPathname } from "@/lib/routes/store-workspace";

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

type StoreSeoSettingsFormProps = {
  header?: ReactNode;
};

export function StoreSeoSettingsForm({ header }: StoreSeoSettingsFormProps) {
  const formId = "store-seo-settings-form";
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromDashboardPathname(pathname);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoNoindex, setSeoNoindex] = useState(false);
  const [seoLocationCity, setSeoLocationCity] = useState("");
  const [seoLocationRegion, setSeoLocationRegion] = useState("");
  const [seoLocationState, setSeoLocationState] = useState("");
  const [seoLocationPostalCode, setSeoLocationPostalCode] = useState("");
  const [seoLocationCountryCode, setSeoLocationCountryCode] = useState("");
  const [seoLocationAddressLine1, setSeoLocationAddressLine1] = useState("");
  const [seoLocationAddressLine2, setSeoLocationAddressLine2] = useState("");
  const [seoLocationShowFullAddress, setSeoLocationShowFullAddress] = useState(false);
  const [baseline, setBaseline] = useState({
    seoTitle: "",
    seoDescription: "",
    seoNoindex: false,
    seoLocationCity: "",
    seoLocationRegion: "",
    seoLocationState: "",
    seoLocationPostalCode: "",
    seoLocationCountryCode: "",
    seoLocationAddressLine1: "",
    seoLocationAddressLine2: "",
    seoLocationShowFullAddress: false
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(buildStoreScopedApiPath("/api/store-experience/settings", storeSlug), { cache: "no-store" });
        const payload = (await response.json()) as StoreExperienceSettingsResponse;
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load SEO settings.");
        }

        if (cancelled) {
          return;
        }

        const next = {
          seoTitle: payload.settings?.seo?.title ?? "",
          seoDescription: payload.settings?.seo?.description ?? "",
          seoNoindex: payload.settings?.seo?.noindex ?? false,
          seoLocationCity: payload.settings?.seo?.location?.city ?? "",
          seoLocationRegion: payload.settings?.seo?.location?.region ?? "",
          seoLocationState: payload.settings?.seo?.location?.state ?? "",
          seoLocationPostalCode: payload.settings?.seo?.location?.postalCode ?? "",
          seoLocationCountryCode: payload.settings?.seo?.location?.countryCode ?? "",
          seoLocationAddressLine1: payload.settings?.seo?.location?.addressLine1 ?? "",
          seoLocationAddressLine2: payload.settings?.seo?.location?.addressLine2 ?? "",
          seoLocationShowFullAddress: payload.settings?.seo?.location?.showFullAddress ?? false
        };

        setSeoTitle(next.seoTitle);
        setSeoDescription(next.seoDescription);
        setSeoNoindex(next.seoNoindex);
        setSeoLocationCity(next.seoLocationCity);
        setSeoLocationRegion(next.seoLocationRegion);
        setSeoLocationState(next.seoLocationState);
        setSeoLocationPostalCode(next.seoLocationPostalCode);
        setSeoLocationCountryCode(next.seoLocationCountryCode);
        setSeoLocationAddressLine1(next.seoLocationAddressLine1);
        setSeoLocationAddressLine2(next.seoLocationAddressLine2);
        setSeoLocationShowFullAddress(next.seoLocationShowFullAddress);
        setBaseline(next);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load SEO settings.");
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
  }, [storeSlug]);

  const isDirty = useMemo(
    () =>
      seoTitle !== baseline.seoTitle ||
      seoDescription !== baseline.seoDescription ||
      seoNoindex !== baseline.seoNoindex ||
      seoLocationCity !== baseline.seoLocationCity ||
      seoLocationRegion !== baseline.seoLocationRegion ||
      seoLocationState !== baseline.seoLocationState ||
      seoLocationPostalCode !== baseline.seoLocationPostalCode ||
      seoLocationCountryCode !== baseline.seoLocationCountryCode ||
      seoLocationAddressLine1 !== baseline.seoLocationAddressLine1 ||
      seoLocationAddressLine2 !== baseline.seoLocationAddressLine2 ||
      seoLocationShowFullAddress !== baseline.seoLocationShowFullAddress,
    [
      baseline,
      seoDescription,
      seoLocationAddressLine1,
      seoLocationAddressLine2,
      seoLocationCity,
      seoLocationCountryCode,
      seoLocationPostalCode,
      seoLocationRegion,
      seoLocationShowFullAddress,
      seoLocationState,
      seoNoindex,
      seoTitle
    ]
  );

  function discardChanges() {
    setSeoTitle(baseline.seoTitle);
    setSeoDescription(baseline.seoDescription);
    setSeoNoindex(baseline.seoNoindex);
    setSeoLocationCity(baseline.seoLocationCity);
    setSeoLocationRegion(baseline.seoLocationRegion);
    setSeoLocationState(baseline.seoLocationState);
    setSeoLocationPostalCode(baseline.seoLocationPostalCode);
    setSeoLocationCountryCode(baseline.seoLocationCountryCode);
    setSeoLocationAddressLine1(baseline.seoLocationAddressLine1);
    setSeoLocationAddressLine2(baseline.seoLocationAddressLine2);
    setSeoLocationShowFullAddress(baseline.seoLocationShowFullAddress);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;

    if (submitter?.value === "discard") {
      discardChanges();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(buildStoreScopedApiPath("/api/store-experience/settings", storeSlug), {
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
      const payload = (await response.json()) as StoreExperienceSettingsResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save SEO settings.");
      }

      setBaseline({
        seoTitle,
        seoDescription,
        seoNoindex,
        seoLocationCity,
        seoLocationRegion,
        seoLocationState,
        seoLocationPostalCode,
        seoLocationCountryCode,
        seoLocationAddressLine1,
        seoLocationAddressLine2,
        seoLocationShowFullAddress
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save SEO settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {header}
        {loading ? <p className="text-sm text-muted-foreground">Loading SEO settings...</p> : null}

        {!loading ? (
          <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            <SectionCard title="SEO" description="Search metadata belongs in Store Settings, not the visual builder.">
              <FormField label="SEO Title" description="Recommended max length: 60 characters.">
                <Input maxLength={120} value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
              </FormField>
              <FormField label="SEO Description" description="Recommended max length: 155 characters.">
                <Input maxLength={320} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} />
              </FormField>
              <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-muted/15 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Hide store from search engines</p>
                  <p className="text-xs text-muted-foreground">Use noindex while the storefront is private or still being reviewed.</p>
                </div>
                <Switch checked={seoNoindex} onChange={(event) => setSeoNoindex(event.target.checked)} disabled={saving} />
              </div>
              <div className="space-y-3 rounded-md border border-border/60 bg-muted/15 p-3">
                <div>
                  <p className="text-sm font-medium">Local SEO location</p>
                  <p className="text-xs text-muted-foreground">City and region help discovery. Full address should stay optional.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="City">
                    <Input value={seoLocationCity} onChange={(event) => setSeoLocationCity(event.target.value)} />
                  </FormField>
                  <FormField label="Region">
                    <Input value={seoLocationRegion} onChange={(event) => setSeoLocationRegion(event.target.value)} />
                  </FormField>
                  <FormField label="State / Province">
                    <Input value={seoLocationState} onChange={(event) => setSeoLocationState(event.target.value)} />
                  </FormField>
                  <FormField label="Country Code">
                    <Input maxLength={2} value={seoLocationCountryCode} onChange={(event) => setSeoLocationCountryCode(event.target.value.toUpperCase())} />
                  </FormField>
                  <FormField label="Postal Code">
                    <Input value={seoLocationPostalCode} onChange={(event) => setSeoLocationPostalCode(event.target.value)} />
                  </FormField>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-background px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Show full address publicly</p>
                    <p className="text-xs text-muted-foreground">Keep this off unless you explicitly want the exact address in public metadata.</p>
                  </div>
                  <Switch checked={seoLocationShowFullAddress} onChange={(event) => setSeoLocationShowFullAddress(event.target.checked)} disabled={saving} />
                </div>
                {seoLocationShowFullAddress ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Address Line 1">
                      <Input value={seoLocationAddressLine1} onChange={(event) => setSeoLocationAddressLine1(event.target.value)} />
                    </FormField>
                    <FormField label="Address Line 2">
                      <Input value={seoLocationAddressLine2} onChange={(event) => setSeoLocationAddressLine2(event.target.value)} />
                    </FormField>
                  </div>
                ) : null}
              </div>
            </SectionCard>
          </form>
        ) : null}
      </div>

      {!loading ? (
        <DashboardFormActionBar
          formId={formId}
          saveLabel="Save SEO settings"
          savePendingLabel="Saving..."
          savePending={saving}
          discardLabel="Discard changes"
          saveDisabled={!isDirty || saving}
          discardDisabled={!isDirty || saving}
          statusMessage={error}
          statusVariant="error"
        />
      ) : null}
    </section>
  );
}
