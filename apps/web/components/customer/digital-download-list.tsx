"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Download,
  FileArchive,
  FileImage,
  FileText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { DIGITAL_PRODUCT_CONFIG } from "@/lib/digital-products/config";
import { cn } from "@/lib/utils";

const payloadSchema = z.object({
  expiresAt: z.string().datetime({ offset: true }),
  context: z.object({
    store: z.object({
      name: z.string().trim().min(1).max(200),
      slug: z.string().trim().min(1).max(200),
      policiesHref: z.string().startsWith("/").max(500),
    }),
    license: z.object({
      version: z.string().trim().min(1).max(100),
      summary: z.string().trim().min(1).max(500),
      href: z.string().startsWith("/").max(500),
    }),
  }),
  files: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string().trim().min(1).max(255),
      customerFilename: z.string().trim().min(1).max(255),
      mimeType: z.enum([
        "image/jpeg",
        "image/png",
        "application/pdf",
        "application/zip",
      ]),
      byteSize: z.number().int().positive(),
      status: z.enum(["active", "suspended", "revoked"]),
      grantsRemaining: z.number().int().nonnegative().max(5),
    }),
  ),
});

type DownloadPayload = z.infer<typeof payloadSchema>;
type LoadState =
  | { status: "loading" }
  | { status: "ready"; payload: DownloadPayload }
  | { status: "unavailable" }
  | { status: "error"; message: string };

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    const value = bytes / (1024 * 1024);
    return `${Number.isInteger(value) ? value : value.toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    const value = bytes / 1024;
    return `${Number.isInteger(value) ? value : value.toFixed(1)} KB`;
  }
  return `${bytes} bytes`;
}

function formatFileType(mimeType: string) {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "application/zip") return "ZIP";
  if (mimeType === "image/png") return "PNG";
  return "JPG";
}

function formatExpiry(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function fileIcon(mimeType: string) {
  const classes = "h-5 w-5";
  if (mimeType.startsWith("image/")) {
    return <FileImage className={classes} aria-hidden="true" />;
  }
  if (mimeType === "application/zip") {
    return <FileArchive className={classes} aria-hidden="true" />;
  }
  return <FileText className={classes} aria-hidden="true" />;
}

export function DigitalDownloadList() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);
  const bootstrapTokenRef = useRef<string | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ status: "loading" });
    try {
      const fragmentToken = bootstrapTokenRef.current ?? new URLSearchParams(window.location.hash.slice(1)).get("token");
      if (fragmentToken) {
        bootstrapTokenRef.current = fragmentToken;
        window.history.replaceState(null, "", "/downloads");
        const exchange = await fetch("/api/digital-downloads/session", {
          method: "POST", credentials: "same-origin", cache: "no-store", signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: fragmentToken }),
        });
        if (!exchange.ok) {
          if (exchange.status === 410) { setState({ status: "unavailable" }); return; }
          throw new Error("We could not open this secure link. Please try again.");
        }
        bootstrapTokenRef.current = null;
      }
      const response = await fetch("/api/digital-downloads", { cache: "no-store", credentials: "same-origin", signal });
      if (response.status === 410 || response.status === 404) {
        setState({ status: "unavailable" });
        return;
      }
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          body && typeof body.error === "string"
            ? body.error
            : "We could not load your files. Please try again.",
        );
      }
      const parsed = payloadSchema.safeParse(body);
      if (!parsed.success) {
        throw new Error("We could not load your files. Please try again.");
      }
      setState({ status: "ready", payload: parsed.data });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "We could not load your files. Please try again.",
      });
    }
  }, []);

  function beginDownload(fileId: string, label: string) {
    if (downloadingId) return;
    setDownloadingId(fileId);
    setDownloadFeedback(`Preparing ${label}.`);
    const iframe = document.createElement("iframe");
    iframe.hidden = true;
    iframe.name = `digital-download-${crypto.randomUUID()}`;
    const handleFrameLoad = () => {
      let failed = false;
      try {
        if (iframe.contentWindow?.location.href === "about:blank") return;
        failed = iframe.contentDocument?.contentType === "application/json";
      } catch { /* Cross-origin redirect confirms initiation. */ }
      iframe.removeEventListener("load", handleFrameLoad);
      window.clearTimeout(timeoutId);
      setDownloadingId(null);
      setDownloadFeedback(failed ? `${label} could not be downloaded. Please try again.` : `${label} download started.`);
      window.setTimeout(() => iframe.remove(), 1_000);
    };
    iframe.addEventListener("load", handleFrameLoad);
    const timeoutId = window.setTimeout(() => {
      iframe.removeEventListener("load", handleFrameLoad);
      iframe.remove();
      setDownloadingId((current) => current === fileId ? null : current);
      setDownloadFeedback(`${label} did not respond. Please try the download again.`);
    }, DIGITAL_PRODUCT_CONFIG.downloadInitiationTimeoutMs);
    document.body.append(iframe);
    const form = document.createElement("form");
    form.method = "post";
    form.action = `/api/digital-downloads/file/${fileId}`;
    form.target = iframe.name;
    document.body.append(form);
    form.submit();
    form.remove();
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (state.status === "unavailable" || state.status === "error") {
      feedbackRef.current?.focus();
    }
  }, [state.status]);

  if (state.status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/20 px-4 py-16">
        <div role="status" className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-5 py-4 shadow-sm">
          <RefreshCw className="h-5 w-5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
          <span className="font-medium">Loading your files…</span>
        </div>
      </main>
    );
  }

  if (state.status === "unavailable") {
    return (
      <main className="min-h-screen bg-muted/20 px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
          <div ref={feedbackRef} role="alert" tabIndex={-1} className="focus:outline-none">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Secure downloads</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">This download link is no longer available</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Links expire after 48 hours and may also become unavailable after a refund, dispute, or replacement. Your lifetime download count is not reset when you request a new link.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link className={buttonVariants()} href="/downloads/request">Request a fresh link</Link>
            <Link className={buttonVariants({ variant: "outline" })} href="/login?returnTo=%2Fdashboard">Sign in to view orders</Link>
          </div>
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="min-h-screen bg-muted/20 px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
          <div ref={feedbackRef} role="alert" tabIndex={-1} className="focus:outline-none">
            <h1 className="text-2xl font-semibold tracking-tight">Your files could not be loaded</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{state.message}</p>
          </div>
          <Button className="mt-6" type="button" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        </div>
      </main>
    );
  }

  const { payload } = state;
  return (
    <main className="min-h-screen bg-muted/20 px-4 py-8 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-4xl space-y-6">
        <p className="sr-only" role="status" aria-live="polite">{downloadFeedback}</p>
        <header className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="bg-gradient-to-br from-primary/10 via-card to-[hsl(var(--brand-secondary))]/10 p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Digital order</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">{payload.context.store.name}</h1>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-3 text-sm backdrop-blur">
                <p className="font-medium">Link expires</p>
                <time className="text-muted-foreground" dateTime={payload.expiresAt}>{formatExpiry(payload.expiresAt)}</time>
              </div>
            </div>
          </div>
        </header>

        <section aria-labelledby="download-files-heading" className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4">
            <div>
              <h2 id="download-files-heading" className="text-xl font-semibold">Your files</h2>
              <p className="mt-1 text-sm text-muted-foreground">A successful download uses one of five lifetime grants per file.</p>
            </div>
            <StatusChip label={`${payload.files.length} ${payload.files.length === 1 ? "file" : "files"}`} tone="info" />
          </div>
          <ul className="mt-5 space-y-3">
            {payload.files.map((file) => {
              const available = file.status === "active" && file.grantsRemaining > 0;
              const statusLabel = file.status === "suspended"
                ? "Temporarily unavailable"
                : file.status === "revoked"
                  ? "Access revoked"
                  : file.grantsRemaining === 0
                    ? "Download limit reached"
                    : "Ready";
              return (
                <li key={file.id} className="rounded-xl border border-border/70 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {fileIcon(file.mimeType)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{file.label}</h3>
                          <StatusChip label={statusLabel} tone={available ? "success" : file.status === "suspended" ? "warning" : "danger"} />
                        </div>
                        <p className="mt-1 break-all text-sm text-muted-foreground">{file.customerFilename}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatFileType(file.mimeType)} · {formatBytes(file.byteSize)}</p>
                        <p className="mt-2 text-sm font-medium">{file.grantsRemaining} of 5 downloads remaining</p>
                        {file.status === "suspended" ? <p className="mt-1 text-xs text-muted-foreground">Contact the store if you need help with this order.</p> : null}
                      </div>
                    </div>
                    {available ? (
                      <Button
                        type="button"
                        disabled={downloadingId !== null}
                        className={cn(buttonVariants(), "w-full shrink-0 sm:w-auto")}
                        aria-label={`Download ${file.label}`}
                        onClick={() => beginDownload(file.id, file.label)}
                      >
                        <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                        {downloadingId === file.id ? "Preparing…" : "Download"}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="grid gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:grid-cols-[auto_1fr] sm:p-7">
          <ShieldCheck className="h-7 w-7 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Personal-use license</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{payload.context.license.summary}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <Link className="font-medium text-primary hover:underline" href={payload.context.license.href}>Read the personal-use license</Link>
              <Link className="text-muted-foreground hover:text-foreground hover:underline" href={payload.context.store.policiesHref}>Store policies and support</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
