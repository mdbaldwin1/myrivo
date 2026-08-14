"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ORDER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function DigitalDownloadRequestPage() {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedOrderId = orderId.trim();
    const normalizedEmail = email.trim();
    if (
      !ORDER_ID_PATTERN.test(normalizedOrderId) ||
      normalizedEmail.length > 254 ||
      !EMAIL_PATTERN.test(normalizedEmail)
    ) {
      setInvalid(true);
      setSuccess(null);
      setError("Enter the full order ID and a valid email address.");
      queueMicrotask(() => feedbackRef.current?.focus());
      return;
    }
    setInvalid(false);
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/digital-downloads/request-link", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: normalizedOrderId, email: normalizedEmail }),
      });
      const body = (await response.json().catch(() => null)) as {
        message?: unknown;
        error?: unknown;
      } | null;
      if (!response.ok) {
        throw new Error(
          body && typeof body.error === "string"
            ? body.error
            : "We could not request a link. Please try again shortly.",
        );
      }
      setSuccess(
        body && typeof body.message === "string"
          ? body.message
          : "If the order details match, a fresh download link will arrive by email.",
      );
      queueMicrotask(() => feedbackRef.current?.focus());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not request a link. Please try again shortly.",
      );
      queueMicrotask(() => feedbackRef.current?.focus());
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="bg-gradient-to-br from-primary/10 via-card to-[hsl(var(--brand-secondary))]/10 p-6 sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <KeyRound className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-6 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Secure digital delivery</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Request a fresh download link</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Enter the full order ID and the email used at checkout. A matching order receives a private link by email; the fresh link will work for 48 hours and does not reset download grants.
            </p>
          </div>

          <form className="space-y-5 border-t border-border/60 p-6 sm:p-8" onSubmit={submit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="digital-recovery-order-id">Order ID</Label>
              <Input
                id="digital-recovery-order-id"
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                autoComplete="off"
                aria-invalid={invalid ? "true" : undefined}
                aria-describedby="digital-recovery-order-help"
                maxLength={36}
              />
              <p id="digital-recovery-order-help" className="text-xs text-muted-foreground">Use the complete ID shown in your order confirmation.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="digital-recovery-email">Order email</Label>
              <Input
                id="digital-recovery-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={invalid ? "true" : undefined}
                maxLength={254}
              />
            </div>

            {error ? (
              <div ref={feedbackRef} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive focus:outline-none">
                {error}
              </div>
            ) : null}
            {success ? (
              <div ref={feedbackRef} role="status" tabIndex={-1} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 focus:outline-none dark:text-emerald-100">
                <p className="font-medium">Check your email</p>
                <p className="mt-1">{success}</p>
                <p className="mt-1">Delivery may take a few minutes. Check spam or promotions folders too.</p>
              </div>
            ) : null}

            <Button className="w-full sm:w-auto" type="submit" disabled={pending}>
              <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
              {pending ? "Requesting…" : "Email me a fresh link"}
            </Button>
          </form>
        </div>

        <aside className="mt-5 rounded-xl border border-border/70 bg-card p-5 text-sm shadow-sm">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Still need help?</h2>
              <p className="mt-1 leading-6 text-muted-foreground">Signed-in customers can open eligible downloads directly from order history. You can also review download and refund guidance.</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                <Link className="font-medium text-primary hover:underline" href="/login?returnTo=%2Fdashboard">Sign in to view your orders</Link>
                <Link className="text-muted-foreground hover:text-foreground hover:underline" href="/docs/catalog-and-orders#digital-products">Read download help</Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
