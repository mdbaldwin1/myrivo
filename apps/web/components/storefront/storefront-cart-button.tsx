"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { readStorefrontCart } from "@/lib/storefront/cart";
import { buildStorefrontCartPath } from "@/lib/storefront/paths";
import { cn } from "@/lib/utils";

type StorefrontCartButtonProps = {
  href?: string;
  storeSlug?: string;
  buttonRadiusClass?: string;
  className?: string;
  ariaLabel?: string;
};

type CartPreviewItem = {
  key: string;
  productTitle: string;
  variantLabel: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

type CartPreviewResponse = {
  items?: CartPreviewItem[];
  subtotalCents?: number;
};

export function StorefrontCartButton({
  href,
  storeSlug,
  buttonRadiusClass = "rounded-md",
  className,
  ariaLabel = "Open cart"
}: StorefrontCartButtonProps) {
  const [count, setCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewItems, setPreviewItems] = useState<CartPreviewItem[]>([]);
  const [previewSubtotalCents, setPreviewSubtotalCents] = useState(0);
  const [closeTimeout, setCloseTimeout] = useState<number | null>(null);
  const resolvedHref = href ?? (storeSlug ? buildStorefrontCartPath(storeSlug) : "/cart");

  function syncCount() {
    const nextCount = readStorefrontCart().reduce((sum, entry) => sum + entry.quantity, 0);
    setCount(nextCount);
  }

  useEffect(() => {
    queueMicrotask(syncCount);
  }, []);

  useEffect(() => {
    function onStorage() {
      syncCount();
    }

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  async function loadPreview() {
    const entries = readStorefrontCart();
    const nextCount = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    setCount(nextCount);

    if (entries.length === 0) {
      setPreviewItems([]);
      setPreviewSubtotalCents(0);
      return;
    }

    setIsLoadingPreview(true);
    const query = storeSlug ? `?store=${encodeURIComponent(storeSlug)}` : "";
    const response = await fetch(`/api/storefront/cart-preview${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries })
    });
    const payload = (await response.json()) as CartPreviewResponse;
    setIsLoadingPreview(false);

    if (!response.ok) {
      setPreviewItems([]);
      setPreviewSubtotalCents(0);
      return;
    }

    setPreviewItems(payload.items ?? []);
    setPreviewSubtotalCents(payload.subtotalCents ?? 0);
  }

  function openPreview() {
    if (closeTimeout) {
      window.clearTimeout(closeTimeout);
      setCloseTimeout(null);
    }
    setIsOpen(true);
    void loadPreview();
  }

  function scheduleClose() {
    if (closeTimeout) {
      window.clearTimeout(closeTimeout);
    }
    const timeout = window.setTimeout(() => {
      setIsOpen(false);
    }, 120);
    setCloseTimeout(timeout);
  }

  return (
    <div className="relative" onMouseEnter={openPreview} onMouseLeave={scheduleClose}>
      <Link
        href={resolvedHref}
        className={cn("relative inline-flex h-9 w-9 items-center justify-center transition-opacity hover:opacity-70", buttonRadiusClass, className)}
        aria-label={ariaLabel}
        onFocus={openPreview}
        onBlur={scheduleClose}
      >
        <ShoppingCart className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--storefront-accent)] px-1 text-center text-[10px] font-semibold text-[color:var(--storefront-accent-foreground)]">
            {count}
          </span>
        ) : null}
      </Link>

      {isOpen ? (
        <div className={cn("absolute right-0 top-full z-[80] mt-2 w-80 border border-border bg-[color:var(--storefront-surface)] p-3 shadow-lg", buttonRadiusClass)}>
          <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
            <p className="text-sm font-semibold">Cart</p>
            <p className="text-xs text-muted-foreground">{count} item{count === 1 ? "" : "s"}</p>
          </div>

          {isLoadingPreview ? (
            <p className="py-3 text-xs text-muted-foreground">Loading cart…</p>
          ) : previewItems.length === 0 ? (
            <p className="py-3 text-xs text-muted-foreground">Your cart is empty.</p>
          ) : (
            <div className="space-y-2 py-2">
              {previewItems.slice(0, 4).map((item) => (
                <div key={item.key} className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium">{item.productTitle}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.variantLabel} · Qty {item.quantity}
                    </p>
                  </div>
                  <p className="text-xs font-medium">${(item.lineTotalCents / 100).toFixed(2)}</p>
                </div>
              ))}
              {previewItems.length > 4 ? (
                <p className="text-[11px] text-muted-foreground">+{previewItems.length - 4} more items</p>
              ) : null}
              <div className="flex items-center justify-between border-t border-border/50 pt-2">
                <p className="text-xs text-muted-foreground">Subtotal</p>
                <p className="text-sm font-semibold">${(previewSubtotalCents / 100).toFixed(2)}</p>
              </div>
            </div>
          )}

          <Link
            href={resolvedHref}
            className={cn(
              "mt-2 inline-flex h-9 w-full items-center justify-center bg-[var(--storefront-primary)] px-3 text-sm font-medium text-[color:var(--storefront-primary-foreground)] hover:opacity-90",
              buttonRadiusClass
            )}
          >
            View cart
          </Link>
        </div>
      ) : null}
    </div>
  );
}
