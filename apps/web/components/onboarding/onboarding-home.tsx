import Link from "next/link";
import { ArrowRight, Clock3, Rocket, Sparkles, Store } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StoreOnboardingProgress } from "@/lib/stores/onboarding";
import { getLaunchReadinessChecklistItems, getOnboardingNextStep } from "@/lib/stores/onboarding-steps";

type OnboardingHomeProps = {
  existingStores: StoreOnboardingProgress[];
};

const launchBenefits = [
  "Create the store as soon as you name it.",
  "Answer one clear question at a time.",
  "See a real preview before you worry about payments.",
  "Come back later without losing your place."
];

export function OnboardingHome({ existingStores }: OnboardingHomeProps) {
  const resumableStores = existingStores
    .map((store) => ({
      store,
      nextStep: getOnboardingNextStep(store),
      remainingReadinessCount: getLaunchReadinessChecklistItems(store).filter((item) => !item.completed).length
    }))
    .filter((entry) => !entry.store.hasLaunchedOnce && entry.nextStep);

  return (
    <PageShell maxWidthClassName="max-w-6xl">
      <div className="space-y-6">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="border-border/80">
            <CardHeader className="space-y-3">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Store onboarding
              </div>
              <CardTitle>Build a polished first storefront in one guided flow</CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6">
                We&apos;ll create the store as soon as you give it a name, then walk you through the highest-leverage inputs for the
                first preview. You can keep going now or come back later without starting over.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild>
                  <Link href="/dashboard/stores/onboarding/new">
                    Create store
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <p className="text-sm text-muted-foreground">Only the store name is required to get started.</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {launchBenefits.map((item) => (
                  <div key={item} className="rounded-md border border-border/70 bg-muted/20 px-4 py-3 text-sm text-foreground">
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>What happens next</CardTitle>
              <CardDescription>The default path stays focused on momentum.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-border/70 px-4 py-3">
                <p className="text-sm font-medium">1. Name the store</p>
                <p className="mt-1 text-sm text-muted-foreground">We create the store right away and save your progress.</p>
              </div>
              <div className="rounded-md border border-border/70 px-4 py-3">
                <p className="text-sm font-medium">2. Shape the first version</p>
                <p className="mt-1 text-sm text-muted-foreground">Logo, description, visual direction, and the first product.</p>
              </div>
              <div className="rounded-md border border-border/70 px-4 py-3">
                <p className="text-sm font-medium">3. Generate and reveal</p>
                <p className="mt-1 text-sm text-muted-foreground">Preview first. Connect Stripe afterward when you&apos;re ready.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {resumableStores.length > 0 ? (
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Pick up where you left off</CardTitle>
              <CardDescription>Resume the stores that still need post-preview launch work.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {resumableStores.map(({ store, nextStep, remainingReadinessCount }) => {
                  const nextStepLabel = nextStep?.label ?? "Continue setup";

                  return (
                    <li key={store.id} className="rounded-lg border border-border/70 bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-start gap-2">
                            <Store className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{store.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {store.role} · {store.status}
                              </p>
                            </div>
                          </div>
                        </div>
                        {store.launchReady ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            <Rocket className="h-3 w-3" />
                            Ready to launch
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 space-y-1">
                        <p className="text-sm font-medium text-foreground">Next up: {nextStepLabel}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{remainingReadinessCount} launch step{remainingReadinessCount === 1 ? "" : "s"} remaining</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            Resume
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Your preview is started. From here, we focus on operational readiness.</p>
                      </div>

                      <Button asChild variant="outline" className="mt-4 w-full justify-between">
                        <Link href={`/dashboard/stores/${store.slug}/onboarding`}>
                          Continue setup
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PageShell>
  );
}
