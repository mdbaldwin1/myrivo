"use client";

import { Button } from "@/components/ui/button";
import {
  storefrontStudioDigitalScenarioIds,
  type StorefrontStudioDigitalScenarioId,
} from "@/lib/store-editor/storefront-studio-digital-scenarios";

export function StorefrontStudioDigitalScenarioPicker({ value, onChange }: {
  value: StorefrontStudioDigitalScenarioId;
  onChange: (value: StorefrontStudioDigitalScenarioId) => void;
}) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Digital preview</p>
      <div className="flex gap-2">
        {storefrontStudioDigitalScenarioIds.map((id) => (
          <Button key={id} size="sm" variant={id === value ? "default" : "outline"} onClick={() => onChange(id)}>
            {id === "digitalOnly" ? "Digital only" : "Mixed"}
          </Button>
        ))}
      </div>
    </div>
  );
}
