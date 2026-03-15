"use client";

import { useMemo, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flyout } from "@/components/ui/flyout";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { RowActionButton, RowActions } from "@/components/ui/row-actions";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { StatusChip } from "@/components/ui/status-chip";
import { notify } from "@/lib/feedback/toast";
import type { PromotionRecord } from "@/types/database";

type PromotionListItem = Pick<
  PromotionRecord,
  | "id"
  | "code"
  | "discount_type"
  | "discount_value"
  | "min_subtotal_cents"
  | "max_redemptions"
  | "per_customer_redemption_limit"
  | "times_redeemed"
  | "starts_at"
  | "ends_at"
  | "is_active"
  | "created_at"
>;

type PromotionsManagerProps = {
  initialPromotions: PromotionListItem[];
};

type PromotionResponse = {
  promotion?: PromotionListItem;
  deleted?: boolean;
  error?: string;
};

type GlobalCapMode = "unlimited" | "custom";
type PerCustomerCapMode = "unlimited" | "once" | "custom";

type PromotionDraft = {
  code: string;
  discountType: PromotionRecord["discount_type"];
  discountValue: string;
  minSubtotalDollars: string;
  maxRedemptionsMode: GlobalCapMode;
  maxRedemptionsValue: string;
  perCustomerCapMode: PerCustomerCapMode;
  perCustomerCapValue: string;
};

function createEmptyDraft(): PromotionDraft {
  return {
    code: "",
    discountType: "percent",
    discountValue: "10",
    minSubtotalDollars: "0.00",
    maxRedemptionsMode: "unlimited",
    maxRedemptionsValue: "",
    perCustomerCapMode: "unlimited",
    perCustomerCapValue: ""
  };
}

function promotionToDraft(promotion: PromotionListItem): PromotionDraft {
  return {
    code: promotion.code,
    discountType: promotion.discount_type,
    discountValue:
      promotion.discount_type === "percent" ? String(promotion.discount_value) : (promotion.discount_value / 100).toFixed(2),
    minSubtotalDollars: (promotion.min_subtotal_cents / 100).toFixed(2),
    maxRedemptionsMode: promotion.max_redemptions === null ? "unlimited" : "custom",
    maxRedemptionsValue: promotion.max_redemptions === null ? "" : String(promotion.max_redemptions),
    perCustomerCapMode:
      promotion.per_customer_redemption_limit === null
        ? "unlimited"
        : promotion.per_customer_redemption_limit === 1
          ? "once"
          : "custom",
    perCustomerCapValue:
      promotion.per_customer_redemption_limit === null || promotion.per_customer_redemption_limit === 1
        ? ""
        : String(promotion.per_customer_redemption_limit)
  };
}

function formatDiscount(promotion: PromotionListItem) {
  return promotion.discount_type === "percent" ? `${promotion.discount_value}%` : `$${(promotion.discount_value / 100).toFixed(2)}`;
}

function formatGlobalCap(limit: number | null) {
  return limit === null ? "Unlimited total" : `${limit} total uses`;
}

function formatPerCustomerCap(limit: number | null) {
  if (limit === null) {
    return "Unlimited per customer";
  }

  if (limit === 1) {
    return "One per customer";
  }

  return `${limit} per customer`;
}

function serializeDraft(draft: PromotionDraft) {
  const maxRedemptions = draft.maxRedemptionsMode === "custom" ? Number.parseInt(draft.maxRedemptionsValue, 10) : null;
  const perCustomerRedemptionLimit =
    draft.perCustomerCapMode === "unlimited"
      ? null
      : draft.perCustomerCapMode === "once"
        ? 1
        : Number.parseInt(draft.perCustomerCapValue, 10);

  return {
    code: draft.code.trim().toUpperCase(),
    discountType: draft.discountType,
    discountValue:
      draft.discountType === "percent" ? Number.parseInt(draft.discountValue, 10) : Math.round(Number(draft.discountValue) * 100),
    minSubtotalCents: Math.round(Number(draft.minSubtotalDollars) * 100),
    maxRedemptions,
    perCustomerRedemptionLimit,
    isActive: true
  };
}

