"use client";

import Link from "next/link";
import { Facebook, Instagram, Music2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DEFAULT_STOREFRONT_COPY, type StorefrontCopyConfig } from "@/lib/storefront/copy";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";

type FooterSettings = {
  support_email: string | null;
  footer_tagline: string | null;
  footer_note: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  email_capture_enabled?: boolean | null;
  email_capture_heading?: string | null;
  email_capture_description?: string | null;
  email_capture_success_message?: string | null;
} | null;

type StorefrontFooterProps = {
  storeName: string;
  storeSlug?: string;
  settings: FooterSettings;
  buttonRadiusClass?: string;
  copy?: StorefrontCopyConfig;
  navLinks?: Array<{ label: string; href: string }>;
  showBackToTop?: boolean;
  showOwnerLogin?: boolean;
};

export function StorefrontFooter({
  storeName,
  storeSlug,
  settings,
  buttonRadiusClass = "rounded-md",
  copy = DEFAULT_STOREFRONT_COPY,
  navLinks,
  showBackToTop = true,
  showOwnerLogin = true
}: StorefrontFooterProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [subscribeSuccess, setSubscribeSuccess] = useState<string | null>(null);

  const footerLinks = [
    { label: "Instagram", href: settings?.instagram_url ?? null },
    { label: "Facebook", href: settings?.facebook_url ?? null },
    { label: "TikTok", href: settings?.tiktok_url ?? null }
  ].filter((item): item is { label: string; href: string } => Boolean(item.href));

  function renderSocialIcon(label: string) {
    const normalized = label.trim().toLowerCase();
    if (normalized === "instagram") return <Instagram className="h-4 w-4" />;
    if (normalized === "facebook") return <Facebook className="h-4 w-4" />;
    if (normalized === "tiktok") return <Music2 className="h-4 w-4" />;
    return null;
  }

  const resolvedNavLinks =
    navLinks ??
    [
      { label: copy.footer.allProductsLink, href: "/products" },
      { label: copy.footer.cartLink, href: "/cart" },
      { label: copy.footer.aboutLink, href: "/about" },
      { label: copy.footer.policiesLink, href: "/policies" }
    ];

  const navLinksWithStore = resolvedNavLinks.map((link) => ({
    ...link,
    href: storeSlug ? `${link.href}${link.href.includes("?") ? "&" : "?"}store=${encodeURIComponent(storeSlug)}` : link.href
  }));

  async function subscribeToNewsletter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubscribeError(null);
    setSubscribeSuccess(null);

    const query = storeSlug ? `?store=${encodeURIComponent(storeSlug)}` : "";
    const response = await fetch(`/api/storefront/newsletter${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const payload = (await response.json()) as { error?: string };
    setSubmitting(false);

    if (!response.ok) {
      setSubscribeError(payload.error ?? "Unable to subscribe right now.");
      return;
    }

    setSubscribeSuccess(settings?.email_capture_success_message?.trim() || "Thanks for subscribing.");
    setEmail("");
  }

  return (
    <footer className="mt-10 border-t border-border/40 pt-10">
      {settings?.email_capture_enabled ? (
        <section className="space-y-3 border-b border-border/30 pb-8 text-center">
          <div className="space-y-1">
            <p className="text-lg font-semibold [font-family:var(--storefront-font-heading)]">
              {settings.email_capture_heading?.trim() || "Get updates from the shop"}
            </p>
            <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
              {settings.email_capture_description?.trim() || "New releases, restocks, and occasional offers. Unsubscribe anytime."}
            </p>
          </div>
          <form onSubmit={subscribeToNewsletter} className="mx-auto flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className={cn("h-11 flex-1 border-border/60 bg-[color:var(--storefront-surface)]", buttonRadiusClass)}
            />
            <Button
              type="submit"
              disabled={submitting}
              className={cn(
                "h-11 px-5 bg-[var(--storefront-primary)] text-[color:var(--storefront-primary-foreground)] hover:opacity-90",
                buttonRadiusClass
              )}
            >
              {submitting ? "Submitting..." : "Subscribe"}
            </Button>
          </form>
          {subscribeError ? <p className="text-xs text-red-600">{subscribeError}</p> : null}
          {subscribeSuccess ? <p className="text-xs text-emerald-700">{subscribeSuccess}</p> : null}
        </section>
      ) : null}

      <div className="grid gap-8 py-8 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{storeName}</p>
          <p className="max-w-md text-base leading-relaxed">{settings?.footer_tagline || copy.footer.defaultTagline}</p>
          {settings?.footer_note ? <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{settings.footer_note}</p> : null}
        </div>

        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{copy.footer.shopLabel}</p>
          <div className="flex flex-col gap-2 text-sm">
            {navLinksWithStore.map((link) => (
              <Link key={`${link.href}:${link.label}`} href={link.href} className={STOREFRONT_TEXT_LINK_EFFECT_CLASS}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{copy.footer.supportLabel}</p>
          {settings?.support_email ? (
            <a href={`mailto:${settings.support_email}`} className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "text-sm")}>
              {settings.support_email}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">{copy.footer.supportComingSoon}</p>
          )}
          {footerLinks.length > 0 ? (
            <div className="flex items-center gap-3 pt-1">
              {footerLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={link.label}
                  title={link.label}
                  className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "inline-flex h-6 w-6 items-center justify-center text-muted-foreground")}
                >
                  {renderSocialIcon(link.label)}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/30 py-4 text-xs text-muted-foreground">
        <p>
          © {new Date().getFullYear()} {storeName}. {copy.footer.rightsReserved}
        </p>
        <div className="flex items-center gap-5">
          {showBackToTop ? (
            <a href="#" className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "font-medium")}>
              {copy.footer.backToTop}
            </a>
          ) : null}
          {showOwnerLogin ? (
            <Link href="/login" className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "font-medium")}>
              {copy.footer.ownerLogin}
            </Link>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
