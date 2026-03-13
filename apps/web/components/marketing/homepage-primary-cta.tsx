"use client";

import { MarketingTrackedButtonLink } from "@/components/marketing/marketing-tracked-button-link";
import { useMarketingAnalytics } from "@/components/marketing/marketing-analytics-provider";
import { getMarketingExperimentVariantPayload } from "@/lib/marketing/experiments";

type HomepagePrimaryCtaProps = {
  isAuthenticated: boolean;
};

export function HomepagePrimaryCta({ isAuthenticated }: HomepagePrimaryCtaProps) {
  const { experimentAssignments } = useMarketingAnalytics();
  const experimentPayload = getMarketingExperimentVariantPayload({
    experimentKey: "homepage_primary_cta_copy",
    variantKey: experimentAssignments.homepage_primary_cta_copy
  });

  if (isAuthenticated) {
    return (
      <MarketingTrackedButtonLink
        href="/dashboard"
        ctaKey="home_hero_open_dashboard"
        ctaLabel="Open dashboard"
        sectionKey="hero"
        className="h-11 rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary"
      >
        Open dashboard
      </MarketingTrackedButtonLink>
    );
  }

  const label = experimentPayload?.label ?? "Start free";

  return (
    <MarketingTrackedButtonLink
      href="/signup"
      ctaKey={`home_hero_${label.toLowerCase().replace(/\s+/g, "_")}`}
      ctaLabel={label}
      sectionKey="hero"
      conversionIntent="signup"
      className="h-11 rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary"
    >
      {label}
    </MarketingTrackedButtonLink>
  );
}
