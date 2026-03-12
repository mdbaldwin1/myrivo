"use client";

import type { ReactNode } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import {
  createId,
  getBooleanValue,
  getNumberValue,
  getStringValue,
  parseContentBlocks,
  type ContentBlockDraft
} from "@/components/dashboard/store-experience-form-utils";
import { setAtPath, useStoreExperienceSection } from "@/components/dashboard/use-store-experience-section";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ContentWorkspaceHomeFormProps = {
  header?: ReactNode;
};

export function ContentWorkspaceHomeForm({ header }: ContentWorkspaceHomeFormProps) {
  const formId = "content-workspace-home-form";
  const { loading, saving, draft, setDraft, error, isDirty, save, discard } = useStoreExperienceSection("home");
  const contentBlocks = parseContentBlocks(draft.contentBlocks);

  const showPolicyStrip = getBooleanValue(draft, "visibility.showPolicyStrip", true);
  const showHero = getBooleanValue(draft, "visibility.showHero", true);
  const showContentBlocks = getBooleanValue(draft, "visibility.showContentBlocks", true);
  const showFeaturedProducts = getBooleanValue(draft, "visibility.showFeaturedProducts", true);

  const normalizeContentBlockOrder = (blocks: ContentBlockDraft[]) =>
    blocks.map((entry, index) => ({ ...entry, sortOrder: index }));

  const moveContentBlock = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= contentBlocks.length) {
      return;
    }
    const next = [...contentBlocks];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) {
      return;
    }
    next.splice(toIndex, 0, moved);
    setDraft((current) => setAtPath(current, "contentBlocks", normalizeContentBlockOrder(next)));
  };

  return (
    <form
      id={formId}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value === "discard") {
          discard();
          return;
        }
        void save();
      }}
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {header}

        <SectionCard title="Top-Level Messaging" description="Announcement and fulfillment messaging shown across storefront views.">
          {loading ? <p className="text-sm text-muted-foreground">Loading section...</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              className="sm:col-span-2"
              label="Show Policy Strip and Announcement Bar"
              description="Displays the top announcement/policy strip on home."
            >
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showPolicyStrip}
                  onChange={(event) => setDraft((current) => setAtPath(current, "visibility.showPolicyStrip", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            {showPolicyStrip ? (
              <FormField className="sm:col-span-2" label="Announcement Bar Text" description="Short strip shown at the top of storefront pages.">
                <Input
                  value={getStringValue(draft, "announcement")}
                  onChange={(event) => setDraft((current) => setAtPath(current, "announcement", event.target.value))}
                />
              </FormField>
            ) : (
              <p className="sm:col-span-2 text-sm text-muted-foreground">Policy strip is hidden on the home page.</p>
            )}

            <FormField className="sm:col-span-2" label="Fulfillment Message" description="Shipping/pickup expectations shown in hero/about areas.">
              <Textarea
                rows={3}
                value={getStringValue(draft, "fulfillmentMessage")}
                onChange={(event) => setDraft((current) => setAtPath(current, "fulfillmentMessage", event.target.value))}
              />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title="Hero" description="Headline area content and brand display controls.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField className="sm:col-span-2" label="Show Hero" description="Controls visibility of the hero section.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showHero}
                  onChange={(event) => setDraft((current) => setAtPath(current, "visibility.showHero", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            {showHero ? (
              <>
                <FormField label="Hero Brand Display" description="Choose how branding renders in the hero.">
                  <Select
                    value={getStringValue(draft, "hero.brandDisplay", "title")}
                    onChange={(event) => setDraft((current) => setAtPath(current, "hero.brandDisplay", event.target.value))}
                  >
                    <option value="title">Store title</option>
                    <option value="logo">Logo</option>
                    <option value="logo_and_title">Logo + title</option>
                  </Select>
                </FormField>
                <FormField label="Hero Eyebrow" description="Short overline text above the hero headline.">
                  <Input
                    value={getStringValue(draft, "hero.eyebrow")}
                    onChange={(event) => setDraft((current) => setAtPath(current, "hero.eyebrow", event.target.value))}
                  />
                </FormField>
                <FormField className="sm:col-span-2" label="Hero Headline" description="Primary headline shown prominently in the hero section.">
                  <Input
                    value={getStringValue(draft, "hero.headline")}
                    onChange={(event) => setDraft((current) => setAtPath(current, "hero.headline", event.target.value))}
                  />
                </FormField>
                <FormField className="sm:col-span-2" label="Hero Subcopy" description="Supporting text displayed below the hero headline.">
                  <Textarea
                    rows={3}
                    value={getStringValue(draft, "hero.subcopy")}
                    onChange={(event) => setDraft((current) => setAtPath(current, "hero.subcopy", event.target.value))}
                  />
                </FormField>
                <FormField label="Hero Badge 1" description="Short value prop shown in badge slot one.">
                  <Input
                    value={getStringValue(draft, "hero.badgeOne")}
                    onChange={(event) => setDraft((current) => setAtPath(current, "hero.badgeOne", event.target.value))}
                  />
                </FormField>
                <FormField label="Hero Badge 2" description="Short value prop shown in badge slot two.">
                  <Input
                    value={getStringValue(draft, "hero.badgeTwo")}
                    onChange={(event) => setDraft((current) => setAtPath(current, "hero.badgeTwo", event.target.value))}
                  />
                </FormField>
                <FormField className="sm:col-span-2" label="Hero Badge 3" description="Short value prop shown in badge slot three.">
                  <Input
                    value={getStringValue(draft, "hero.badgeThree")}
                    onChange={(event) => setDraft((current) => setAtPath(current, "hero.badgeThree", event.target.value))}
                  />
                </FormField>
              </>
            ) : (
              <p className="sm:col-span-2 text-sm text-muted-foreground">Hero section is hidden on the home page.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Content Blocks" description="Reusable informational blocks shown below the hero.">
          <div className="space-y-3">
            <FormField label="Show Content Blocks" description="Controls visibility of reusable content blocks.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showContentBlocks}
                  onChange={(event) => setDraft((current) => setAtPath(current, "visibility.showContentBlocks", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            {showContentBlocks ? (
              <>
                <FormField label="Content Blocks Heading" description="Section heading displayed above home content blocks.">
                  <Input
                    value={getStringValue(draft, "copy.home.contentBlocksHeading")}
                    onChange={(event) => setDraft((current) => setAtPath(current, "copy.home.contentBlocksHeading", event.target.value))}
                  />
                </FormField>

                {contentBlocks.map((block, index) => (
                  <div key={block.id} className="space-y-2 rounded-md border border-border/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">Block {index + 1}</p>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => moveContentBlock(index, index - 1)}>
                          Up
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={index === contentBlocks.length - 1}
                          onClick={() => moveContentBlock(index, index + 1)}
                        >
                          Down
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const next = contentBlocks.filter((entry) => entry.id !== block.id);
                            setDraft((current) => setAtPath(current, "contentBlocks", normalizeContentBlockOrder(next)));
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <FormField label="Eyebrow" description="Optional short intro text for this block.">
                        <Input
                          value={block.eyebrow}
                          onChange={(event) => {
                            const next = contentBlocks.map((entry) => (entry.id === block.id ? { ...entry, eyebrow: event.target.value } : entry));
                            setDraft((current) => setAtPath(current, "contentBlocks", next));
                          }}
                        />
                      </FormField>
                      <FormField label="Sort Order" description="Lower numbers appear first.">
                        <Input
                          type="number"
                          value={block.sortOrder}
                          onChange={(event) => {
                            const next = contentBlocks.map((entry) =>
                              entry.id === block.id ? { ...entry, sortOrder: Number.parseInt(event.target.value || "0", 10) || 0 } : entry
                            );
                            setDraft((current) => setAtPath(current, "contentBlocks", next));
                          }}
                        />
                      </FormField>
                      <FormField className="sm:col-span-2" label="Title" description="Main heading for this content block.">
                        <Input
                          value={block.title}
                          onChange={(event) => {
                            const next = contentBlocks.map((entry) => (entry.id === block.id ? { ...entry, title: event.target.value } : entry));
                            setDraft((current) => setAtPath(current, "contentBlocks", next));
                          }}
                        />
                      </FormField>
                      <FormField className="sm:col-span-2" label="Body" description="Supporting text shown under the block title.">
                        <Textarea
                          rows={3}
                          value={block.body}
                          onChange={(event) => {
                            const next = contentBlocks.map((entry) => (entry.id === block.id ? { ...entry, body: event.target.value } : entry));
                            setDraft((current) => setAtPath(current, "contentBlocks", next));
                          }}
                        />
                      </FormField>
                      <FormField label="CTA Label" description="Button text for this block call to action.">
                        <Input
                          value={block.ctaLabel}
                          onChange={(event) => {
                            const next = contentBlocks.map((entry) => (entry.id === block.id ? { ...entry, ctaLabel: event.target.value } : entry));
                            setDraft((current) => setAtPath(current, "contentBlocks", next));
                          }}
                        />
                      </FormField>
                      <FormField label="CTA URL" description="Destination URL for this block CTA.">
                        <Input
                          value={block.ctaUrl}
                          onChange={(event) => {
                            const next = contentBlocks.map((entry) => (entry.id === block.id ? { ...entry, ctaUrl: event.target.value } : entry));
                            setDraft((current) => setAtPath(current, "contentBlocks", next));
                          }}
                        />
                      </FormField>
                      <FormField className="sm:col-span-2" label="Active" description="Inactive blocks are hidden from storefront but kept in draft.">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={block.isActive}
                            onChange={(event) => {
                              const next = contentBlocks.map((entry) => (entry.id === block.id ? { ...entry, isActive: event.target.checked } : entry));
                              setDraft((current) => setAtPath(current, "contentBlocks", next));
                            }}
                          />
                          Enabled
                        </label>
                      </FormField>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const next: ContentBlockDraft[] = [
                      ...contentBlocks,
                      {
                        id: createId("block"),
                        sortOrder: contentBlocks.length,
                        eyebrow: "",
                        title: "",
                        body: "",
                        ctaLabel: "",
                        ctaUrl: "",
                        isActive: true
                      }
                    ];
                    setDraft((current) => setAtPath(current, "contentBlocks", normalizeContentBlockOrder(next)));
                  }}
                >
                  Add content block
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Content blocks are hidden on the home page.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Featured Products" description="Configure the featured products section shown on home.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField className="sm:col-span-2" label="Show Featured Products" description="Controls visibility of featured products on home.">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showFeaturedProducts}
                  onChange={(event) => setDraft((current) => setAtPath(current, "visibility.showFeaturedProducts", event.target.checked))}
                />
                Enabled
              </label>
            </FormField>

            {showFeaturedProducts ? (
              <>
                <FormField label="Featured Products Heading" description="Section heading displayed above featured products.">
                  <Input
                    value={getStringValue(draft, "copy.home.featuredProductsHeading")}
                    onChange={(event) => setDraft((current) => setAtPath(current, "copy.home.featuredProductsHeading", event.target.value))}
                  />
                </FormField>
                <FormField label="Featured Products Limit" description="Maximum number of featured products shown on home.">
                  <Input
                    type="number"
                    value={getNumberValue(draft, "visibility.featuredProductsLimit", 6)}
                    onChange={(event) =>
                      setDraft((current) =>
                        setAtPath(current, "visibility.featuredProductsLimit", Number.parseInt(event.target.value || "0", 10) || 0)
                      )
                    }
                  />
                </FormField>
              </>
            ) : (
              <p className="sm:col-span-2 text-sm text-muted-foreground">Featured products are hidden on the home page.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Home Copy" description="Edit customer-facing CTA text used across the home page.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Shop Products CTA" description="Button label linking shoppers from home to products.">
              <Input
                value={getStringValue(draft, "copy.home.shopProductsCta")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.home.shopProductsCta", event.target.value))}
              />
            </FormField>
            <FormField label="About Brand CTA" description="Button label linking shoppers from home to your brand story.">
              <Input
                value={getStringValue(draft, "copy.home.aboutBrandCta")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.home.aboutBrandCta", event.target.value))}
              />
            </FormField>
          </div>
        </SectionCard>

      </div>
      <DashboardFormActionBar
        formId={formId}
        saveLabel="Save"
        savePendingLabel="Saving..."
        discardLabel="Discard"
        savePending={saving}
        saveDisabled={!isDirty || saving || loading}
        discardDisabled={!isDirty || saving || loading}
        statusMessage={error}
        statusVariant="error"
      />
    </form>
  );
}
