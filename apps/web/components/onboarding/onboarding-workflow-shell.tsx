"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ImagePlus, Package2, Palette, Sparkles, Store, Wand2 } from "lucide-react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/lib/feedback/toast";
import {
  getNextOnboardingWorkflowStep,
  getOnboardingWorkflowStepIndex,
  getPreviousOnboardingWorkflowStep,
  onboardingWorkflowStepIds,
  type OnboardingAnswers,
  type OnboardingSessionStatus,
  type OnboardingWorkflowStepId
} from "@/lib/onboarding/workflow";

type OnboardingWorkflowShellProps = {
  store: {
    id: string;
    name: string;
    slug: string;
  };
  session: {
    id: string;
    status: OnboardingSessionStatus;
    current_step: OnboardingWorkflowStepId | null;
    last_completed_step: OnboardingWorkflowStepId | null;
    first_product_id?: string | null;
  };
  answers: OnboardingAnswers;
  stepProgress: Record<string, unknown>;
};

type SaveSessionResponse = {
  ok?: boolean;
  error?: string;
};

const stepMeta: Record<OnboardingWorkflowStepId, { title: string; description: string; icon: typeof Store }> = {
  logo: {
    title: "Do you have a logo?",
    description: "If you do, we’ll use it right away. If not, that’s fine too.",
    icon: ImagePlus
  },
  describeStore: {
    title: "Tell us about the store",
    description: "What do you sell, who is it for, and what feeling should the storefront give people?",
    icon: Store
  },
  visualDirection: {
    title: "Pick a visual direction",
    description: "Choose a direction you like, or let the system take the lead for the first pass.",
    icon: Palette
  },
  firstProduct: {
    title: "Shape the first product",
    description: "We’ll use this to make the preview feel real, even before the full catalog flow is wired in.",
    icon: Package2
  },
  review: {
    title: "Review the first version",
    description: "This is the information we’ll use to build the first storefront preview.",
    icon: Sparkles
  }
};

function normalizeCompletedStepIds(stepProgress: Record<string, unknown>) {
  const raw = stepProgress.completedStepIds;
  if (!Array.isArray(raw)) {
    return [] as OnboardingWorkflowStepId[];
  }

  return raw.filter((value): value is OnboardingWorkflowStepId => onboardingWorkflowStepIds.includes(value as OnboardingWorkflowStepId));
}

