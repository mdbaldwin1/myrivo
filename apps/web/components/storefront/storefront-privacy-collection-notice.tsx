"use client";

import Link from "next/link";
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
};

export function StorefrontPrivacyCollectionNotice({ surface, store, profile }: StorefrontPrivacyCollectionNoticeProps) {
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
