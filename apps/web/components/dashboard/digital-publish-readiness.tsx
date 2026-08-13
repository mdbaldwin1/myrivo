"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildDigitalReadinessActions, type ProductListItem } from "@/components/dashboard/product-manager-domain";

type DigitalPublishReadinessProps = {
  product: ProductListItem;
  onNavigate: (tab: "files" | "media", target: string) => void;
  onEdit: (target: "rights") => void;
  onPublish: () => void | Promise<void>;
};

export function DigitalPublishReadiness({ product, onNavigate, onEdit, onPublish }: DigitalPublishReadinessProps) {
  const readiness = product.digital_readiness;
  if (!readiness) return null;
  const actions = buildDigitalReadinessActions(product, readiness);

  return (
    <section aria-label="Publishing readiness" className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {readiness.ready ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden="true" />
          ) : (
            <CircleAlert className="mt-0.5 h-5 w-5 text-amber-600" aria-hidden="true" />
          )}
          <div>
            <h4 className="font-medium">Publishing readiness</h4>
            <p className="text-xs text-muted-foreground">
              {readiness.ready ? "Ready for your storefront" : `${actions.length} ${actions.length === 1 ? "step" : "steps"} remaining`}
            </p>
          </div>
        </div>
        <Button type="button" size="sm" disabled={!readiness.ready || product.status === "active"} onClick={() => void onPublish()}>
          {product.status === "active" ? "Published" : "Publish product"}
        </Button>
      </div>

      {actions.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {actions.map((action) => (
            <li key={action.reason} className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm">{action.label}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (action.tab) onNavigate(action.tab, action.target);
                  else onEdit("rights");
                }}
              >
                {action.label}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
