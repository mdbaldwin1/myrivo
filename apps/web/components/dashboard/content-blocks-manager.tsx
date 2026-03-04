"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Flyout } from "@/components/ui/flyout";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RowActionButton, RowActions } from "@/components/ui/row-actions";
import { SectionCard } from "@/components/ui/section-card";
import { Textarea } from "@/components/ui/textarea";
import type { StoreContentBlockRecord } from "@/types/database";

type ContentBlocksManagerProps = {
  initialBlocks: Array<
    Pick<StoreContentBlockRecord, "id" | "sort_order" | "eyebrow" | "title" | "body" | "cta_label" | "cta_url" | "is_active">
  >;
};

type ContentBlockInput = {
  id?: string;
  sortOrder: number;
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  isActive: boolean;
};

type ContentBlocksResponse = {
  blocks?: Array<
    Pick<StoreContentBlockRecord, "id" | "sort_order" | "eyebrow" | "title" | "body" | "cta_label" | "cta_url" | "is_active">
  >;
  error?: string;
};

function toInput(block: Pick<StoreContentBlockRecord, "id" | "sort_order" | "eyebrow" | "title" | "body" | "cta_label" | "cta_url" | "is_active">): ContentBlockInput {
  return {
    id: block.id,
    sortOrder: block.sort_order,
    eyebrow: block.eyebrow ?? "",
    title: block.title,
    body: block.body,
    ctaLabel: block.cta_label ?? "",
    ctaUrl: block.cta_url ?? "",
    isActive: block.is_active
  };
}

function createDefaultBlock(nextOrder: number): ContentBlockInput {
  return {
    sortOrder: nextOrder,
    eyebrow: "",
    title: "",
    body: "",
    ctaLabel: "",
    ctaUrl: "",
    isActive: true
  };
}