export function OnboardingWorkflowShell({ store, session, answers: initialAnswers, stepProgress }: OnboardingWorkflowShellProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState(initialAnswers);
  const [currentStep, setCurrentStep] = useState<OnboardingWorkflowStepId>(session.current_step ?? onboardingWorkflowStepIds[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [completedStepIds, setCompletedStepIds] = useState<OnboardingWorkflowStepId[]>(() => normalizeCompletedStepIds(stepProgress));

  const stepIndex = getOnboardingWorkflowStepIndex(currentStep);
  const progressPercent = ((stepIndex + 1) / onboardingWorkflowStepIds.length) * 100;
  const StepIcon = stepMeta[currentStep].icon;

  const reviewSummary = useMemo(
    () => [
      { label: "Store name", value: answers.storeIdentity.storeName },
      { label: "Logo", value: answers.branding.logoAssetPath ? "Uploaded" : "Not yet" },
      { label: "Description", value: answers.storeProfile.description || "We’ll start with system defaults." },
      {
        label: "Visual direction",
        value:
          answers.branding.visualDirection === "ai_choice"
            ? "Let the system decide"
            : answers.branding.visualDirection
              ? answers.branding.visualDirection.replaceAll("_", " ")
              : "Not selected"
      },
      { label: "First product", value: answers.firstProduct.title || "We’ll keep the first preview product-light." }
    ],
    [answers]
  );

  async function uploadLogoIfNeeded() {
    if (!logoFile) {
      return answers.branding.logoAssetPath;
    }

    const formData = new FormData();
    formData.set("assetType", "logo");
    formData.set("file", logoFile);

    const response = await fetch(`/api/stores/branding/logo?storeSlug=${encodeURIComponent(store.slug)}`, {
      method: "POST",
      body: formData
    });
    const payload = (await response.json()) as { logoPath?: string; error?: string };

    if (!response.ok || !payload.logoPath) {
      throw new Error(payload.error ?? "Unable to upload logo.");
    }

    return payload.logoPath;
  }

  async function persistSession(nextStep: OnboardingWorkflowStepId, nextStatus: OnboardingSessionStatus = "in_progress", nextCompleted = completedStepIds) {
    const response = await fetch(`/api/onboarding/session/${session.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storeId: store.id,
        currentStep: nextStep,
        lastCompletedStep: nextCompleted[nextCompleted.length - 1] ?? null,
        status: nextStatus,
        answers,
        stepProgress: {
          completedStepIds: nextCompleted
        }
      })
    });
    const payload = (await response.json()) as SaveSessionResponse;

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Unable to save onboarding progress.");
    }
  }

  async function handleContinue() {
    setSaving(true);
    setError(null);

    try {
      let nextAnswers = answers;

      if (currentStep === "logo" && logoFile) {
        const logoPath = await uploadLogoIfNeeded();
        nextAnswers = {
          ...answers,
          branding: {
            ...answers.branding,
            logoAssetPath: logoPath
          }
        };
        setAnswers(nextAnswers);
        setLogoFile(null);
      }

      if (currentStep === "firstProduct") {
        if (answers.firstProduct.title.trim().length < 2) {
          throw new Error("Give the first product a name before continuing.");
        }

        const firstProductResponse = await fetch(`/api/onboarding/session/${session.id}/first-product`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            storeId: store.id,
            firstProduct: answers.firstProduct
          })
        });
        const firstProductPayload = (await firstProductResponse.json()) as { ok?: boolean; error?: string; productTitle?: string };

        if (!firstProductResponse.ok || !firstProductPayload.ok) {
          throw new Error(firstProductPayload.error ?? "Unable to save the first product.");
        }

        notify.success("Draft product saved.", {
          description: firstProductPayload.productTitle ? `${firstProductPayload.productTitle} is now in the store catalog.` : "The first product draft is ready."
        });
      }

      const nextCompleted = completedStepIds.includes(currentStep) ? completedStepIds : [...completedStepIds, currentStep];
      const nextStep = currentStep === "review" ? currentStep : getNextOnboardingWorkflowStep(currentStep);

      if (currentStep === "review") {
        const response = await fetch(`/api/onboarding/session/${session.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            storeId: store.id,
            currentStep,
            lastCompletedStep: currentStep,
            status: "generation_pending",
            answers: nextAnswers,
            stepProgress: {
              completedStepIds: nextCompleted
            }
          })
        });
        const payload = (await response.json()) as SaveSessionResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Unable to start storefront generation.");
        }

        router.push(`/dashboard/stores/${store.slug}/onboarding/generating`);
        router.refresh();
        return;
      }

      setCompletedStepIds(nextCompleted);
      await fetch(`/api/onboarding/session/${session.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          currentStep: nextStep,
          lastCompletedStep: currentStep,
          status: "in_progress",
          answers: nextAnswers,
          stepProgress: {
            completedStepIds: nextCompleted
          }
        })
      }).then(async (response) => {
        const payload = (await response.json()) as SaveSessionResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Unable to save onboarding progress.");
        }
      });

      setCurrentStep(nextStep);
      if (currentStep !== "firstProduct") {
        notify.success("Progress saved.", {
          description: "Moving to the next step."
        });
      }
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to continue right now.");
    } finally {
      setSaving(false);
    }
  }

  async function handleBack() {
    const previousStep = getPreviousOnboardingWorkflowStep(currentStep);
    if (previousStep === currentStep) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await persistSession(previousStep);
      setCurrentStep(previousStep);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to move back right now.");
    } finally {
      setSaving(false);
    }
  }

  const continueLabel = currentStep === "review" ? "Build my preview" : currentStep === "logo" && !logoFile && !answers.branding.logoAssetPath ? "Skip for now" : "Continue";

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center">
      <div className="w-full space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Step {stepIndex + 1} of {onboardingWorkflowStepIds.length}
            </span>
            <span>{store.name}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
              <StepIcon className="h-3.5 w-3.5" />
              Guided setup
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{stepMeta[currentStep].title}</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{stepMeta[currentStep].description}</p>
          </div>
        </div>

        <div className="space-y-6">
          {currentStep === "logo" ? (
            <div className="space-y-4">
              <FormField label="Logo file" description="PNG, JPEG, WEBP, SVG, or ICO. You can skip this and add it later.">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
                  onChange={(event) => {
                    setLogoFile(event.target.files?.[0] ?? null);
                    setError(null);
                  }}
                  className="h-14 rounded-2xl px-4 text-base"
                />
              </FormField>

              {answers.branding.logoAssetPath ? (
                <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
                  <p className="font-medium">Current logo</p>
                  <p className="mt-1 truncate text-muted-foreground">{answers.branding.logoAssetPath}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {currentStep === "describeStore" ? (
            <FormField
              label="Store description"
              description="A few honest sentences are enough. We’ll use them to draft homepage, about, and support copy."
            >
              <Textarea
                rows={8}
                placeholder="Sunset Mercantile is a neighborhood gift shop with thoughtfully chosen home goods, stationery, and seasonal finds..."
                value={answers.storeProfile.description}
                className="rounded-2xl px-4 py-3 text-base"
                onChange={(event) => {
                  setAnswers((current) => ({
                    ...current,
                    storeProfile: {
                      description: event.target.value
                    }
                  }));
                }}
              />
            </FormField>
          ) : null}

          {currentStep === "visualDirection" ? (
            <div className="space-y-4">
              <FormField label="Visual direction" description="Pick something close. We can refine it later in Studio.">
                <Select
                  value={answers.branding.visualDirection ?? ""}
                  placeholder="Choose a direction"
                  onChange={(event) => {
                    setAnswers((current) => ({
                      ...current,
                      branding: {
                        ...current.branding,
                        visualDirection: event.target.value as OnboardingAnswers["branding"]["visualDirection"],
                        visualDirectionSource: event.target.value === "ai_choice" ? "ai" : "user"
                      }
                    }));
                  }}
                >
                  <option value="minimal">Minimal</option>
                  <option value="warm_handmade">Warm / handmade</option>
                  <option value="natural_wellness">Natural / wellness</option>
                  <option value="bold_modern">Bold / modern</option>
                  <option value="premium">Premium</option>
                  <option value="ai_choice">Let the system choose</option>
                </Select>
              </FormField>

              <div className="rounded-md border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Choosing <span className="font-medium text-foreground">Let the system choose</span> keeps the flow moving and gives us room
                to propose a stronger first pass.
              </div>
            </div>
          ) : null}

          {currentStep === "firstProduct" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Product name" description="This one matters most. We’ll build the first preview around it.">
                <Input
                  value={answers.firstProduct.title}
                  placeholder="Lavender + Chamomile Bath Soak"
                  className="h-14 rounded-2xl px-4 text-base"
                  onChange={(event) => {
                    setAnswers((current) => ({
                      ...current,
                      firstProduct: {
                        ...current.firstProduct,
                        title: event.target.value
                      }
                    }));
                  }}
                />
              </FormField>

              <FormField label="Price" description="Enter a simple price in dollars for the preview.">
                <Input
                  value={answers.firstProduct.priceDollars}
                  placeholder="24.00"
                  className="h-14 rounded-2xl px-4 text-base"
                  onChange={(event) => {
                    setAnswers((current) => ({
                      ...current,
                      firstProduct: {
                        ...current.firstProduct,
                        priceDollars: event.target.value
                      }
                    }));
                  }}
                />
              </FormField>

              <div className="md:col-span-2">
                <FormField label="Product description" description="A short draft is enough. We’ll polish it later in the catalog flow.">
                  <Textarea
                    rows={6}
                    value={answers.firstProduct.description}
                    placeholder="A calming mineral soak with lavender, chamomile, and rosemary for winding down at the end of the day."
                    className="rounded-2xl px-4 py-3 text-base"
                    onChange={(event) => {
                      setAnswers((current) => ({
                        ...current,
                        firstProduct: {
                          ...current.firstProduct,
                          description: event.target.value
                        }
                      }));
                    }}
                  />
                </FormField>
              </div>

              <FormField label="Product options" description="We’re only capturing the shape right now.">
                <Select
                  value={answers.firstProduct.optionMode}
                  onChange={(event) => {
                    setAnswers((current) => ({
                      ...current,
                      firstProduct: {
                        ...current.firstProduct,
                        optionMode: event.target.value as OnboardingAnswers["firstProduct"]["optionMode"]
                      }
                    }));
                  }}
                >
                  <option value="none">No options</option>
                  <option value="single_axis">One option set</option>
                  <option value="two_axis">Two option sets</option>
                </Select>
              </FormField>

              <FormField label="Inventory mode" description="This helps us suggest the right storefront messaging.">
                <Select
                  value={answers.firstProduct.inventoryMode}
                  onChange={(event) => {
                    setAnswers((current) => ({
                      ...current,
                      firstProduct: {
                        ...current.firstProduct,
                        inventoryMode: event.target.value as OnboardingAnswers["firstProduct"]["inventoryMode"]
                      }
                    }));
                  }}
                >
                  <option value="in_stock">In stock</option>
                  <option value="made_to_order">Made to order</option>
                </Select>
              </FormField>
            </div>
          ) : null}

          {currentStep === "review" ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {reviewSummary.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <p className="mt-2 text-sm">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm text-foreground">
                <div className="flex items-start gap-2">
                  <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>
                    Next we&apos;ll build the first preview. Payments always come afterward so the reveal stays focused on the storefront.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <AppAlert variant="error" message={error} />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
            <Button type="button" variant="ghost" onClick={() => void handleBack()} disabled={saving || currentStep === onboardingWorkflowStepIds[0]}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" asChild>
                <Link href={`/dashboard/stores/${store.slug}`}>Exit to workspace</Link>
              </Button>
              <Button type="button" onClick={() => void handleContinue()} disabled={saving}>
                {saving ? "Saving..." : continueLabel}
                {!saving ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
