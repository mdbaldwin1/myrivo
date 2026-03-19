"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Facebook, Instagram, Music2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { CookiePreferencesButton } from "@/components/privacy/cookie-preferences-button";
import { useOptionalStorefrontAnalytics } from "@/components/storefront/storefront-analytics-provider";
import { useOptionalStorefrontRuntime } from "@/components/storefront/storefront-runtime-provider";
import { StorefrontPrivacyCollectionNotice } from "@/components/storefront/storefront-privacy-collection-notice";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StorefrontStudioEditableText } from "@/components/storefront/storefront-studio-editable-text";
import { cn } from "@/lib/utils";
import { withReturnTo } from "@/lib/auth/return-to";
import { DEFAULT_STOREFRONT_COPY, type StorefrontCopyConfig } from "@/lib/storefront/copy";
import { getStorefrontPageWidthClass } from "@/lib/storefront/layout";
import { STOREFRONT_TEXT_LINK_EFFECT_CLASS } from "@/lib/storefront/link-effects";
import {
  buildStorefrontCookiesPath,
  buildStorefrontPrivacyPath,
  buildStorefrontPrivacyRequestPath,
  buildStorefrontTermsPath
} from "@/lib/storefront/paths";

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
  viewer?: {
    isAuthenticated: boolean;
    canManageStore: boolean;
  };
  settings: FooterSettings;
  buttonRadiusClass?: string;
  surfaceRadiusClassName?: string;
  surfaceCardClassName?: string;
  copy?: StorefrontCopyConfig;
  navLinks?: Array<{ label: string; href: string }>;
  showBackToTop?: boolean;
  showOwnerLogin?: boolean;
  studio?: {
    newsletterFocus?: boolean;
    onTaglineChange?: (value: string) => void;
    onNoteChange?: (value: string) => void;
    onHeadingChange?: (value: string) => void;
    onDescriptionChange?: (value: string) => void;
  };
};

const NEWSLETTER_EMAIL_INPUT_ID = "storefront-footer-newsletter-email";

