"use client";

import { useId } from "react";
import { ensureStorefrontSettingsDraft } from "@/components/dashboard/storefront-studio-storefront-editor-panel-utils";
import { useOptionalStorefrontStudioDocument } from "@/components/dashboard/storefront-studio-document-provider";
import { StorefrontStudioStorefrontEditorPanelToggleRow } from "@/components/dashboard/storefront-studio-storefront-editor-panel-toggle-row";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function StorefrontStudioStoreAlertSettings() {
  const document = useOptionalStorefrontStudioDocument();
  const enabledId = useId();

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
        label="Enable store alert popup"
        inputId={enabledId}
        description="Show a one-time popup with a custom message on every storefront page. Use for fulfillment delays or store-wide notices."
        checked={Boolean(settings.store_alert_enabled)}
        onChange={(checked) => patchSettings({ store_alert_enabled: checked })}
      />

      {settings.store_alert_enabled ? (
        <>
          <FormField label="Title (optional)" description="Short header shown above the message.">
            <Input
              type="text"
              maxLength={120}
              value={settings.store_alert_title ?? ""}
              placeholder="e.g. Heads up"
              onChange={(event) => patchSettings({ store_alert_title: event.target.value || null })}
            />
          </FormField>

          <FormField label="Message" description="The body text shown to shoppers. Required when the alert is enabled.">
            <Textarea
              rows={4}
              maxLength={500}
              value={settings.store_alert_message ?? ""}
              placeholder="e.g. Orders placed now will be fulfilled at the end of May."
              onChange={(event) => patchSettings({ store_alert_message: event.target.value || null })}
            />
          </FormField>

          <FormField label="Show delay (seconds)" description="How long to wait after page load before showing.">
            <Input
              type="number"
              min={0}
              max={60}
              value={settings.store_alert_delay_seconds ?? 8}
              onChange={(event) =>
                patchSettings({
                  store_alert_delay_seconds: Math.min(60, Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0))
                })
              }
            />
          </FormField>

          <FormField label="Redisplay after dismissal (days)" description="Skip the popup for this many days after a shopper dismisses it.">
            <Input
              type="number"
              min={1}
              max={365}
              value={settings.store_alert_dismiss_days ?? 7}
              onChange={(event) =>
                patchSettings({
                  store_alert_dismiss_days: Math.min(365, Math.max(1, Number.parseInt(event.target.value || "1", 10) || 1))
                })
              }
            />
          </FormField>
        </>
      ) : null}
    </div>
  );
}
