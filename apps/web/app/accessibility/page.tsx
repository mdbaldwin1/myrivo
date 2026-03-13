import { PageShell } from "@/components/layout/page-shell";

export const dynamic = "force-dynamic";

export default function AccessibilityPage() {
  return (
    <PageShell maxWidthClassName="max-w-3xl">
      <article className="space-y-6">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold">Accessibility Statement</h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            We want Myrivo and storefronts built on Myrivo to be usable by as many people as possible, including people using
            assistive technology, keyboard navigation, and reduced-motion settings.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">What we are doing now</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            We actively review customer-facing storefronts and shared dashboard surfaces for keyboard access, form semantics,
            motion preferences, and clear navigation landmarks. Accessibility work is part of our ongoing product roadmap.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Need help or found a barrier?</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            If you run into an accessibility issue, email{" "}
            <a className="font-medium text-foreground underline underline-offset-4" href="mailto:hello@myrivo.app?subject=Myrivo%20Accessibility%20Support">
              hello@myrivo.app
            </a>
            . Please include the page or feature you were using, what assistive technology or browser setup you rely on, and what happened.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Conformance note</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            We are improving accessibility continuously, but we are not making a formal WCAG conformance claim on this page at this time.
          </p>
        </section>
      </article>
    </PageShell>
  );
}