export function StorefrontFooter({
  storeName,
  storeSlug,
  viewer,
  settings,
  buttonRadiusClass = "rounded-md",
  surfaceRadiusClassName,
  surfaceCardClassName,
  copy = DEFAULT_STOREFRONT_COPY,
  navLinks,
  showBackToTop = true,
  showOwnerLogin = true,
  studio
}: StorefrontFooterProps) {
  const analytics = useOptionalStorefrontAnalytics();
  const runtime = useOptionalStorefrontRuntime();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [subscribeSuccess, setSubscribeSuccess] = useState<string | null>(null);
  const resolvedPrivacyProfile = runtime?.privacyProfile ?? null;
  const pageWidthClass = getStorefrontPageWidthClass(runtime?.themeConfig.pageWidth ?? "standard");

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

  const normalizedStoreSlug = storeSlug?.trim() || "";
  const unsubscribeHref = normalizedStoreSlug ? `/unsubscribe?store=${encodeURIComponent(normalizedStoreSlug)}` : "/unsubscribe";
  const legalLinks = [
    {
      label: copy.footer.privacyLink,
      href: normalizedStoreSlug ? buildStorefrontPrivacyPath(normalizedStoreSlug) : "/privacy"
    },
    {
      label: "Cookie Policy",
      href: normalizedStoreSlug ? buildStorefrontCookiesPath(normalizedStoreSlug) : "/cookies"
    },
    {
      label: copy.footer.termsLink,
      href: normalizedStoreSlug ? buildStorefrontTermsPath(normalizedStoreSlug) : "/terms"
    },
    ...(resolvedPrivacyProfile?.showCaliforniaNotice
      ? [
          {
            label: "California Privacy Rights",
            href: normalizedStoreSlug ? `${buildStorefrontPrivacyPath(normalizedStoreSlug)}#california-privacy-notice` : "/privacy#california-privacy-notice"
          }
        ]
      : []),
    ...(resolvedPrivacyProfile?.showDoNotSellLink
      ? [
          {
            label: "Do Not Sell / Share",
            href: normalizedStoreSlug
              ? `${buildStorefrontPrivacyRequestPath(normalizedStoreSlug)}?type=opt_out_sale_share`
              : "/privacy/request?type=opt_out_sale_share"
          }
        ]
      : [])
  ];
  const navLinksWithStore = resolvedNavLinks;
  const currentPath = pathname ?? "/";
  const currentSearch = searchParams?.toString();
  const currentReturnTo = currentSearch ? `${currentPath}?${currentSearch}` : currentPath;
  const studioEnabled = Boolean(studio);
  const authCta = (() => {
    if (viewer?.isAuthenticated) {
      if (viewer.canManageStore && normalizedStoreSlug) {
        return {
          label: "Store Dashboard",
          href: `/dashboard/stores/${encodeURIComponent(normalizedStoreSlug)}`
        };
      }
      return {
        label: "My Account",
        href: "/account"
      };
    }

    return {
      label: "Sign in",
      href: withReturnTo("/login", currentReturnTo)
    };
  })();

  async function subscribeToNewsletter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubscribeError(null);
    setSubscribeSuccess(null);

    const query = storeSlug ? `?store=${encodeURIComponent(storeSlug)}` : "";
    const response = await fetch(`/api/storefront/newsletter${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        source: "storefront_footer",
        location: pathname ?? "/"
      })
    });

    const payload = (await response.json()) as { error?: string };
    setSubmitting(false);

    if (!response.ok) {
      setSubscribeError(payload.error ?? "Unable to subscribe right now.");
      return;
    }

    analytics?.track({
      eventType: "newsletter_subscribed",
      value: {
        source: "footer",
        location: pathname ?? "/"
      }
    });
    setSubscribeSuccess(settings?.email_capture_success_message?.trim() || "Thanks for subscribing.");
    setEmail("");
  }

  return (
    <footer data-storefront-preview-section="footer" className="mt-8 border-t border-border/40 pt-8 sm:mt-10 sm:pt-10">
      <div className={cn("mx-auto w-full px-4 sm:px-6", pageWidthClass)}>
        <div
          className={cn(
            "grid gap-4 py-6 sm:gap-6 sm:py-8 lg:gap-8",
            settings?.email_capture_enabled
              ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.15fr)]"
              : "sm:grid-cols-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]"
          )}
        >
          <div
            className={cn(
              surfaceRadiusClassName,
              surfaceCardClassName,
              "order-2 space-y-3 p-4 text-center sm:p-5 lg:order-none lg:text-left lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
            )}
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{storeName}</p>
            {studioEnabled ? (
              <StorefrontStudioEditableText
                as="p"
                multiline
                value={settings?.footer_tagline?.trim() || copy.footer.defaultTagline}
                placeholder="Footer tagline"
                displayClassName="max-w-md text-base leading-relaxed"
                onChange={(value) => studio?.onTaglineChange?.(value)}
              />
            ) : (
              <p className="max-w-md text-base leading-relaxed">{settings?.footer_tagline || copy.footer.defaultTagline}</p>
            )}
            {studioEnabled ? (
              <StorefrontStudioEditableText
                as="p"
                multiline
                value={settings?.footer_note?.trim() || ""}
                placeholder="Add an optional footer note"
                wrapperClassName={cn("transition", !settings?.footer_note?.trim() && "opacity-0 group-hover/footer:opacity-100 group-focus-within/footer:opacity-100")}
                displayClassName={cn("max-w-md text-sm leading-relaxed text-muted-foreground", !settings?.footer_note?.trim() && "italic text-muted-foreground/75")}
                onChange={(value) => studio?.onNoteChange?.(value)}
              />
            ) : settings?.footer_note ? (
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{settings.footer_note}</p>
            ) : null}
          </div>

          <div
            className={cn(
              surfaceRadiusClassName,
              surfaceCardClassName,
              "order-3 space-y-3 p-4 text-center sm:p-5 lg:order-none lg:text-left lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
            )}
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{copy.footer.shopLabel}</p>
            <div className="flex flex-col items-center gap-2 text-sm lg:items-start">
              {navLinksWithStore.map((link) => (
                <Link key={`${link.href}:${link.label}`} href={link.href} className={STOREFRONT_TEXT_LINK_EFFECT_CLASS}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div
            className={cn(
              surfaceRadiusClassName,
              surfaceCardClassName,
              "order-4 space-y-3 p-4 text-center sm:p-5 lg:order-none lg:text-left lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
            )}
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{copy.footer.supportLabel}</p>
            {settings?.support_email ? (
              <a
                href={`mailto:${settings.support_email}`}
                className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "max-w-full break-all text-sm lg:max-w-[14rem]")}
              >
                {settings.support_email}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">{copy.footer.supportComingSoon}</p>
            )}
            <Link href="/accessibility" className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "text-sm")}>
              Accessibility
            </Link>
            {footerLinks.length > 0 ? (
              <div className="flex items-center justify-center gap-3 pt-1 lg:justify-start">
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

          <div
            className={cn(
              surfaceRadiusClassName,
              surfaceCardClassName,
              "order-5 space-y-3 p-4 text-center sm:p-5 lg:order-none lg:text-left lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
            )}
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{copy.footer.legalLabel}</p>
            <div className="flex flex-col items-center gap-2 text-sm lg:items-start">
              {legalLinks.map((link) => (
                <Link key={`${link.href}:${link.label}`} href={link.href} className={STOREFRONT_TEXT_LINK_EFFECT_CLASS}>
                  {link.label}
                </Link>
              ))}
              <CookiePreferencesButton className={STOREFRONT_TEXT_LINK_EFFECT_CLASS}>Manage cookies</CookiePreferencesButton>
            </div>
          </div>

          {settings?.email_capture_enabled || studio?.newsletterFocus ? (
            <section
              id={studio?.newsletterFocus ? "storefront-newsletter-module" : undefined}
              className={cn(
                surfaceRadiusClassName,
                surfaceCardClassName,
                "order-1 space-y-3 p-4 text-center sm:p-5 lg:order-none lg:text-left lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0",
                !settings?.email_capture_enabled && studio?.newsletterFocus
                  ? "border-dashed border-border/70 bg-muted/10"
                  : ""
              )}
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Join our email list</p>
              <div className="space-y-1">
                {studioEnabled ? (
                  <StorefrontStudioEditableText
                    as="p"
                    value={settings?.email_capture_heading?.trim() || "Get updates from the shop"}
                    placeholder="Newsletter heading"
                    displayClassName="text-base font-semibold [font-family:var(--storefront-font-heading)]"
                    onChange={(value) => studio?.onHeadingChange?.(value)}
                  />
                ) : (
                  <p className="text-base font-semibold [font-family:var(--storefront-font-heading)]">
                    {settings?.email_capture_heading?.trim() || "Get updates from the shop"}
                  </p>
                )}
                {studioEnabled ? (
                  <StorefrontStudioEditableText
                    as="p"
                    multiline
                    value={settings?.email_capture_description?.trim() || "New releases, restocks, and occasional offers. Unsubscribe anytime."}
                    placeholder="Newsletter description"
                    displayClassName="max-w-md text-sm text-muted-foreground"
                    onChange={(value) => studio?.onDescriptionChange?.(value)}
                  />
                ) : (
                  <p className="max-w-md text-sm text-muted-foreground">
                    {settings?.email_capture_description?.trim() || "New releases, restocks, and occasional offers. Unsubscribe anytime."}
                  </p>
                )}
                {!settings?.email_capture_enabled && studio?.newsletterFocus ? (
                  <p className="text-xs text-muted-foreground">Newsletter capture is currently hidden from the live storefront. Enable it in the Studio rail to publish this module.</p>
                ) : null}
              </div>
              <form onSubmit={subscribeToNewsletter} className="mx-auto flex max-w-md flex-col gap-2 sm:max-w-full lg:mx-0">
                <label htmlFor={NEWSLETTER_EMAIL_INPUT_ID} className="sr-only">
                  Email address
                </label>
                <Input
                  id={NEWSLETTER_EMAIL_INPUT_ID}
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  aria-label="Email address"
                  className={cn("h-11 border-border/60 bg-[color:var(--storefront-surface)]", buttonRadiusClass)}
                />
                <Button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    "h-11 w-full px-5 bg-[var(--storefront-primary)] text-[color:var(--storefront-primary-foreground)] hover:opacity-90",
                    buttonRadiusClass
                  )}
                >
                  {submitting ? "Submitting..." : "Subscribe"}
                </Button>
              </form>
              {normalizedStoreSlug ? (
                <StorefrontPrivacyCollectionNotice
                  surface="newsletter"
                  store={{ name: storeName, slug: normalizedStoreSlug }}
                  profile={resolvedPrivacyProfile}
                  variant="compact"
                />
              ) : null}
              <AppAlert variant="error" compact className="text-xs" message={subscribeError} />
              <AppAlert variant="success" compact className="text-xs" message={subscribeSuccess} />
              <p className="text-xs text-muted-foreground">
                Already subscribed?{" "}
                <Link href={unsubscribeHref} className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "font-medium")}>
                  Unsubscribe
                </Link>
              </p>
            </section>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-border/30 py-4 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {storeName}. {copy.footer.rightsReserved}
          </p>
          <div className="flex flex-wrap items-center gap-4 sm:gap-5">
            {showBackToTop ? (
              <a href="#" className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "font-medium")}>
                {copy.footer.backToTop}
              </a>
            ) : null}
            {showOwnerLogin ? (
              <Link href={authCta.href} className={cn(STOREFRONT_TEXT_LINK_EFFECT_CLASS, "font-medium")}>
                {authCta.label}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
