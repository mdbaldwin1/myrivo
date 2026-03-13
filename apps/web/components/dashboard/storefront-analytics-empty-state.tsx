import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

type StorefrontAnalyticsEmptyStateProps = {
  storeSlug: string;
};

export function StorefrontAnalyticsEmptyState({ storeSlug }: StorefrontAnalyticsEmptyStateProps) {
  return (
    <SectionCard
      title="Analytics Coming Online"
      description="We will start filling this dashboard as shoppers browse products, add items to cart, and complete orders."
      action={
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/stores/${storeSlug}/storefront-studio?surface=home`}>Review storefront</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/dashboard/stores/${storeSlug}/catalog`}>Add products</Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-4">
          <p className="text-sm font-medium">Traffic appears after real storefront visits</p>
          <p className="mt-1 text-sm text-muted-foreground">Page views, product views, and search behavior show up once customers interact with the storefront.</p>
        </div>
        <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-4">
          <p className="text-sm font-medium">Conversion analytics need active carts and orders</p>
          <p className="mt-1 text-sm text-muted-foreground">Add-to-cart, checkout, and purchase metrics are only meaningful after a few real buying sessions.</p>
        </div>
        <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-4">
          <p className="text-sm font-medium">Use this screen as your storefront pulse</p>
          <p className="mt-1 text-sm text-muted-foreground">Once traffic starts arriving, this page will show where shoppers drop off and which products deserve attention.</p>
        </div>
      </div>
    </SectionCard>
  );
}
