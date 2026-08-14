"use client";

import { Badge } from "@/components/ui/badge";
import { DigitalPublishReadiness } from "@/components/dashboard/digital-publish-readiness";
import { resolvePriceRange, type ProductListItem } from "@/components/dashboard/product-manager-domain";

type DigitalProductOverviewProps = {
  product: ProductListItem;
  onNavigate: (tab: "files" | "media", target: string) => void;
  onEdit: (target: "rights") => void;
  onPublish: () => void | Promise<void>;
};

function previewLabel(status: NonNullable<ProductListItem["digital_readiness"]>["previewStatus"]) {
  if (status === "ready") return "Preview ready";
  if (status === "processing") return "Preview processing";
  if (status === "failed") return "Preview needs attention";
  return "Preview missing";
}

export function DigitalProductOverview({ product, onNavigate, onEdit, onPublish }: DigitalProductOverviewProps) {
  const readiness = product.digital_readiness;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Fulfillment</p>
          <p className="mt-1 font-medium">Digital download</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Price</p>
          <p className="mt-1 font-medium">{resolvePriceRange(product.product_variants)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Files</p>
          <p className="mt-1 font-medium">
            {readiness?.applicableFileCount ?? 0} applicable {(readiness?.applicableFileCount ?? 0) === 1 ? "file" : "files"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Buyer preview</p>
          <p className="mt-1 font-medium">{previewLabel(readiness?.previewStatus ?? "missing")}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/15 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-medium">Delivery and license</h4>
          <Badge variant="outline">Platform standard</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Buyers receive 48-hour access links, 5 downloads per purchased file, and the standard personal-use license. These safeguards are fixed for every Myrivo digital product.
        </p>
      </div>

      <DigitalPublishReadiness product={product} onNavigate={onNavigate} onEdit={onEdit} onPublish={onPublish} />
    </div>
  );
}
