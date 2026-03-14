import { PageShell } from "@/components/layout/page-shell";
import { AccessibilityReportForm } from "@/components/accessibility/accessibility-report-form";
import {
  ACCESSIBILITY_CONFORMANCE_NOTE,
  ACCESSIBILITY_EVIDENCE_MATRIX,
  ACCESSIBILITY_HIGH_PRIORITY_BLOCKERS,
  ACCESSIBILITY_RELEASE_GATES,
  ACCESSIBILITY_TARGET_FLOWS
} from "@/lib/accessibility-governance";

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
          <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
            {ACCESSIBILITY_TARGET_FLOWS.map((flow) => (
              <li key={flow}>{flow}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Need help or found a barrier?</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            If you run into an accessibility issue, use the report form below or email{" "}
            <a className="font-medium text-foreground underline underline-offset-4" href="mailto:hello@myrivo.app?subject=Myrivo%20Accessibility%20Support">
              hello@myrivo.app
            </a>
            . Please include the page or feature you were using, what assistive technology or browser setup you rely on, and what happened.
          </p>
          <AccessibilityReportForm />
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How we review releases</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            We use a release checklist for shared shells, motion-heavy surfaces, forms, and changed customer journeys before shipping major updates.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
            {ACCESSIBILITY_RELEASE_GATES.map((gate) => (
              <li key={gate}>{gate}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Current evidence model</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            We keep an internal evidence matrix for the highest-risk flows so support, product, and engineering can see how a flow is
            reviewed today without overstating formal conformance.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">Accessibility evidence matrix for Myrivo priority flows.</caption>
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-4 py-3 font-medium">Flow</th>
                  <th className="px-4 py-3 font-medium">Evidence we keep</th>
                  <th className="px-4 py-3 font-medium">Primary owner</th>
                </tr>
              </thead>
              <tbody>
                {ACCESSIBILITY_EVIDENCE_MATRIX.map((entry) => (
                  <tr key={entry.flow} className="border-t border-border/70 align-top">
                    <td className="px-4 py-3 font-medium">{entry.flow}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <ul className="list-disc space-y-1 pl-5">
                        {entry.evidence.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Conformance note</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            {ACCESSIBILITY_CONFORMANCE_NOTE}
          </p>
          <p className="text-sm leading-7 text-muted-foreground">
            We treat the following as high-priority issues: {ACCESSIBILITY_HIGH_PRIORITY_BLOCKERS.join("; ")}.
          </p>
        </section>
      </article>
    </PageShell>
  );
}
