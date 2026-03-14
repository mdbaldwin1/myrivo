"use client";

import { FormEvent, useMemo, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type NewsletterUnsubscribeFormProps = {
  initialStore: string;
};

const UNSUBSCRIBE_EMAIL_INPUT_ID = "newsletter-unsubscribe-email";
const UNSUBSCRIBE_STORE_INPUT_ID = "newsletter-unsubscribe-store";

export function NewsletterUnsubscribeForm({ initialStore }: NewsletterUnsubscribeFormProps) {
  const [email, setEmail] = useState("");
  const [store, setStore] = useState(initialStore);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    const base = "/api/storefront/newsletter/unsubscribe";
    return store ? `${base}?store=${encodeURIComponent(store)}` : base;
  }, [store]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "unsubscribe_form" })
    });

    const payload = (await response.json()) as { error?: string };
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to process unsubscribe request.");
      return;
    }

    setSuccess("You have been unsubscribed.");
    setEmail("");
  }

  return (
    <section className="w-full space-y-4 rounded-xl border border-border/60 bg-background p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Unsubscribe from Emails</h1>
        <p className="text-sm text-muted-foreground">Enter your email to stop receiving marketing emails from this store.</p>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <label htmlFor={UNSUBSCRIBE_EMAIL_INPUT_ID} className="sr-only">
          Email address
        </label>
        <Input
          id={UNSUBSCRIBE_EMAIL_INPUT_ID}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="h-11"
        />
        <label htmlFor={UNSUBSCRIBE_STORE_INPUT_ID} className="sr-only">
          Store slug
        </label>
        <Input
          id={UNSUBSCRIBE_STORE_INPUT_ID}
          value={store}
          onChange={(event) => setStore(event.target.value)}
          placeholder="store slug (optional on custom domain)"
          aria-label="Store slug"
          className="h-11"
        />
        <Button className="h-11 w-full" type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Unsubscribe"}
        </Button>
      </form>

      <AppAlert variant="error" message={error} />
      <AppAlert variant="success" message={success} />
    </section>
  );
}
