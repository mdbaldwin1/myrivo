"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { notify } from "@/lib/feedback/toast";
import { buildStorefrontShareUrl } from "@/lib/analytics/share-links";

type StorefrontShareLinkBuilderProps = {
  appUrl: string;
  storeSlug: string;
  primaryDomain?: string | null;
};

const DESTINATION_OPTIONS = [
  { value: "/", label: "Homepage" },
  { value: "/products", label: "Products" },
  { value: "/about", label: "About" },
  { value: "/cart", label: "Cart" },
  { value: "custom", label: "Custom path" }
] as const;

export function StorefrontShareLinkBuilder({ appUrl, storeSlug, primaryDomain }: StorefrontShareLinkBuilderProps) {
  const [destinationPreset, setDestinationPreset] = useState<(typeof DESTINATION_OPTIONS)[number]["value"]>("/");
  const [customPath, setCustomPath] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmTerm, setUtmTerm] = useState("");
  const [utmContent, setUtmContent] = useState("");

  const destinationPath = destinationPreset === "custom" ? customPath : destinationPreset;
  const shareUrl = useMemo(
    () =>
      buildStorefrontShareUrl({
        appUrl,
        storeSlug,
        primaryDomain,
        destinationPath,
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent
      }),
    [appUrl, destinationPath, primaryDomain, storeSlug, utmCampaign, utmContent, utmMedium, utmSource, utmTerm]
  );

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    notify.success("Share link copied.");
  }

  return (
    <article className="rounded-md border border-border/70 bg-card p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Campaign Share Link Builder</h3>
        <p className="text-xs text-muted-foreground">
          Build a tagged storefront link for social, email, or SMS. These UTM tags show up in first-touch acquisition reporting.
        </p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="share-link-destination">Destination</Label>
          <Select
            id="share-link-destination"
            value={destinationPreset}
            onChange={(event) => setDestinationPreset(event.target.value as (typeof DESTINATION_OPTIONS)[number]["value"])}
          >
            {DESTINATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="share-link-source">UTM source</Label>
          <Input id="share-link-source" placeholder="instagram" value={utmSource} onChange={(event) => setUtmSource(event.target.value)} />
        </div>

        {destinationPreset === "custom" ? (
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="share-link-custom-path">Custom path</Label>
            <Input
              id="share-link-custom-path"
              placeholder="/products/lip-balm"
              value={customPath}
              onChange={(event) => setCustomPath(event.target.value)}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="share-link-medium">UTM medium</Label>
          <Input id="share-link-medium" placeholder="social" value={utmMedium} onChange={(event) => setUtmMedium(event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="share-link-campaign">UTM campaign</Label>
          <Input
            id="share-link-campaign"
            placeholder="spring-launch"
            value={utmCampaign}
            onChange={(event) => setUtmCampaign(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="share-link-term">UTM term</Label>
          <Input id="share-link-term" placeholder="tallow balm" value={utmTerm} onChange={(event) => setUtmTerm(event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="share-link-content">UTM content</Label>
          <Input id="share-link-content" placeholder="story-frame-1" value={utmContent} onChange={(event) => setUtmContent(event.target.value)} />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="share-link-preview">Share URL</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="share-link-preview" readOnly value={shareUrl} className="font-mono text-xs" />
          <Button type="button" variant="outline" onClick={() => void handleCopy()}>
            Copy link
          </Button>
        </div>
      </div>
    </article>
  );
}
