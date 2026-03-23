"use client";

import Link from "next/link";
import { CircleHelp, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { LegalMarkdown } from "@/components/legal/legal-markdown";
import {
  getStorePrivacyCollectionNotice,
  type ResolvedStorePrivacyProfile,
  type StorePrivacyNoticeSurface
} from "@/lib/privacy/store-privacy";

type StorefrontPrivacyCollectionNoticeProps = {
  surface: StorePrivacyNoticeSurface;
  store: {
    name: string;
    slug: string;
  };
  profile: ResolvedStorePrivacyProfile | null;
  variant?: "default" | "compact";
};

export function StorefrontPrivacyCollectionNotice({
  surface,
  store,
  profile,
  variant = "default"
}: StorefrontPrivacyCollectionNoticeProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const compactDisclosureRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!compactDisclosureRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  if (!profile?.noticeAtCollectionEnabled) {
    return null;
  }

  if (
    (surface === "checkout" && !profile.checkoutNoticeEnabled) ||
    (surface === "newsletter" && !profile.newsletterNoticeEnabled) ||
    (surface === "review" && !profile.reviewNoticeEnabled)
  ) {
    return null;
  }

  const notice = getStorePrivacyCollectionNotice(surface, store, profile);

  if (variant === "compact") {
    return (
      <div ref={compactDisclosureRef} className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline decoration-dotted underline-offset-4 transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <CircleHelp className="h-3.5 w-3.5" />
          Privacy details
        </button>
        {open ? (
          <div
            id={panelId}
            className="absolute bottom-full left-0 z-20 mb-2 w-[min(22rem,calc(100vw-3rem))] space-y-2 rounded-xl border border-border/70 bg-background px-3 py-3 text-left text-xs leading-relaxed text-muted-foreground shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-foreground">Newsletter privacy notice</p>
              <button
                type="button"
                aria-label="Close privacy details"
                onClick={() => setOpen(false)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p>
              {notice.body}{" "}
              <Link href={notice.policyHref} className="font-medium underline underline-offset-4">
                Privacy Policy
              </Link>
              .
            </p>
            {profile.showCaliforniaNotice ? (
              <p>
                California residents can review{" "}
                <Link href={notice.californiaHref} className="font-medium underline underline-offset-4">
                  their privacy rights
                </Link>{" "}
                or{" "}
                <Link href={notice.requestHref} className="font-medium underline underline-offset-4">
                  submit a privacy request
                </Link>
                .
                {profile.showDoNotSellLink ? (
                  <>
                    {" "}
                    <Link href={notice.doNotSellHref} className="font-medium underline underline-offset-4">
                      Do Not Sell or Share My Personal Information
                    </Link>
                    .
                  </>
                ) : null}
              </p>
            ) : null}
            {notice.addendumMarkdown ? <LegalMarkdown content={notice.addendumMarkdown} /> : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      <p>
        {notice.body}{" "}
        <Link href={notice.policyHref} className="font-medium underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
      {profile.showCaliforniaNotice ? (
        <p>
          California residents can review{" "}
          <Link href={notice.californiaHref} className="font-medium underline underline-offset-4">
            their privacy rights
          </Link>{" "}
          or{" "}
          <Link href={notice.requestHref} className="font-medium underline underline-offset-4">
            submit a privacy request
          </Link>
          .
          {profile.showDoNotSellLink ? (
            <>
              {" "}
              <Link href={notice.doNotSellHref} className="font-medium underline underline-offset-4">
                Do Not Sell or Share My Personal Information
              </Link>
              .
            </>
          ) : null}
        </p>
      ) : null}
      {notice.addendumMarkdown ? <LegalMarkdown content={notice.addendumMarkdown} /> : null}
    </div>
  );
}