export function PromotionsManager({ initialPromotions }: PromotionsManagerProps) {
  const [promotions, setPromotions] = useState(initialPromotions);
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromotionDraft>(createEmptyDraft());
  const [initialDraft, setInitialDraft] = useState<PromotionDraft>(createEmptyDraft());
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [flyoutError, setFlyoutError] = useState<string | null>(null);
  const isEditMode = Boolean(editingPromotionId);
  const isFlyoutDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initialDraft), [draft, initialDraft]);

  function resetFlyoutState() {
    const empty = createEmptyDraft();
    setDraft(empty);
    setInitialDraft(empty);
    setEditingPromotionId(null);
    setFlyoutError(null);
  }

  function openCreateFlyout() {
    const empty = createEmptyDraft();
    setDraft(empty);
    setInitialDraft(empty);
    setEditingPromotionId(null);
    setFlyoutError(null);
    setIsFlyoutOpen(true);
  }

  function openEditFlyout(promotion: PromotionListItem) {
    const nextDraft = promotionToDraft(promotion);
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setEditingPromotionId(promotion.id);
    setFlyoutError(null);
    setIsFlyoutOpen(true);
  }

  async function submitPromotion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFlyoutError(null);
    setListError(null);

    const payload = serializeDraft(draft);
    const response = await fetch("/api/promotions", {
      method: isEditMode ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isEditMode
          ? {
              promotionId: editingPromotionId,
              ...payload,
              isActive: promotions.find((promotion) => promotion.id === editingPromotionId)?.is_active ?? true
            }
          : payload
      )
    });

    const body = (await response.json()) as PromotionResponse;
    setSaving(false);

    if (!response.ok || !body.promotion) {
      setFlyoutError(body.error ?? `Unable to ${isEditMode ? "update" : "create"} promotion.`);
      return;
    }

    setPromotions((current) =>
      isEditMode ? current.map((item) => (item.id === body.promotion!.id ? body.promotion! : item)) : [body.promotion!, ...current]
    );
    notify.success(isEditMode ? "Promotion updated." : "Promotion created.");
    resetFlyoutState();
    setIsFlyoutOpen(false);
  }

  async function toggleActive(promotionId: string, isActive: boolean) {
    setListError(null);

    const response = await fetch("/api/promotions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promotionId, isActive: !isActive })
    });

    const payload = (await response.json()) as PromotionResponse;

    if (!response.ok || !payload.promotion) {
      setListError(payload.error ?? "Unable to update promotion.");
      return;
    }

    setPromotions((current) => current.map((item) => (item.id === promotionId ? payload.promotion! : item)));
    notify.success(isActive ? "Promotion deactivated." : "Promotion activated.");
  }

  async function removePromotion(promotionId: string) {
    setListError(null);

    const response = await fetch("/api/promotions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promotionId })
    });

    const payload = (await response.json()) as PromotionResponse;

    if (!response.ok || !payload.deleted) {
      setListError(payload.error ?? "Unable to remove promotion.");
      return;
    }

    setPromotions((current) => current.filter((item) => item.id !== promotionId));
    notify.success("Promotion removed.");
  }

  return (
    <SectionCard
      title="Promotion List"
      description="Review active and inactive promo codes, monitor usage, and manage availability."
      action={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" onClick={openCreateFlyout}>
            Create promotion
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <AppAlert variant="error" message={listError} />
        <ul className="space-y-2">
          {promotions.length === 0 ? (
            <li className="rounded-md border border-border bg-white px-3 py-2 text-sm text-muted-foreground">No promotions yet.</li>
          ) : (
            promotions.map((promo) => (
              <li key={promo.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm">
                <span className="font-semibold">{promo.code}</span>
                <Badge variant="outline">{formatDiscount(promo)}</Badge>
                <span className="text-xs text-muted-foreground">Min ${(promo.min_subtotal_cents / 100).toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">{formatGlobalCap(promo.max_redemptions)}</span>
                <span className="text-xs text-muted-foreground">{formatPerCustomerCap(promo.per_customer_redemption_limit)}</span>
                <span className="text-xs text-muted-foreground">Used {promo.times_redeemed}</span>
                <StatusChip label={promo.is_active ? "active" : "inactive"} tone={promo.is_active ? "success" : "neutral"} />
                <RowActions>
                  <RowActionButton type="button" onClick={() => openEditFlyout(promo)}>
                    Edit
                  </RowActionButton>
                  <RowActionButton type="button" onClick={() => void toggleActive(promo.id, promo.is_active)}>
                    {promo.is_active ? "Deactivate" : "Activate"}
                  </RowActionButton>
                  <RowActionButton type="button" variant="destructive" onClick={() => void removePromotion(promo.id)}>
                    Delete
                  </RowActionButton>
                </RowActions>
              </li>
            ))
          )}
        </ul>
      </div>
      <Flyout
        open={isFlyoutOpen}
        onOpenChange={(open) => {
          setIsFlyoutOpen(open);
          if (!open) {
            resetFlyoutState();
          }
        }}
        confirmDiscardOnClose
        isDirty={isFlyoutDirty}
        onDiscardConfirm={resetFlyoutState}
        title={isEditMode ? "Edit promotion" : "Create promotion"}
        description="Define the discount code, order minimum, and redemption rules."
        footer={({ requestClose }) => (
          <div className="flex items-center justify-between gap-3">
            <AppAlert compact variant="error" message={flyoutError} className="text-sm" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={requestClose}>
                Close
              </Button>
              <Button type="submit" form="promotion-form" disabled={saving}>
                {saving ? (isEditMode ? "Saving..." : "Creating...") : isEditMode ? "Save promotion" : "Create promotion"}
              </Button>
            </div>
          </div>
        )}
      >
        <form id="promotion-form" onSubmit={submitPromotion} className="grid gap-3">
          <FormField label="Promo code" description="What customers enter at checkout. Letters and numbers only works best.">
            <Input required placeholder="WELCOME10" value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.toUpperCase() }))} />
          </FormField>
          <FormField label="Discount type" description="Choose a percent off or a fixed dollar amount off.">
            <Select value={draft.discountType} onChange={(event) => setDraft((current) => ({ ...current, discountType: event.target.value as PromotionRecord["discount_type"] }))}>
              <option value="percent">Percent</option>
              <option value="fixed">Fixed amount ($)</option>
            </Select>
          </FormField>
          <FormField
            label={draft.discountType === "percent" ? "Discount percent" : "Discount amount (USD)"}
            description={draft.discountType === "percent" ? "Example: 10 for 10% off." : "Example: 5.00 for $5 off."}
          >
            <Input
              required
              inputMode="numeric"
              placeholder={draft.discountType === "percent" ? "10" : "5.00"}
              value={draft.discountValue}
              onChange={(event) => setDraft((current) => ({ ...current, discountValue: event.target.value }))}
            />
          </FormField>
          <FormField label="Minimum subtotal (USD)" description="Set to 0.00 if there is no minimum order requirement.">
            <Input
              required
              inputMode="decimal"
              placeholder="0.00"
              value={draft.minSubtotalDollars}
              onChange={(event) => setDraft((current) => ({ ...current, minSubtotalDollars: event.target.value }))}
            />
          </FormField>
          <FormField label="Total redemption cap" description="Limit how many times this promo can be used across all customers.">
            <Select
              value={draft.maxRedemptionsMode}
              onChange={(event) => setDraft((current) => ({ ...current, maxRedemptionsMode: event.target.value as GlobalCapMode }))}
            >
              <option value="unlimited">Unlimited</option>
              <option value="custom">Custom total limit</option>
            </Select>
          </FormField>
          {draft.maxRedemptionsMode === "custom" ? (
            <FormField label="Total redemption limit" description="How many successful orders can use this promo in total.">
              <Input
                required
                inputMode="numeric"
                placeholder="100"
                value={draft.maxRedemptionsValue}
                onChange={(event) => setDraft((current) => ({ ...current, maxRedemptionsValue: event.target.value }))}
              />
            </FormField>
          ) : null}
          <FormField label="Per-customer cap" description="Limit how many times the same customer can redeem this promo.">
            <Select
              value={draft.perCustomerCapMode}
              onChange={(event) => setDraft((current) => ({ ...current, perCustomerCapMode: event.target.value as PerCustomerCapMode }))}
            >
              <option value="unlimited">Unlimited</option>
              <option value="once">One per customer</option>
              <option value="custom">Custom customer limit</option>
            </Select>
          </FormField>
          {draft.perCustomerCapMode === "custom" ? (
            <FormField label="Per-customer redemption limit" description="How many successful orders the same customer can place with this promo.">
              <Input
                required
                inputMode="numeric"
                placeholder="2"
                value={draft.perCustomerCapValue}
                onChange={(event) => setDraft((current) => ({ ...current, perCustomerCapValue: event.target.value }))}
              />
            </FormField>
          ) : null}
        </form>
      </Flyout>
    </SectionCard>
  );
}
