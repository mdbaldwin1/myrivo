import React from "react";
import { COOKIE_COMPLIANCE_INFORMATION_ARCHITECTURE, COOKIE_INVENTORY, getCookieInventoryByCategory } from "@/lib/privacy/cookies";

type CookiePolicyContentProps = {
  scopeLabel?: string;
};

export function CookiePolicyContent({ scopeLabel = "Myrivo" }: CookiePolicyContentProps) {
  const essentialEntries = getCookieInventoryByCategory("essential");
  const analyticsEntries = getCookieInventoryByCategory("analytics");

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold">Cookie Policy</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          This page explains how {scopeLabel} uses cookies and similar technologies, what each category does, and how you can manage your preferences.
        </p>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          If your browser sends a Global Privacy Control signal, Myrivo treats optional analytics storage as off even if you previously opted in.
        </p>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">How we classify cookies</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We currently use two categories: essential cookies, which support core site and storefront functionality, and analytics cookies, which help store owners understand storefront traffic and conversion performance.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border/70 bg-card/40 p-4">
            <h3 className="text-base font-semibold">Essential cookies</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Required for authentication, storefront continuity, and remembering your preferences. These are always enabled.
            </p>
            <ul className="space-y-3">
              {essentialEntries.map((entry) => (
                <li key={entry.key} className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <p className="font-medium text-foreground">{entry.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{entry.purpose}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {entry.storageType === "cookie" ? "Cookie" : "Local storage"} • {entry.duration}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 rounded-xl border border-border/70 bg-card/40 p-4">
            <h3 className="text-base font-semibold">Analytics cookies</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Optional. These help stores understand visits, product interest, cart activity, and conversion trends.
            </p>
            <ul className="space-y-3">
              {analyticsEntries.map((entry) => (
                <li key={entry.key} className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <p className="font-medium text-foreground">{entry.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{entry.purpose}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {entry.storageType === "cookie" ? "Cookie" : "Local storage"} • {entry.duration}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Current inventory</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This inventory reflects the first-party cookies and similar technologies currently managed by the platform.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium text-foreground">Name</th>
                <th className="px-4 py-3 font-medium text-foreground">Category</th>
                <th className="px-4 py-3 font-medium text-foreground">Storage</th>
                <th className="px-4 py-3 font-medium text-foreground">Duration</th>
                <th className="px-4 py-3 font-medium text-foreground">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {COOKIE_INVENTORY.map((entry) => (
                <tr key={entry.key} className="align-top">
                  <td className="px-4 py-3 font-medium text-foreground">{entry.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.category === "essential" ? "Essential" : "Analytics"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.storageType === "cookie" ? "Cookie" : "Local storage"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.duration}</td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Ownership and support</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-card/40 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Platform owns</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {COOKIE_COMPLIANCE_INFORMATION_ARCHITECTURE.platformOwns.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border/70 bg-card/40 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Storefront inherits</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {COOKIE_COMPLIANCE_INFORMATION_ARCHITECTURE.storefrontInherits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border/70 bg-card/40 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Stores do not own</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {COOKIE_COMPLIANCE_INFORMATION_ARCHITECTURE.storeDoesNotOwn.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
