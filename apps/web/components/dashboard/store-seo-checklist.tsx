import Link from "next/link";
import { SectionCard } from "@/components/ui/section-card";

type StoreSeoChecklistProps = {
  storeSlug: string;
  hasVerifiedPrimaryDomain: boolean;
  activeProductCount: number;
  activeProductsMissingImageAltCount: number;
  hasStoreSeoTitle: boolean;
  hasStoreSeoDescription: boolean;
};

function statusLabel(ready: boolean) {
  return ready ? "Ready" : "Action needed";
}

function statusClass(ready: boolean) {
  return ready
    ? "rounded-full border border-emerald-300/50 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
    : "rounded-full border border-amber-300/50 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700";
}

export function StoreSeoChecklist(props: StoreSeoChecklistProps) {
  const {
    storeSlug,
    hasVerifiedPrimaryDomain,
    activeProductCount,
    activeProductsMissingImageAltCount,
    hasStoreSeoTitle,
    hasStoreSeoDescription
  } = props;

  const checks = [
    {
      label: "Primary custom domain verified",
      ready: hasVerifiedPrimaryDomain,
      help: "Required for strongest canonical SEO signals.",
      href: `/dashboard/stores/${storeSlug}/store-settings/domains`
    },
    {
      label: "Store SEO title set",
      ready: hasStoreSeoTitle,
      help: "Used as homepage title when available.",
      href: `/dashboard/stores/${storeSlug}/store-settings/general`
    },
    {
      label: "Store SEO description set",
      ready: hasStoreSeoDescription,
      help: "Used as homepage meta description when available.",
      href: `/dashboard/stores/${storeSlug}/store-settings/general`
    },
    {
      label: "Product image alt text coverage",
      ready: activeProductsMissingImageAltCount === 0,
      help:
        activeProductCount === 0
          ? "No active products yet."
          : `${activeProductsMissingImageAltCount} active product(s) need alt text.`,
      href: `/dashboard/stores/${storeSlug}/catalog`
    }
  ];

  return (
    <SectionCard title="SEO Checklist" description="Track the core settings that affect storefront discoverability and indexing.">
      <div className="space-y-2">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{check.label}</p>
              <p className="text-xs text-muted-foreground">{check.help}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={statusClass(check.ready)}>{statusLabel(check.ready)}</span>
              <Link className="text-xs font-medium text-primary underline-offset-2 hover:underline" href={check.href}>
                Open
              </Link>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