export function ContentBlocksManager({ initialBlocks }: ContentBlocksManagerProps) {
  const [blocks, setBlocks] = useState<ContentBlockInput[]>(initialBlocks.map(toInput));
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<ContentBlockInput>(createDefaultBlock(0));
  const [flyoutBaseline, setFlyoutBaseline] = useState<ContentBlockInput | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const isDirty = isFlyoutOpen && flyoutBaseline !== null && JSON.stringify(draft) !== JSON.stringify(flyoutBaseline);

  function restoreDraftFromBaseline() {
    if (flyoutBaseline) {
      setDraft(flyoutBaseline);
    }
    setDraftError(null);
  }

  function openCreateFlyout() {
    const nextOrder = blocks.length === 0 ? 0 : Math.max(...blocks.map((block) => block.sortOrder)) + 1;
    setEditingIndex(null);
    const nextDraft = createDefaultBlock(nextOrder);
    setDraft(nextDraft);
    setFlyoutBaseline(nextDraft);
    setDraftError(null);
    setIsFlyoutOpen(true);
  }

  function openEditFlyout(index: number) {
    const selected = blocks[index];
    if (!selected) {
      return;
    }

    setEditingIndex(index);
    const nextDraft = { ...selected };
    setDraft(nextDraft);
    setFlyoutBaseline(nextDraft);
    setDraftError(null);
    setIsFlyoutOpen(true);
  }

  async function persistBlocks(nextBlocks: ContentBlockInput[], successMessage: string, errorScope: "list" | "flyout" = "list") {
    setSaving(true);
    setListError(null);
    setDraftError(null);
    setMessage(null);

    const response = await fetch("/api/stores/content-blocks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: nextBlocks.map((block) => ({
          id: block.id,
          sortOrder: block.sortOrder,
          eyebrow: block.eyebrow.trim() || null,
          title: block.title.trim(),
          body: block.body.trim(),
          ctaLabel: block.ctaLabel.trim() || null,
          ctaUrl: block.ctaUrl.trim() || null,
          isActive: block.isActive
        }))
      })
    });

    const payload = (await response.json()) as ContentBlocksResponse;
    setSaving(false);

    if (!response.ok || !payload.blocks) {
      const message = payload.error ?? "Unable to save content blocks.";
      if (errorScope === "flyout") {
        setDraftError(message);
      } else {
        setListError(message);
      }
      return false;
    }

    setBlocks(payload.blocks.map(toInput));
    setMessage(successMessage);
    return true;
  }

  async function commitDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDraftError(null);

    if (draft.title.trim().length < 2) {
      setDraftError("Title must be at least 2 characters.");
      return;
    }

    if (draft.body.trim().length < 2) {
      setDraftError("Body must be at least 2 characters.");
      return;
    }

    const hasCtaLabel = Boolean(draft.ctaLabel.trim());
    const hasCtaUrl = Boolean(draft.ctaUrl.trim());

    if (hasCtaLabel !== hasCtaUrl) {
      setDraftError("Enter both CTA label and CTA URL, or leave both blank.");
      return;
    }

    const normalizedDraft: ContentBlockInput = {
      ...draft,
      title: draft.title.trim(),
      body: draft.body.trim(),
      eyebrow: draft.eyebrow.trim(),
      ctaLabel: draft.ctaLabel.trim(),
      ctaUrl: draft.ctaUrl.trim()
    };

    const nextBlocks =
      editingIndex === null
        ? [...blocks, normalizedDraft]
        : blocks.map((block, index) => (index === editingIndex ? normalizedDraft : block));

    const success = await persistBlocks(nextBlocks, editingIndex === null ? "Content block added." : "Content block updated.", "flyout");
    if (!success) {
      return;
    }

    setIsFlyoutOpen(false);
  }

  async function removeBlock(index: number) {
    const nextBlocks = blocks.filter((_, blockIndex) => blockIndex !== index);
    await persistBlocks(nextBlocks, "Content block removed.", "list");
  }

  return (
    <SectionCard
      title="Storefront Content Blocks"
      action={
        <Button type="button" variant="outline" size="sm" onClick={openCreateFlyout}>
          Add block
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Add or edit blocks in the flyout, then click <span className="font-medium">Save content blocks</span> to publish them to the storefront.
        </p>
        {blocks.length === 0 ? <p className="text-sm text-muted-foreground">No content blocks yet.</p> : null}

        <div className="space-y-2">
          {blocks
            .slice()
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((block) => {
              const index = blocks.findIndex((candidate) => candidate === block);

              return (
                <article key={block.id ?? `new-${index}`} className="rounded-md border border-border bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Order {block.sortOrder}</p>
                      <h4 className="text-sm font-semibold">{block.title || "Untitled block"}</h4>
                      {block.eyebrow ? <p className="text-xs text-muted-foreground">{block.eyebrow}</p> : null}
                      <p className="line-clamp-2 text-xs text-muted-foreground">{block.body}</p>
                    </div>
                    <RowActions className="gap-1" align="start">
                      <RowActionButton type="button" onClick={() => openEditFlyout(index)}>
                        Edit
                      </RowActionButton>
                      <RowActionButton type="button" variant="destructive" onClick={() => void removeBlock(index)} disabled={saving}>
                        Remove
                      </RowActionButton>
                    </RowActions>
                  </div>
                </article>
              );
            })}
        </div>

        <FeedbackMessage type="error" message={listError} />
        <FeedbackMessage type="success" message={message} />
      </div>

      <Flyout
        open={isFlyoutOpen}
        onOpenChange={(open) => {
          setIsFlyoutOpen(open);
          if (!open) {
            setDraftError(null);
          }
        }}
        confirmDiscardOnClose
        isDirty={isDirty}
        onDiscardConfirm={restoreDraftFromBaseline}
        title={editingIndex === null ? "Create content block" : "Edit content block"}
        description="Use content blocks to highlight your process, ingredients, or seasonal updates."
        footer={({ requestClose }) => (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={requestClose}>
              Close
            </Button>
            <Button type="submit" form="content-block-form" disabled={saving}>
              {saving ? "Saving..." : editingIndex === null ? "Add block" : "Save changes"}
            </Button>
          </div>
        )}
      >
        <form id="content-block-form" className="space-y-4" onSubmit={commitDraft}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Sort order" description="Lower numbers appear earlier on the storefront.">
              <Input
                type="number"
                placeholder="0"
                value={draft.sortOrder}
                onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
              />
            </FormField>
            <FormField label="Eyebrow">
              <Input
                placeholder="Seasonal release"
                value={draft.eyebrow}
                onChange={(event) => setDraft((current) => ({ ...current, eyebrow: event.target.value }))}
              />
            </FormField>
          </div>

          <FormField label="Title">
            <Input placeholder="Hand-poured with care" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
          </FormField>

          <FormField label="Body">
            <Textarea
              rows={4}
              placeholder="Share what makes this collection special."
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
            />
          </FormField>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="CTA label (optional)">
              <Input
                placeholder="Shop bestsellers"
                value={draft.ctaLabel}
                onChange={(event) => setDraft((current) => ({ ...current, ctaLabel: event.target.value }))}
              />
            </FormField>
            <FormField label="CTA URL (optional)" description="Supports anchors (`#products`), relative paths (`/faq`), and full URLs.">
              <Input
                placeholder="#products or https://..."
                value={draft.ctaUrl}
                onChange={(event) => setDraft((current) => ({ ...current, ctaUrl: event.target.value }))}
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={draft.isActive} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))} />
            Show this block on storefront
          </label>

          <FeedbackMessage type="error" message={draftError} />
        </form>
      </Flyout>
    </SectionCard>
  );
}
