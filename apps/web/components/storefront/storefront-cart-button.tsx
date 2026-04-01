"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useOptionalStorefrontRuntime } from "@/components/storefront/storefront-runtime-provider";
import { readStorefrontCart, STOREFRONT_CART_UPDATED_EVENT, syncStorefrontCart, writeStorefrontCart, type StorefrontCartEntry } from "@/lib/storefront/cart";
import { Button } from "@/components/ui/button";
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
  const runtime = useOptionalStorefrontRuntime();
  const previewNavigateToHref = runtime?.mode === "studio" ? runtime.previewNavigateToHref ?? null : null;
  const routeBasePath = runtime?.routeBasePath ?? "";
  const [count, setCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewItems, setPreviewItems] = useState<CartPreviewItem[]>([]);
  const [previewSubtotalCents, setPreviewSubtotalCents] = useState(0);
  const [closeTimeout, setCloseTimeout] = useState<number | null>(null);
  const [isUpdatingPreview, setIsUpdatingPreview] = useState(false);
  const resolvedHref = href ?? (storeSlug ? buildStorefrontCartPath(storeSlug, routeBasePath) : "/cart");

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

    function onCartUpdated() {
      syncCount();
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener(STOREFRONT_CART_UPDATED_EVENT, onCartUpdated);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(STOREFRONT_CART_UPDATED_EVENT, onCartUpdated);
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

  async function updatePreviewCart(updater: (current: StorefrontCartEntry[]) => StorefrontCartEntry[]) {
    const next = updater(readStorefrontCart())
      .map((entry) => ({
        ...entry,
        quantity: Math.min(99, Math.max(1, entry.quantity))
      }))
      .filter((entry) => entry.quantity > 0);

    writeStorefrontCart(next);
    setCount(next.reduce((sum, entry) => sum + entry.quantity, 0));

    if (next.length === 0) {
      setPreviewItems([]);
      setPreviewSubtotalCents(0);
    } else {
      setPreviewItems((current) =>
        current
          .map((item) => {
            const match = next.find((entry) => item.key === `${entry.productId}:${entry.variantId}`);
            if (!match) {
              return null;
            }

            return {
              ...item,
              quantity: match.quantity,
              lineTotalCents: item.unitPriceCents * match.quantity
            };
          })
          .filter((item): item is CartPreviewItem => item !== null)
      );
      setPreviewSubtotalCents(next.reduce((sum, entry) => {
        const matchingPreview = previewItems.find((item) => item.key === `${entry.productId}:${entry.variantId}`);
        return sum + (matchingPreview ? matchingPreview.unitPriceCents * entry.quantity : 0);
      }, 0));
    }

    setIsUpdatingPreview(true);
    try {
      if (storeSlug) {
        await syncStorefrontCart(next, storeSlug);
      }
      await loadPreview();
    } finally {
      setIsUpdatingPreview(false);
    }
  }

  function updatePreviewQuantity(itemKey: string, nextQuantity: number) {
    const [productId, variantId] = itemKey.split(":");
    if (!productId || !variantId) {
      return;
    }

    void updatePreviewCart((current) => {
      if (nextQuantity <= 0) {
        return current.filter((entry) => !(entry.productId === productId && entry.variantId === variantId));
      }

      return current.map((entry) =>
        entry.productId === productId && entry.variantId === variantId
          ? { ...entry, quantity: nextQuantity }
          : entry
      );
    });
  }

  function removePreviewItem(itemKey: string) {
    updatePreviewQuantity(itemKey, 0);
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
        onClick={(event) => {
          if (!previewNavigateToHref) {
            return;
          }

          event.preventDefault();
          previewNavigateToHref(event.currentTarget.href);
        }}
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
                <div key={item.key} className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium">{item.productTitle}</p>
                      <p className="text-[11px] text-muted-foreground">{item.variantLabel}</p>
                    </div>
                    <p className="text-xs font-medium">${(item.lineTotalCents / 100).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={isUpdatingPreview}
                        onClick={() => updatePreviewQuantity(item.key, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                        <span className="sr-only">Decrease quantity</span>
                      </Button>
                      <span className="min-w-6 text-center text-[11px] font-medium">{item.quantity}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={isUpdatingPreview || item.quantity >= 99}
                        onClick={() => updatePreviewQuantity(item.key, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                        <span className="sr-only">Increase quantity</span>
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      disabled={isUpdatingPreview}
                      onClick={() => removePreviewItem(item.key)}
                    >
                      <Trash2 className="h-3 w-3" />
                      <span className="sr-only">Remove item</span>
                    </Button>
                  </div>
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
