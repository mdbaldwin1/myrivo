import type { Metadata } from "next";
import Link from "next/link";
import { Check, Copyright, ShieldCheck, X } from "lucide-react";

export const metadata: Metadata = {
  title: "Digital personal-use license | Myrivo",
  description: "The plain-language license for digital products purchased through Myrivo.",
};

export default function DigitalPersonalUseLicensePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34rem)] px-4 py-10 sm:px-6 sm:py-16">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-border/70 bg-background/95 shadow-xl shadow-foreground/5">
        <header className="border-b border-border/70 bg-muted/30 px-6 py-8 sm:px-10 sm:py-10">
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck aria-hidden="true" className="size-6" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Version personal-use-v1
          </p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Digital personal-use license
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-muted-foreground">
            Your purchase supports the creator and gives you a straightforward license to enjoy the digital work personally. It does not transfer ownership of the artwork or file.
          </p>
        </header>

        <div className="space-y-10 px-6 py-8 sm:px-10 sm:py-10">
          <section aria-labelledby="allowed-heading">
            <div className="flex items-start gap-4">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <Check aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 id="allowed-heading" className="text-xl font-semibold text-foreground">
                  What you may do
                </h2>
                <p className="mt-2 leading-7 text-muted-foreground">
                  You may download the purchased files and print a reasonable number of copies for your own personal use or for personal gifts to family and friends.
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="not-allowed-heading">
            <div className="flex items-start gap-4">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <X aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 id="not-allowed-heading" className="text-xl font-semibold text-foreground">
                  What you may not do
                </h2>
                <p className="mt-2 leading-7 text-muted-foreground">
                  You may not resell, redistribute, share, sublicense, upload, or commercially exploit the files, the artwork, or printed copies made from them.
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="ownership-heading">
            <div className="flex items-start gap-4">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Copyright aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 id="ownership-heading" className="text-xl font-semibold text-foreground">
                  Ownership stays with the creator
                </h2>
                <p className="mt-2 leading-7 text-muted-foreground">
                  Copyright remains with the creator. Your purchase grants a non-exclusive, non-transferable license for the uses above rather than ownership of the intellectual property.
                </p>
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-border/70 bg-muted/35 p-5 text-sm leading-6 text-muted-foreground">
            The license version included with your order is recorded at checkout. Store refund terms and rights required by applicable law still apply.
          </aside>

          <div className="flex flex-wrap gap-3 border-t border-border/70 pt-6">
            <Link
              href="/downloads/request"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Recover a download link
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Return to Myrivo
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}
