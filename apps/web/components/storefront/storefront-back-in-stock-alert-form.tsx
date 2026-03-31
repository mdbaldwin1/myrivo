"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { cn } from "@/lib/utils";

type StorefrontBackInStockAlertFormProps = {
  storeSlug: string;
  productId: string;
  variantId: string;
  variantLabel: string;
  buttonRadiusClass: string;
};

type BackInStockAlertResponse = {
  success?: boolean;
  alreadyRequested?: boolean;
  reactivated?: boolean;
  error?: string;
};

export function StorefrontBackInStockAlertForm({
  storeSlug,
  productId,
  variantId,
  variantLabel,
  buttonRadiusClass
}: StorefrontBackInStockAlertFormProps) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function submitAlert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/storefront/back-in-stock-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          storeSlug,
          productId,
          variantId,
          source: "storefront_product_detail",
          location: `/s/${storeSlug}/products/${productId}`
        })
      });
      const payload = (await response.json()) as BackInStockAlertResponse;
      if (!response.ok) {
        setError(payload.error ?? "Unable to save your alert request.");
        return;
      }
      setSuccessMessage(
        payload.alreadyRequested
          ? `You're already on the waitlist for ${variantLabel}.`
          : `We'll email you when ${variantLabel} is back in stock.`
      );
      setEmail("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save your alert request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submitAlert} className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-[color:var(--storefront-text)]">Notify me when this is back in stock</p>
        <p className="text-sm text-muted-foreground">Join the waitlist for {variantLabel} and we&apos;ll send one email when it&apos;s available again.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          className={cn("h-11 bg-[color:var(--storefront-surface)]", buttonRadiusClass)}
        />
        <Button
          type="submit"
          disabled={pending}
          className={cn("h-11 bg-[var(--storefront-primary)] text-[color:var(--storefront-primary-foreground)] hover:opacity-90", buttonRadiusClass)}
        >
          {pending ? "Saving..." : "Email me"}
        </Button>
      </div>
      <FeedbackMessage type="error" message={error} />
      {successMessage ? <p className="text-sm text-muted-foreground">{successMessage}</p> : null}
    </form>
  );
}
