"use client";

import Image from "next/image";
import { Pencil, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import type { StoreBrandingRecord, StoreRecord } from "@/types/database";

type StoreSettingsFormProps = {
  initialStore: Pick<StoreRecord, "id" | "name" | "slug" | "status">;
  initialLogoPath: Pick<StoreBrandingRecord, "logo_path">["logo_path"] | null;
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

export function StoreSettingsForm({ initialStore, initialLogoPath }: StoreSettingsFormProps) {
  const [name, setName] = useState(initialStore.name);
  const [status, setStatus] = useState<StoreRecord["status"]>(initialStore.status);
  const [savedName, setSavedName] = useState(initialStore.name);
  const [savedStatus, setSavedStatus] = useState<StoreRecord["status"]>(initialStore.status);

  const [logoPath, setLogoPath] = useState(initialLogoPath ?? "");
  const [savedLogoPath, setSavedLogoPath] = useState(initialLogoPath ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const logoPreview = useMemo(() => {
    if (logoFile) {
      return URL.createObjectURL(logoFile);
    }
    return logoPath || null;
  }, [logoFile, logoPath]);

  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!logoFile || !logoPreview) {
      return;
    }

    return () => URL.revokeObjectURL(logoPreview);
  }, [logoFile, logoPreview]);

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
      setStatus(savedStatus);
      setLogoPath(savedLogoPath);
      setLogoFile(null);
      setError(null);
      return;
    }

    setError(null);
    setMessage(null);

    let nextLogoPath: string | null;
    try {
      nextLogoPath = await uploadLogoIfNeeded();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload logo.");
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
        return;
      }
    }

    const response = await fetch("/api/stores/current", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, status })
    });

    const payload = (await response.json()) as StoreResponse;
    if (!response.ok || !payload.store) {
      setError(payload.error ?? "Unable to update store settings.");
      return;
    }

    setSavedName(payload.store.name);
    setSavedStatus(payload.store.status);
    setName(payload.store.name);
    setStatus(payload.store.status);
    setSavedLogoPath(nextLogoPath ?? "");
    setLogoPath(nextLogoPath ?? "");
    setMessage("Store profile saved.");
  }

  return (
    <form id="store-profile-form" onSubmit={handleSubmit} className="space-y-4">
      <SectionCard title="Store Details">
        <div className="space-y-3">
          <FormField label="Store Name" description="This appears in your storefront header, email copy, and checkout.">
            <Input required minLength={2} placeholder="At Home Apothecary" value={name} onChange={(event) => setName(event.target.value)} />
          </FormField>
          <FormField label="Store Status" description="Draft hides the storefront from the public. Active makes it visible.">
            <Select value={status} onChange={(event) => setStatus(event.target.value as StoreRecord["status"])}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>
          </FormField>
          <div className="rounded-lg border border-border bg-card p-3 text-sm">
            <p className="font-medium">Storefront visibility</p>
            <p className="mt-1 text-muted-foreground">Public storefront is visible only when status is set to Active.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Logo">
        <FormField label="Store Logo">
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

      <FeedbackMessage type="success" message={message} />
      <FeedbackMessage type="error" message={error} />
    </form>
  );
}
