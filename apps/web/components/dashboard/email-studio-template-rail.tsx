"use client";

import { AlertCircle, CreditCard, Mail, MapPinned, PackageCheck, PackageOpen, Scale, Truck, UserRound, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailStudioTemplateDocument, EmailStudioTemplateId } from "@/lib/email-studio/model";

const templateIcons = {
  customerConfirmation: PackageCheck,
  ownerNewOrder: UserRound,
  pickupUpdated: MapPinned,
  shippingDelay: Truck,
  refundIssued: CreditCard,
  disputeOpened: Scale,
  disputeResolved: Scale,
  failed: AlertCircle,
  cancelled: XCircle,
  shipped: Truck,
  delivered: PackageOpen
} as const;

type EmailStudioTemplateRailProps = {
  templates: Record<EmailStudioTemplateId, EmailStudioTemplateDocument>;
  activeTemplateId: EmailStudioTemplateId;
  onSelect: (templateId: EmailStudioTemplateId) => void;
};

export function EmailStudioTemplateRail({
  templates,
  activeTemplateId,
  onSelect
}: EmailStudioTemplateRailProps) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-white shadow-sm xl:h-full xl:w-[20rem]">
      <div className="border-b border-border/70 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Email types</p>
            <p className="text-xs text-muted-foreground">Pick the lifecycle email you want to compose.</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {Object.values(templates).map((template) => {
          const Icon = templateIcons[template.id];
          const isActive = template.id === activeTemplateId;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template.id)}
              className={cn(
                "w-full rounded-xl border px-3 py-3 text-left transition",
                isActive ? "border-primary/30 bg-primary text-primary-foreground shadow-sm" : "border-border/70 bg-background hover:border-primary/20 hover:bg-primary/5"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("rounded-lg p-2", isActive ? "bg-white/15" : "bg-primary/10 text-primary")}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">{template.label}</p>
                  <p className={cn("text-xs leading-relaxed", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {template.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
