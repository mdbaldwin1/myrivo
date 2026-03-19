import Link from "next/link";
import { ArrowRight, CreditCard, LayoutTemplate, Package2, Rocket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingRevealActionLink } from "@/components/onboarding/onboarding-reveal-action-link";
import { OnboardingStorefrontPreview } from "@/components/onboarding/onboarding-storefront-preview";
import type { OnboardingAnswers } from "@/lib/onboarding/workflow";

type OnboardingRevealScreenProps = {
  store: {
    id: string;
    name: string;
    slug: string;
  };
  sessionId: string;
  answers: OnboardingAnswers;
  preview: {
    announcement: string | null;
    fulfillmentMessage: string | null;
    footerTagline: string | null;
    supportEmail: string | null;
    primaryColor: string | null;
    accentColor: string | null;
    productCount: number;
  };
};

export function OnboardingRevealScreen({ store, sessionId, answers, preview }: OnboardingRevealScreenProps) {
  const directionLabel = answers.branding.visualDirection ? answers.branding.visualDirection.replaceAll("_", " ") : "AI-led direction";

  return (
    <div className="space-y-6">
      <section>
        <Card className="border-border/80 bg-gradient-to-br from-background via-background to-primary/5">
          <CardHeader className="space-y-4">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Preview ready
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">Your first storefront is ready to explore</CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6">
                We turned your onboarding answers into a first storefront direction with seeded copy, styling, support language, email touchpoints,
                and a real product draft so you can react to something that already feels alive.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Storefront</p>
                <p className="mt-2 text-sm font-medium">{store.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">/s/{store.slug}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Direction</p>
                <p className="mt-2 text-sm font-medium capitalize">{directionLabel}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border border-border/60" style={{ backgroundColor: preview.primaryColor ?? "#0F7B84" }} />
                  <span className="h-3 w-3 rounded-full border border-border/60" style={{ backgroundColor: preview.accentColor ?? "#1AA3A8" }} />
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Catalog seed</p>
                <p className="mt-2 text-sm font-medium">{answers.firstProduct.title || "First product pending"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{preview.productCount} preview-visible product{preview.productCount === 1 ? "" : "s"}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild>
                <OnboardingRevealActionLink
                  href={`/dashboard/stores/${store.slug}/storefront-studio`}
                  storeId={store.id}
                  storeSlug={store.slug}
                  sessionId={sessionId}
                  milestone="studio_handoff"
                >
                  Customize in Studio
                  <ArrowRight className="h-4 w-4" />
                </OnboardingRevealActionLink>
              </Button>
              <Button asChild variant="outline">
                <OnboardingRevealActionLink
                  href={`/dashboard/stores/${store.slug}`}
                  storeId={store.id}
                  storeSlug={store.slug}
                  sessionId={sessionId}
                  milestone="launch_checklist_handoff"
                >
                  Open workspace
                </OnboardingRevealActionLink>
              </Button>
              <Button asChild variant="ghost">
                <OnboardingRevealActionLink
                  href={`/s/${store.slug}`}
                  storeId={store.id}
                  storeSlug={store.slug}
                  sessionId={sessionId}
                  activateStore={false}
                >
                  View storefront
                </OnboardingRevealActionLink>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <OnboardingStorefrontPreview storeId={store.id} sessionId={sessionId} storeSlug={store.slug} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-lg">Keep shaping the storefront</CardTitle>
            <CardDescription>Refine the look, headlines, sections, and merchandising surfaces.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full justify-between">
              <OnboardingRevealActionLink
                href={`/dashboard/stores/${store.slug}/storefront-studio`}
                storeId={store.id}
                storeSlug={store.slug}
                sessionId={sessionId}
                milestone="studio_handoff"
              >
                <span className="inline-flex items-center gap-2">
                  <LayoutTemplate className="h-4 w-4" />
                  Open Studio
                </span>
                <ArrowRight className="h-4 w-4" />
              </OnboardingRevealActionLink>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-lg">Build out the catalog</CardTitle>
            <CardDescription>Add more products, pricing detail, imagery, and variants once the first draft feels right.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full justify-between">
              <OnboardingRevealActionLink
                href={`/dashboard/stores/${store.slug}/catalog`}
                storeId={store.id}
                storeSlug={store.slug}
                sessionId={sessionId}
                milestone="catalog_handoff"
              >
                <span className="inline-flex items-center gap-2">
                  <Package2 className="h-4 w-4" />
                  Open Catalog
                </span>
                <ArrowRight className="h-4 w-4" />
              </OnboardingRevealActionLink>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-lg">Connect payments when you’re ready</CardTitle>
            <CardDescription>Connect payments before you go live. You do not need to do it before previewing your store.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full justify-between">
              <OnboardingRevealActionLink
                href={`/dashboard/stores/${store.slug}/store-settings/integrations`}
                storeId={store.id}
                storeSlug={store.slug}
                sessionId={sessionId}
                milestone="payments_handoff"
              >
                <span className="inline-flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Connect Stripe
                </span>
                <ArrowRight className="h-4 w-4" />
              </OnboardingRevealActionLink>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-lg">Get ready to launch</CardTitle>
            <CardDescription>Your preview is ready now. Launch readiness comes next.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full justify-between">
              <OnboardingRevealActionLink
                href={`/dashboard/stores/${store.slug}`}
                storeId={store.id}
                storeSlug={store.slug}
                sessionId={sessionId}
                milestone="launch_checklist_handoff"
              >
                <span className="inline-flex items-center gap-2">
                  <Rocket className="h-4 w-4" />
                  Review launch checklist
                </span>
                <ArrowRight className="h-4 w-4" />
              </OnboardingRevealActionLink>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-muted/20 px-5 py-4">
        <div>
          <p className="text-sm font-medium">Need to step away?</p>
          <p className="text-sm text-muted-foreground">This reveal and your seeded storefront will still be here when you come back.</p>
        </div>
        <Button asChild variant="ghost">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
