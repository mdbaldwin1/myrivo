"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { resolveStorefrontThemeConfig, type StorefrontThemeConfig } from "@/lib/theme/storefront-theme";
import type { StoreBrandingRecord } from "@/types/database";

type StoreHeroContentFormProps = {
  initialBranding: Pick<StoreBrandingRecord, "theme_json"> | null;
};

type BrandingResponse = {
  branding?: Pick<StoreBrandingRecord, "theme_json">;
  error?: string;
};

export function StoreHeroContentForm({ initialBranding }: StoreHeroContentFormProps) {
  const initialTheme = resolveStorefrontThemeConfig(initialBranding?.theme_json ?? {});
  const [heroBrandDisplay, setHeroBrandDisplay] = useState(initialTheme.heroBrandDisplay);
  const [heroEyebrow, setHeroEyebrow] = useState(initialTheme.heroEyebrow);
  const [heroHeadline, setHeroHeadline] = useState(initialTheme.heroHeadline);
  const [heroSubcopy, setHeroSubcopy] = useState(initialTheme.heroSubcopy);
  const [heroBadgeOne, setHeroBadgeOne] = useState(initialTheme.heroBadgeOne);
  const [heroBadgeTwo, setHeroBadgeTwo] = useState(initialTheme.heroBadgeTwo);
  const [heroBadgeThree, setHeroBadgeThree] = useState(initialTheme.heroBadgeThree);
  const [savedTheme, setSavedTheme] = useState(initialTheme);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isDirty =
    heroBrandDisplay !== savedTheme.heroBrandDisplay ||
    heroEyebrow !== savedTheme.heroEyebrow ||
    heroHeadline !== savedTheme.heroHeadline ||
    heroSubcopy !== savedTheme.heroSubcopy ||
    heroBadgeOne !== savedTheme.heroBadgeOne ||
    heroBadgeTwo !== savedTheme.heroBadgeTwo ||
    heroBadgeThree !== savedTheme.heroBadgeThree;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const nextTheme: Partial<StorefrontThemeConfig> = {
      heroBrandDisplay,
      heroEyebrow: heroEyebrow.trim(),
      heroHeadline: heroHeadline.trim(),
      heroSubcopy: heroSubcopy.trim(),
      heroBadgeOne: heroBadgeOne.trim(),
      heroBadgeTwo: heroBadgeTwo.trim(),
      heroBadgeThree: heroBadgeThree.trim()
    };

    const response = await fetch("/api/stores/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themeJson: { ...(initialBranding?.theme_json ?? {}), ...nextTheme } })
    });

    const payload = (await response.json()) as BrandingResponse;
    setSaving(false);

    if (!response.ok || !payload.branding) {
      setError(payload.error ?? "Unable to save hero content.");
      return;
    }

    const resolved = resolveStorefrontThemeConfig(payload.branding.theme_json ?? {});
    setSavedTheme(resolved);
    setHeroBrandDisplay(resolved.heroBrandDisplay);
    setHeroEyebrow(resolved.heroEyebrow);
    setHeroHeadline(resolved.heroHeadline);
    setHeroSubcopy(resolved.heroSubcopy);
    setHeroBadgeOne(resolved.heroBadgeOne);
    setHeroBadgeTwo(resolved.heroBadgeTwo);
    setHeroBadgeThree(resolved.heroBadgeThree);
    setMessage("Hero content saved.");
  }

  return (
    <SectionCard title="Hero Content">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Hero Brand Display" description="Controls whether the hero shows logo, title, or both.">
            <Select value={heroBrandDisplay} onChange={(event) => setHeroBrandDisplay(event.target.value as typeof heroBrandDisplay)}>
              <option value="title">Store title</option>
              <option value="logo">Logo</option>
              <option value="logo_and_title">Logo + title</option>
            </Select>
          </FormField>
          <FormField label="Eyebrow" description="Short supporting phrase above the headline.">
            <Input value={heroEyebrow} onChange={(event) => setHeroEyebrow(event.target.value)} placeholder="Clean ingredients • Small batch" />
          </FormField>
          <FormField label="Headline" className="sm:col-span-2" description="Primary hero statement to communicate your value.">
            <Input value={heroHeadline} onChange={(event) => setHeroHeadline(event.target.value)} placeholder="Nourishing tallow essentials for daily ritual." />
          </FormField>
          <FormField label="Subcopy" className="sm:col-span-2" description="Secondary copy that supports the hero headline.">
            <Input
              value={heroSubcopy}
              onChange={(event) => setHeroSubcopy(event.target.value)}
              placeholder="Crafted with intentional formulas and direct-from-maker quality."
            />
          </FormField>
          <FormField label="Badge 1">
            <Input value={heroBadgeOne} onChange={(event) => setHeroBadgeOne(event.target.value)} placeholder="Grass-fed tallow" />
          </FormField>
          <FormField label="Badge 2">
            <Input value={heroBadgeTwo} onChange={(event) => setHeroBadgeTwo(event.target.value)} placeholder="Small batch" />
          </FormField>
          <FormField label="Badge 3" className="sm:col-span-2">
            <Input value={heroBadgeThree} onChange={(event) => setHeroBadgeThree(event.target.value)} placeholder="Handmade" />
          </FormField>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            disabled={!isDirty || saving}
            onClick={() => {
              setHeroBrandDisplay(savedTheme.heroBrandDisplay);
              setHeroEyebrow(savedTheme.heroEyebrow);
              setHeroHeadline(savedTheme.heroHeadline);
              setHeroSubcopy(savedTheme.heroSubcopy);
              setHeroBadgeOne(savedTheme.heroBadgeOne);
              setHeroBadgeTwo(savedTheme.heroBadgeTwo);
              setHeroBadgeThree(savedTheme.heroBadgeThree);
              setError(null);
            }}
          >
            Discard
          </Button>
          <Button type="submit" disabled={!isDirty || saving}>
            {saving ? "Saving..." : "Save hero content"}
          </Button>
        </div>
        <FeedbackMessage type="success" message={message} />
        <FeedbackMessage type="error" message={error} />
      </form>
    </SectionCard>
  );
}
