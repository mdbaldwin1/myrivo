"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Flyout } from "@/components/ui/flyout";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { RowActionButton, RowActions } from "@/components/ui/row-actions";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { StatusChip } from "@/components/ui/status-chip";
import type { PromotionRecord } from "@/types/database";

type PromotionsManagerProps = {
  initialPromotions: Array<
    Pick<
      PromotionRecord,
      | "id"
      | "code"
      | "discount_type"
      | "discount_value"
      | "min_subtotal_cents"
      | "max_redemptions"
      | "times_redeemed"
      | "starts_at"
      | "ends_at"
      | "is_active"
      | "created_at"
    >
  >;
};

type PromotionResponse = {
  promotion?: Pick<
    PromotionRecord,
    | "id"
    | "code"
    | "discount_type"
    | "discount_value"
    | "min_subtotal_cents"
    | "max_redemptions"
    | "times_redeemed"
    | "starts_at"
    | "ends_at"
    | "is_active"
    | "created_at"
  >;
  deleted?: boolean;
  error?: string;
};

export function PromotionsManager({ initialPromotions }: PromotionsManagerProps) {
  const [promotions, setPromotions] = useState(initialPromotions);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<PromotionRecord["discount_type"]>("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [minSubtotalDollars, setMinSubtotalDollars] = useState("0.00");
  const [isCreateFlyoutOpen, setIsCreateFlyoutOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const isCreateDirty =
    code.trim().length > 0 || discountType !== "percent" || discountValue.trim() !== "10" || minSubtotalDollars.trim() !== "0.00";

  function resetCreateDraft() {
    setCode("");
    setDiscountType("percent");
    setDiscountValue("10");
    setMinSubtotalDollars("0.00");
    setCreateError(null);
  }

  async function createPromotion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setCreateError(null);
    setListError(null);

    const minSubtotalCents = Math.round(Number(minSubtotalDollars) * 100);
    const response = await fetch("/api/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        discountType,
        discountValue: Number(discountValue),
        minSubtotalCents,
        isActive: true
      })
    });

    const payload = (await response.json()) as PromotionResponse;
    setSaving(false);

    if (!response.ok || !payload.promotion) {
      setCreateError(payload.error ?? "Unable to create promotion.");
      return;
    }

    setPromotions((current) => [payload.promotion!, ...current]);
    resetCreateDraft();
    setIsCreateFlyoutOpen(false);
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
  }

  return (
    <SectionCard
      title="Promotions"
      action={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" onClick={() => setIsCreateFlyoutOpen(true)}>
            Create promotion
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FeedbackMessage type="error" message={listError} />
        <ul className="space-y-2">
          {promotions.length === 0 ? (
            <li className="rounded-md border border-border bg-white px-3 py-2 text-sm text-muted-foreground">No promotions yet.</li>
          ) : (
            promotions.map((promo) => (
              <li key={promo.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm">
                <span className="font-semibold">{promo.code}</span>
                <Badge variant="outline">
                  {promo.discount_type === "percent" ? `${promo.discount_value}%` : `$${(promo.discount_value / 100).toFixed(2)}`}
                </Badge>
                <span className="text-xs text-muted-foreground">Min ${(promo.min_subtotal_cents / 100).toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">Used {promo.times_redeemed}</span>
                <StatusChip label={promo.is_active ? "active" : "inactive"} tone={promo.is_active ? "success" : "neutral"} />
                <RowActions>
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
        open={isCreateFlyoutOpen}
        onOpenChange={(open) => {
          setIsCreateFlyoutOpen(open);
          if (!open) {
            resetCreateDraft();
          }
        }}
        confirmDiscardOnClose
        isDirty={isCreateDirty}
        onDiscardConfirm={resetCreateDraft}
        title="Create promotion"
        description="Define the discount code and minimum spend requirements."
        footer={({ requestClose }) => (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={requestClose}>
              Close
            </Button>
            <Button type="submit" form="create-promotion-form" disabled={saving}>
              {saving ? "Creating..." : "Create promotion"}
            </Button>
          </div>
        )}
      >
        <form id="create-promotion-form" onSubmit={createPromotion} className="grid gap-3">
          <FeedbackMessage type="error" message={createError} />
          <FormField label="Promo code" description="What customers enter at checkout. Letters and numbers only works best.">
            <Input required placeholder="WELCOME10" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
          </FormField>
          <FormField label="Discount type" description="Choose a percent off or a fixed dollar amount off.">
            <Select value={discountType} onChange={(event) => setDiscountType(event.target.value as PromotionRecord["discount_type"])}>
              <option value="percent">Percent</option>
              <option value="fixed">Fixed amount ($)</option>
            </Select>
          </FormField>
          <FormField
            label={discountType === "percent" ? "Discount percent" : "Discount amount (USD)"}
            description={discountType === "percent" ? "Example: 10 for 10% off." : "Example: 5 for $5 off."}
          >
            <Input
              required
              inputMode="numeric"
              placeholder={discountType === "percent" ? "10" : "5.00"}
              value={discountValue}
              onChange={(event) => setDiscountValue(event.target.value)}
            />
          </FormField>
          <FormField label="Minimum subtotal (USD)" description="Set to 0.00 if there is no minimum order requirement.">
            <Input
              required
              inputMode="decimal"
              placeholder="0.00"
              value={minSubtotalDollars}
              onChange={(event) => setMinSubtotalDollars(event.target.value)}
            />
          </FormField>
        </form>
      </Flyout>
    </SectionCard>
  );
}
