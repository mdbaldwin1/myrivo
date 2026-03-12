"use client";

import * as React from "react";
import { FormField } from "@/components/ui/form-field";
import { Switch } from "@/components/ui/switch";

type StorefrontStudioStorefrontEditorPanelToggleRowProps = {
  label: string;
  inputId: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tone?: "muted" | "default";
};

export function StorefrontStudioStorefrontEditorPanelToggleRow({
  label,
  inputId,
  description,
  checked,
  onChange,
  tone = "muted"
}: StorefrontStudioStorefrontEditorPanelToggleRowProps) {
  return (
    <FormField label={label} inputId={inputId}>
      <div
        className={
          tone === "default"
            ? "flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-white px-3 py-2"
            : "flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 px-3 py-2"
        }
      >
        <p className="text-sm text-muted-foreground">{description}</p>
        <Switch id={inputId} checked={checked} onChange={({ target }) => onChange(target.checked)} />
      </div>
    </FormField>
  );
}
