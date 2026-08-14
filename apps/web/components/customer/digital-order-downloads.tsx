"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DigitalOrderDownloads({
  orderId,
  fileCount,
  activeFileCount = fileCount,
  accessStatus = "active",
}: {
  orderId: string;
  fileCount: number;
  activeFileCount?: number;
  accessStatus?: "active" | "suspended" | "revoked";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  async function openDownloads() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/customer/orders/${encodeURIComponent(orderId)}/digital-access`,
        { method: "POST", credentials: "same-origin" },
      );
      const body = (await response.json().catch(() => null)) as {
        accessUrl?: unknown;
        error?: unknown;
      } | null;
      if (
        !response.ok ||
        !body ||
        typeof body.accessUrl !== "string" ||
        body.accessUrl !== "/downloads"
      ) {
        throw new Error(
          body && typeof body.error === "string"
            ? body.error
            : "We could not open your downloads. Please try again.",
        );
      }
      router.push(body.accessUrl);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not open your downloads. Please try again.",
      );
      queueMicrotask(() => errorRef.current?.focus());
    } finally {
      setPending(false);
    }
  }

  const buttonLabel = error
    ? "Try again"
    : activeFileCount === 1
      ? "View download"
      : `View ${activeFileCount} downloads`;
  const isAvailable = accessStatus === "active" && activeFileCount > 0;
  const description = accessStatus === "suspended"
    ? "Downloads are temporarily unavailable while a payment dispute is reviewed. Your download grants are preserved."
    : accessStatus === "revoked"
      ? "Download access was removed after this order was fully refunded. Contact the store if you believe this is a mistake."
      : activeFileCount < fileCount
        ? `${activeFileCount} of ${fileCount} purchased files ${activeFileCount === 1 ? "is" : "are"} currently available. Opening them creates a private 15-minute access session.`
        : `${fileCount} purchased ${fileCount === 1 ? "file" : "files"}. Opening this order creates a private 15-minute access session; each file still has five lifetime download grants.`;

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      <div className="bg-gradient-to-r from-primary/10 via-card to-[hsl(var(--brand-secondary))]/10 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Download className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Digital downloads</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground" role="status" aria-live="polite">
                {description}
              </p>
            </div>
          </div>
          {isAvailable ? (
            <Button className="w-full shrink-0 sm:w-auto" type="button" disabled={pending} onClick={() => void openDownloads()}>
              {pending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Download className="mr-2 h-4 w-4" aria-hidden="true" />}
              {pending ? "Opening…" : buttonLabel}
            </Button>
          ) : null}
        </div>
      </div>
      {isAvailable || error ? <div className="border-t border-border/60 px-5 py-3 sm:px-6">
        {error ? (
          <div ref={errorRef} role="alert" tabIndex={-1} className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive focus:outline-none">
            {error}
          </div>
        ) : null}
        {isAvailable ? (
          <Link className="inline-flex items-center text-sm font-medium text-primary hover:underline" href="/downloads/request">
            <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
            Request an emailed link
          </Link>
        ) : null}
      </div> : null}
    </section>
  );
}
