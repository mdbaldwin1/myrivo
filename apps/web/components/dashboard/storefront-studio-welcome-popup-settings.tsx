"use client";

import { useEffect, useId, useState } from "react";
import { ensureStorefrontSettingsDraft } from "@/components/dashboard/storefront-studio-storefront-editor-panel-utils";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioStorefrontEditorPanelToggleRow } from "@/components/dashboard/storefront-studio-storefront-editor-panel-toggle-row";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { notify } from "@/lib/feedback/toast";

const NO_PROMOTION_VALUE = "__none__";

type PromotionOption = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

type PromotionsResponse = {
  promotions?: PromotionOption[];
  error?: string;
};

function formatPromotionLabel(promotion: PromotionOption) {
  const discountLabel = promotion.discount_type === "percent" ? `${promotion.discount_value}% off` : `$${(promotion.discount_value / 100).toFixed(2)} off`;
  return `${promotion.code} • ${discountLabel}${promotion.is_active ? "" : " • inactive"}`;
}

export function StorefrontStudioWelcomePopupSettings() {
  const document = useOptionalStorefrontStudioDocument();
  const enabledId = useId();
  const [promotions, setPromotions] = useState<PromotionOption[]>([]);
  const [promotionsLoading, setPromotionsLoading] = useState(true);

  useEffect(() => {
    if (!document) {
      return;
    }

    let cancelled = false;
    void (async () => {
      setPromotionsLoading(true);
      const response = await fetch("/api/promotions", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as PromotionsResponse;
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        notify.error(payload.error ?? "Unable to load promotions.");
        setPromotions([]);
        setPromotionsLoading(false);
        return;
      }
      setPromotions(payload.promotions ?? []);
      setPromotionsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [document]);

  if (!document) {
    return null;
  }

  const studioDocument = document;

  const settings = ensureStorefrontSettingsDraft(studioDocument.settingsDraft);

  function patchSettings(patch: Partial<typeof settings>) {
    studioDocument.setSettingsDraft((current) => ({
      ...ensureStorefrontSettingsDraft(current),
      ...patch
    }));
  }

  return (
    <div className="space-y-4">
      <StorefrontStudioStorefrontEditorPanelToggleRow
        label="Enable welcome popup"
        inputId={enabledId}
        description="Show the welcome popup campaign in the storefront preview and for eligible first-time shoppers."
        checked={Boolean(settings.welcome_popup_enabled)}
        onChange={(checked) => patchSettings({ welcome_popup_enabled: checked })}
      />

      {settings.welcome_popup_enabled ? (
        <>
      <FormField label="Promotion" description="Choose the discount code to email after signup.">
        <Select
          value={settings.welcome_popup_promotion_id ?? NO_PROMOTION_VALUE}
          onChange={(event) =>
            patchSettings({
              welcome_popup_promotion_id: event.target.value === NO_PROMOTION_VALUE ? null : event.target.value
            })
          }
          disabled={promotionsLoading}
          placeholder={promotionsLoading ? "Loading promotions..." : "Select a promotion"}
        >
          <option value={NO_PROMOTION_VALUE}>{promotionsLoading ? "Loading promotions..." : "Select a promotion"}</option>
          {promotions.map((promotion) => (
            <option key={promotion.id} value={promotion.id}>
              {formatPromotionLabel(promotion)}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Image layout">
        <Select
          value={settings.welcome_popup_image_layout ?? "left"}
          onChange={(event) =>
            patchSettings({
              welcome_popup_image_layout: event.target.value === "top" ? "top" : "left"
            })
          }
        >
          <option value="left">Image left</option>
          <option value="top">Image top</option>
        </Select>
      </FormField>

      <div className="space-y-4">
        <FormField label="Show delay (seconds)">
          <Input
            type="number"
            min={0}
            max={60}
            value={settings.welcome_popup_delay_seconds ?? 6}
            onChange={(event) =>
              patchSettings({
                welcome_popup_delay_seconds: Math.min(60, Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0))
              })
            }
          />
        </FormField>
        <FormField label="Redisplay after dismissal (days)">
          <Input
            type="number"
            min={1}
            max={365}
            value={settings.welcome_popup_dismiss_days ?? 14}
            onChange={(event) =>
              patchSettings({
                welcome_popup_dismiss_days: Math.min(365, Math.max(1, Number.parseInt(event.target.value || "1", 10) || 1))
              })
            }
          />
        </FormField>
      </div>
        </>
      ) : null}
    </div>
  );
}
